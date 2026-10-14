import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createApp } from '../src/app';

// Only run against a disposable database. The CI job creates heart_of_house_test.
// Local opt-in: RUN_DB_INTEGRATION=1 DATABASE_URL=.../heart_of_house_test npm test
test('real PostgreSQL recipe costing, prep, and checklist workflows', {
  skip: process.env.RUN_DB_INTEGRATION !== '1'
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  assert(connectionString, 'DATABASE_URL is required');
  const databaseName = decodeURIComponent(new URL(connectionString).pathname.slice(1));
  assert(databaseName.endsWith('_test'), 'Refusing to run integration tests outside a *_test database');

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000, query_timeout: 10000 });
  const server = createApp(pool).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1/restaurants`;
  let restaurantId = '';

  async function send(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method, signal: AbortSignal.timeout(10000),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  }

  try {
    const created = await send('', 'POST', { name: 'CI Kitchen ' + Date.now() });
    assert.equal(created.status, 201);
    restaurantId = created.data.restaurant.restaurant_id;
    const root = `/${restaurantId}`;

    const flour = await send(root + '/ingredients', 'POST', {
      name: '  Flour  ', purchase_unit: 'lb', purchase_quantity: 25, purchase_price: 18.50
    });
    assert.equal(flour.status, 201);
    assert.equal(flour.data.ingredient.name, 'Flour');
    const duplicate = await send(root + '/ingredients', 'POST', {
      name: ' flour ', purchase_unit: 'lb', purchase_quantity: 1, purchase_price: 1
    });
    assert.equal(duplicate.status, 409);

    const unpriced = await send(root + '/ingredients', 'POST', {
      name: 'Water', purchase_unit: 'ml', purchase_quantity: 1000, purchase_price: null
    });
    assert.equal(unpriced.status, 201);
    assert.equal(unpriced.data.ingredient.purchase_price, null);

    const recipeBody = {
      name: 'Test Dough', instructions: 'Mix thoroughly', yield_quantity: 8,
      yield_unit: 'portion', ingredients: [
        { ingredient_id: flour.data.ingredient.ingredient_id, quantity: 16, unit: 'oz' },
        { ingredient_id: unpriced.data.ingredient.ingredient_id, quantity: 100, unit: 'ml' }
      ]
    };
    const recipe = await send(root + '/recipes', 'POST', recipeBody);
    assert.equal(recipe.status, 201);
    const recipeId = recipe.data.recipe.recipe_id;
    const unavailable = await send(root + '/recipes/' + recipeId);
    assert.equal(unavailable.status, 200);
    assert.equal(unavailable.data.recipe.costing.batch_cost, null);
    const flourLine = unavailable.data.recipe.ingredients.find(
      (item: { ingredient_id: string }) => item.ingredient_id === flour.data.ingredient.ingredient_id
    );
    assert.equal(Number(flourLine.quantity), 1);
    assert.equal(flourLine.unit, 'lb');
    assert.equal(Number(flourLine.original_quantity), 16);
    assert.equal(flourLine.original_unit, 'oz');

    const edited = await send(root + '/recipes/' + recipeId, 'PUT', {
      ...recipeBody, ingredients: [recipeBody.ingredients[0]]
    });
    assert.equal(edited.status, 200);
    const priced = await send(root + '/recipes/' + recipeId);
    assert.equal(priced.status, 200);
    assert.equal(Number(priced.data.recipe.costing.batch_cost), 0.74);
    assert.equal(Number(priced.data.recipe.costing.portion_cost), 0.0925);
    assert.equal(priced.data.recipe.ingredients.length, 1);

    const prep = await send(root + '/prep-lists', 'POST', {
      date: '2026-10-14', title: 'Prep', tasks: ['Slice tomatoes', 'Portion chicken']
    });
    assert.equal(prep.status, 201);
    const prepTaskId = prep.data.prep_list.tasks[0].prep_task_id;
    assert.equal((await send(root + '/prep-lists/tasks/' + prepTaskId, 'PATCH', { is_complete: true })).status, 200);
    const prepReload = await send(root + '/prep-lists?date=2026-10-14');
    assert.equal(prepReload.data.prep_list.tasks[0].is_complete, true);
    assert.equal((await send('/999999/prep-lists/tasks/' + prepTaskId, 'PATCH', { is_complete: false })).status, 404);

    const template = await send(root + '/checklists/templates', 'POST', {
      name: 'Open', checklist_type: 'opening', tasks: ['Check temperatures', 'Turn on equipment']
    });
    assert.equal(template.status, 201);
    const run = await send(root + '/checklists/runs', 'POST', {
      template_id: template.data.template.checklist_template_id, date: '2026-10-14', shift_label: 'Morning'
    });
    assert.equal(run.status, 201);
    const runTaskId = run.data.run.tasks[0].checklist_run_task_id;
    assert.equal((await send(root + '/checklists/runs/tasks/' + runTaskId, 'PATCH', { is_complete: true })).status, 200);
    const runReload = await send(root + '/checklists/runs?date=2026-10-14');
    assert.equal(runReload.data.runs[0].tasks[0].is_complete, true);
    assert.equal((await send('/999999/checklists/runs/tasks/' + runTaskId, 'PATCH', { is_complete: false })).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    try { if (restaurantId) await pool.query('DELETE FROM restaurants WHERE restaurant_id = $1', [restaurantId]); }
    finally { await pool.end(); }
  }
});
