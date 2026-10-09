import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { Database } from '../src/restaurants';
import { purchaseQuantity } from '../src/recipeUnits';
const valid = { name: ' Dough ', instructions: ' Mix and knead. ', yield_quantity: 8, yield_unit: 'portion', ingredients: [{ ingredient_id: '2', quantity: 16, unit: 'oz' }] };
async function withApi(database: Database, run: (url: string) => Promise<void>) {
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const address = server.address(); assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}/api/v1/restaurants/1/recipes`); }
  finally { await new Promise<void>((r,j) => server.close(e => e ? j(e) : r())); }
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('converts compatible units and rejects volume/weight and unknown-unit mismatches', () => {
  assert.equal(purchaseQuantity(16, 'oz', 'lb'), 1);
  assert.equal(purchaseQuantity(1000, 'g', 'kg'), 1);
  assert.equal(purchaseQuantity(4, 'cup', 'qt'), 1);
  assert.equal(purchaseQuantity(2, 'each', 'each'), 2);
  assert.equal(purchaseQuantity(1, 'cup', 'lb'), null);
  assert.equal(purchaseQuantity(1, 'case', 'each'), null);
});
test('saves parent and converted ingredient lines in one bound SQL statement', async () => {
  let calls = 0;
  await withApi({ async query(sql, values) {
    calls++;
    if (calls === 1) { assert.deepEqual(values, ['1', ['2']]); return { rows: [{ ingredient_id: '2', name: 'Flour', purchase_unit: 'lb' }] }; }
    assert(sql.includes('WITH items')); assert(sql.includes('INSERT INTO recipe_ingredients'));
    assert.deepEqual(values?.slice(0, 5), ['1', 'Dough', 'Mix and knead.', 8, 'portion']);
    assert.deepEqual(JSON.parse(values?.[5] as string), [{ ingredient_id: '2', quantity: 1, unit: 'lb' }]);
    return { rows: [{ recipe_id: '3', name: 'Dough' }] };
  } }, async url => { assert.equal((await post(url, valid)).status, 201); });
  assert.equal(calls, 2);
});
test('rejects invalid quantities, duplicate ingredients, excessive precision and unknown fields before querying', async () => {
  await withApi({ async query() { assert.fail('Invalid input reached database'); } }, async url => {
    for (const body of [{ ...valid, name: '' }, { ...valid, instructions: ' ' }, { ...valid, yield_quantity: 0 }, { ...valid, yield_quantity: 1.12345 }, { ...valid, ingredients: [] }, { ...valid, ingredients: [...valid.ingredients, ...valid.ingredients] }, { ...valid, ingredients: [{ ingredient_id: '2', quantity: -1, unit: 'lb' }] }, { ...valid, extra: true }]) assert.equal((await post(url, body)).status, 400);
    assert.equal((await fetch(url + '/0')).status, 400);
  });
});
test('rejects ingredients from another restaurant and incompatible units without saving', async () => {
  for (const rows of [[], [{ ingredient_id: '2', name: 'Flour', purchase_unit: 'cup' }]]) {
    await withApi({ async query(sql) { assert(sql.startsWith('SELECT * FROM ingredients')); return { rows }; } }, async url => { assert.equal((await post(url, valid)).status, 400); });
  }
});
test('lists and retrieves recipe details scoped to the requested restaurant', async () => {
  await withApi({ async query(sql, values) {
    assert.equal(values?.[0], '1');
    if (sql.startsWith('SELECT restaurant_id')) return { rows: [{ restaurant_id: '1' }] };
    if (sql.includes('recipe_ingredients')) { assert.deepEqual(values, ['1', '3']); return { rows: [{ ingredient_id: '2', name: 'Flour', quantity: '1', unit: 'lb' }] }; }
    return { rows: [{ recipe_id: '3', name: 'Dough' }] };
  } }, async url => {
    assert.equal((await (await fetch(url)).json()).recipes[0].name, 'Dough');
    assert.equal((await (await fetch(url + '/3')).json()).recipe.ingredients[0].name, 'Flour');
  });
});
test('returns missing and conflict responses and hides database errors', async () => {
  await withApi({ async query() { return { rows: [] }; } }, async url => { assert.equal((await fetch(url)).status, 404); });
  for (const [code,status] of [['23505',409],['08006',503]] as const) {
    let calls = 0;
    await withApi({ async query() { if (++calls === 1) return { rows: [{ ingredient_id: '2', name: 'Flour', purchase_unit: 'lb' }] }; throw Object.assign(new Error('private details'), { code }); } }, async url => {
      const response = await post(url, valid); assert.equal(response.status, status); assert(!JSON.stringify(await response.json()).includes('private details'));
    });
  }
});
