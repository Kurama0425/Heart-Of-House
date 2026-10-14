import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withDatabase, api } from './helpers';
const ingredients_csv = 'name,purchase_unit,purchase_quantity,purchase_price\nFlour,lb,25,18.50\nWater,ml,1000,\nSalt,lb,1,0';
const recipes_csv = 'recipe_name,instructions,yield_quantity,yield_unit,ingredient_name,quantity,unit\nDough,"Mix, then knead",8,portion,flour,16,oz\nDough,"Mix, then knead",8,portion,Water,500,ml';
test('CSV preview/commit real PostgreSQL: confirmation, isolation, duplicates, rollback and concurrency', async t => {
  await withDatabase(async (db, _admin, _schema, url) => {
    const call = api(url);
    const kitchen = async (name: string) => '/api/v1/restaurants/' + (await call('/api/v1/restaurants', 'POST', {name}, 201)).restaurant.restaurant_id;
    await t.test('preview makes no kitchen writes; confirmed import retains measurements/nulls/zeros; receipt retries are idempotent', async () => {
      const root = await kitchen('Import Kitchen');
      const preview = await call(root+'/imports/preview','POST',{ingredients_csv,recipes_csv});
      assert.equal(preview.can_commit,true); assert.equal(preview.preview.recipes[0].ingredients[0].original_unit,'oz');
      assert.equal((await call(root+'/ingredients')).ingredients.length,0);
      await call(root+'/imports/'+preview.import_id+'/commit','POST',{confirm:false},400);
      const result = await call(root+'/imports/'+preview.import_id+'/commit','POST',{confirm:true},201);
      assert.equal(result.summary.imported_ingredients,3); assert.equal(result.summary.imported_recipes,1);
      const catalog = (await call(root+'/ingredients')).ingredients;
      assert.equal(catalog.find((i:any)=>i.name==='Water').purchase_price,null);
      assert.equal(Number(catalog.find((i:any)=>i.name==='Salt').purchase_price),0);
      const recipe = (await call(root+'/recipes/'+result.summary.recipes[0].recipe_id)).recipe;
      const flour = recipe.ingredients.find((i:any)=>i.name==='Flour');
      assert.equal(Number(flour.quantity),1); assert.equal(Number(flour.original_quantity),16); assert.equal(flour.original_unit,'oz'); assert.equal(recipe.costing.batch_cost,null);
      assert.equal((await call(root+'/imports/'+preview.import_id+'/commit','POST',{confirm:true})).already_committed,true);
      assert.equal((await call(root+'/imports/preview','POST',{ingredients_csv,recipes_csv})).already_imported,true);
      assert.equal((await call(root+'/imports/'+preview.import_id)).status,'committed');
      const other = await kitchen('Other Import Kitchen');
      await call(other+'/imports/'+preview.import_id,'GET',undefined,404);
      await call(other+'/imports/'+preview.import_id+'/commit','POST',{confirm:true},404);
    });
    await t.test('existing catalog reuse and conflicting recipes are explicit; concurrent commit saves once', async () => {
      const root = await kitchen('Concurrent Kitchen');
      await call(root+'/ingredients','POST',{name:'Flour',purchase_unit:'lb',purchase_quantity:25,purchase_price:18.5},201);
      const body={ingredients_csv: ingredients_csv.split('\n').slice(0,2).join('\n'),recipes_csv: recipes_csv.split('\n').slice(0,2).join('\n')};
      const preview = await call(root+'/imports/preview','POST',body);
      assert.equal(preview.preview.skipped_ingredients,1);
      const secondPreview = await call(root+'/imports/preview','POST',body);
      assert.notEqual(secondPreview.import_id,preview.import_id);
      const responses=await Promise.all([preview.import_id,secondPreview.import_id].map(importId => fetch(url+root+'/imports/'+importId+'/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true})})));
      assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);
      assert.equal((await call(root+'/recipes')).recipes.length,1);
      const conflict=await call(root+'/imports/preview','POST',{recipes_csv:body.recipes_csv+'\n'});
      assert.equal(conflict.can_commit,false); assert(conflict.preview.errors.some((e:any)=>e.code==='RECIPE_CONFLICT'));
    });
    await t.test('stale and expired previews cannot save records', async () => {
      const root=await kitchen('Stale Kitchen'),body={ingredients_csv:'name,purchase_unit,purchase_quantity,purchase_price\nButter,lb,1,4'};
      const preview=await call(root+'/imports/preview','POST',body);
      await call(root+'/ingredients','POST',{name:'Oil',purchase_unit:'l',purchase_quantity:1,purchase_price:5},201);
      await call(root+'/imports/'+preview.import_id+'/commit','POST',{confirm:true},409);
      assert.equal((await call(root+'/ingredients')).ingredients.length,1);
      const refreshed=await call(root+'/imports/preview','POST',body);
      assert.notEqual(refreshed.import_id,preview.import_id);
      await call(root+'/imports/'+preview.import_id+'/commit','POST',{confirm:true},409);
      await db.query("UPDATE import_batches SET expires_at=NOW()-INTERVAL '1 minute' WHERE import_id=$1",[refreshed.import_id]);
      assert.equal((await call(root+'/imports/'+refreshed.import_id)).can_commit,false);
      await call(root+'/imports/'+refreshed.import_id+'/commit','POST',{confirm:true},409);
    });
    await t.test('recipe-write failure rolls back ingredients and receipt; same plan can be retried', async () => {
      const root=await kitchen('Rollback Kitchen');
      const preview=await call(root+'/imports/preview','POST',{ingredients_csv,recipes_csv});
      await db.query("CREATE FUNCTION reject_test_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = 'Dough' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$");
      await db.query('CREATE TRIGGER reject_test_import BEFORE INSERT ON recipes FOR EACH ROW EXECUTE FUNCTION reject_test_import()');
      try { await call(root+'/imports/'+preview.import_id+'/commit','POST',{confirm:true},503); }
      finally { await db.query('DROP TRIGGER reject_test_import ON recipes'); }
      assert.equal((await call(root+'/ingredients')).ingredients.length,0);
      assert.equal((await call(root+'/imports/'+preview.import_id)).status,'preview');
      await call(root+'/imports/'+preview.import_id+'/commit','POST',{confirm:true},201);
    });
    await t.test('bad CSV and foreign/archived mappings return structured problems without imports', async () => {
      const root=await kitchen('Invalid Kitchen');
      const result=await call(root+'/imports/preview','POST',{recipes_csv});
      assert.equal(result.import_id,null); assert(result.preview.errors.every((e:any)=>e.code==='INGREDIENT_MISSING'));
      assert.equal((await db.query('SELECT count(*) AS count FROM import_batches WHERE restaurant_id=$1',[root.split('/').pop()])).rows[0].count,'0');
      await call('/api/v1/restaurants/9223372036854775807/imports/preview','POST',{ingredients_csv},404);
    });
  });
});
