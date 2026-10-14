import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { withDatabase, api } from './helpers';

test('recipe detail and costing stay in one snapshot when a recipe is edited mid-read', async () => {
  await withDatabase(async (db,_admin,_schema,url) => {
    const call=api(url);
    const r=(await call('/api/v1/restaurants','POST',{name:'Consistent Recipe Read'},201)).restaurant;
    const root='/api/v1/restaurants/'+r.restaurant_id;
    const i=(await call(root+'/ingredients','POST',{name:'Flour',purchase_unit:'lb',purchase_quantity:25,purchase_price:18.5},201)).ingredient;
    const recipe=(await call(root+'/recipes','POST',{name:'Dough',instructions:'Mix',yield_quantity:8,yield_unit:'portion',ingredients:[{ingredient_id:i.ingredient_id,quantity:16,unit:'oz'}]},201)).recipe;
    let changed=false;
    const reader=createApp({
      query: (sql,values) => db.query(sql,values),
      async connect() {
        const client=await db.connect();
        return { release:()=>client.release(), async query(sql:string,values?:unknown[]) {
          const result=await client.query(sql,values);
          if(!changed && sql.startsWith('SELECT * FROM recipes WHERE restaurant_id')) {
            changed=true;
            const writer=await db.connect();
            try {
              await writer.query('BEGIN');
              await writer.query('UPDATE recipes SET yield_quantity=4, updated_at=NOW() WHERE recipe_id=$1',[recipe.recipe_id]);
              await writer.query("UPDATE recipe_ingredients SET quantity=2, original_quantity=2, original_unit='lb' WHERE recipe_id=$1",[recipe.recipe_id]);
              await writer.query('COMMIT');
            } catch(error) {await writer.query('ROLLBACK');throw error;}
            finally {writer.release();}
          }
          return result;
        }};
      }
    }).listen(0,'127.0.0.1');
    await new Promise<void>(r=>reader.once('listening',r));
    const address=reader.address();assert(address && typeof address!=='string');
    try {
      const old=(await api(`http://127.0.0.1:${address.port}`)(root+'/recipes/'+recipe.recipe_id)).recipe;
      assert(changed);
      assert.equal(Number(old.yield_quantity),8);
      assert.equal(Number(old.ingredients[0].quantity),1);
      assert.equal(Number(old.costing.batch_cost),0.74);
      assert.equal(Number(old.costing.portion_cost),0.0925);
      const current=(await call(root+'/recipes/'+recipe.recipe_id)).recipe;
      assert.equal(Number(current.yield_quantity),4);
      assert.equal(Number(current.costing.batch_cost),1.48);
      assert.equal(Number(current.costing.portion_cost),0.37);
    } finally {await new Promise<void>(r=>reader.close(()=>r()));}
  });
});
