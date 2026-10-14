import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withDatabase, api } from './helpers';
test('core lifecycle, profile partial updates, normalized conflicts, validation and stable IDs/dates', async () => {
  await withDatabase(async (db,admin,schema,url)=>{
    const call=api(url), r=(await call('/api/v1/restaurants','POST',{name:'Core Kitchen'},201)).restaurant;
    const root='/api/v1/restaurants/'+r.restaurant_id;
    await call(root,'PATCH',{city:'Lynchburg',timezone:'America/Chicago'});
    assert.equal((await call(root)).restaurant.name,'Core Kitchen'); assert.equal((await call(root)).restaurant.timezone,'America/Chicago');
    await call(root,'PATCH',{timezone:'Not/AZone'},400); await call(root,'PATCH',{},400);
    const purchase={name:'Bread Flour',purchase_unit:'lb',purchase_quantity:25,purchase_price:0};
    const i=(await call(root+'/ingredients','POST',purchase,201)).ingredient;
    await call(root+'/ingredients','POST',{...purchase,name:' bread   flour '},409);
    assert.equal((await call(root+'/ingredients/'+i.ingredient_id)).ingredient.purchase_price,'0.00');
    const body={name:'Dough',instructions:'Mix',yield_quantity:8,yield_unit:'portion',ingredients:[{ingredient_id:i.ingredient_id,quantity:16,unit:'oz'}]};
    const recipe=(await call(root+'/recipes','POST',body,201)).recipe;
    await call(root+'/recipes','POST',{...body,name:' dough '},409);
    assert.equal(Number((await call(root+'/recipes/'+recipe.recipe_id)).recipe.costing.batch_cost),0);
    await call(root+'/ingredients/'+i.ingredient_id,'PUT',{...purchase,purchase_price:null});
    assert.equal((await call(root+'/recipes/'+recipe.recipe_id)).recipe.costing.batch_cost,null);
    await call(root+'/ingredients/'+i.ingredient_id,'DELETE',undefined,409);
    await call(root+'/recipes/'+recipe.recipe_id,'DELETE');
    assert.equal((await call(root+'/recipes')).recipes.length,0);
    assert.equal((await call(root+'/recipes/'+recipe.recipe_id)).recipe.is_active,false);
    await call(root+'/ingredients/'+i.ingredient_id,'DELETE');
    assert.equal((await call(root+'/ingredients')).ingredients.length,0);
    await call(root+'/recipes/'+recipe.recipe_id,'PATCH',{is_active:true},409);
    await call(root+'/ingredients/'+i.ingredient_id,'PATCH',{is_active:true});
    await call(root+'/recipes/'+recipe.recipe_id,'PATCH',{is_active:true});
    const other=(await call('/api/v1/restaurants','POST',{name:'Other Core'},201)).restaurant;
    await call('/api/v1/restaurants/'+other.restaurant_id+'/ingredients/'+i.ingredient_id,'GET',undefined,404);
    await call('/api/v1/restaurants/'+other.restaurant_id+'/recipes/'+recipe.recipe_id,'DELETE',undefined,404);
    const countBefore=(await db.query('SELECT count(*) FROM recipes')).rows[0].count;
    await call(root+'/recipes','POST',{...body,name:'Invalid',ingredients:[{ingredient_id:i.ingredient_id,quantity:1,unit:'cup'}]},400);
    assert.equal((await db.query('SELECT count(*) FROM recipes')).rows[0].count,countBefore);
    // Simulate a recipe writer holding its ingredient read lock while a unit edit arrives.
    const guard=(await call(root+'/ingredients','POST',{name:'Unit Guard',purchase_unit:'lb',purchase_quantity:1,purchase_price:2},201)).ingredient;
    const writer=await db.connect();
    await writer.query('BEGIN');
    await writer.query('SELECT ingredient_id FROM ingredients WHERE ingredient_id=$1 FOR SHARE',[guard.ingredient_id]);
    const pendingEdit=fetch(url+root+'/ingredients/'+guard.ingredient_id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Unit Guard',purchase_unit:'kg',purchase_quantity:1,purchase_price:2})});
    try {
      let waiting=0;
      for(let attempt=0;attempt<100;attempt++) {
        waiting=Number((await admin.query("SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[schema])).rows[0].count);
        if(waiting) break; await new Promise(r=>setTimeout(r,25));
      }
      assert(waiting>0,'Unit editor must wait for the recipe ingredient lock');
      const guardedRecipe=(await writer.query("INSERT INTO recipes(restaurant_id,name,instructions) VALUES($1,'Guarded Recipe','Mix') RETURNING recipe_id",[r.restaurant_id])).rows[0];
      await writer.query("INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit,original_quantity,original_unit) VALUES($1,$2,1,'lb',1,'lb')",[guardedRecipe.recipe_id,guard.ingredient_id]);
      await writer.query('COMMIT'); assert.equal((await pendingEdit).status,409);
    } finally { await writer.query('ROLLBACK'); writer.release(); }
    const prep=(await call(root+'/prep-lists','POST',{date:'2026-10-14',title:'Prep',tasks:['Portion dough']},201)).prep_list;
    assert.equal(prep.prep_date,'2026-10-14'); assert.equal(typeof prep.tasks[0].prep_task_id,'string');
    assert.equal((await call(root+'/prep-lists?date=2026-10-14')).prep_list.prep_date,'2026-10-14');
    await call(root+'/prep-lists','POST',{date:'2026-10-14',title:'Duplicate',tasks:['Task']},409);
    await call(root+'/prep-lists/tasks/'+prep.tasks[0].prep_task_id,'PATCH',{is_complete:true});
    assert.equal((await call(root+'/prep-lists?date=2026-10-14')).prep_list.tasks[0].is_complete,true);
    await call(root+'/prep-lists/tasks/'+prep.tasks[0].prep_task_id,'PATCH',{description:'Portion dough balls'});
    assert.equal((await call(root+'/prep-lists?date=2026-10-14')).prep_list.tasks[0].is_complete,true);
    const template=(await call(root+'/checklists/templates','POST',{name:'Open',checklist_type:'opening',tasks:['Stock line']},201)).template;
    const run=(await call(root+'/checklists/runs','POST',{template_id:template.checklist_template_id,date:'2026-10-14',shift_label:'AM'},201)).run;
    await call(root+'/checklists/templates/'+template.checklist_template_id,'PUT',{name:'Open Revised',checklist_type:'opening',tasks:['New routine']});
    assert.equal((await call(root+'/checklists/templates/'+template.checklist_template_id)).template.tasks[0].description,'New routine');
    assert.equal((await call(root+'/checklists/runs?date=2026-10-14')).runs[0].tasks[0].description,'Stock line');
    await call('/api/v1/restaurants/'+other.restaurant_id+'/checklists/templates/'+template.checklist_template_id,'PUT',{name:'Foreign',checklist_type:'opening',tasks:['Other']},404);
    assert.equal(run.run_date,'2026-10-14'); assert.equal(typeof run.tasks[0].checklist_run_task_id,'string');
    await call(root+'/checklists/runs','POST',{template_id:template.checklist_template_id,date:'2026-10-14',shift_label:'AM'},409);
  });
});
