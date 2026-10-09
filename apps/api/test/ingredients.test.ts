import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { Database } from '../src/restaurants';

async function withApi(database: Database, run: (url: string) => Promise<void>) {
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

test('creates an ingredient using bound values and trimmed labels', async () => {
  await withApi({ async query(sql, values) {
    assert(sql.startsWith('INSERT INTO ingredients'));
    assert.deepEqual(values, ['1', 'Flour', 'lb', 25, 18.5]);
    return { rows: [{ ingredient_id: '2', name: 'Flour' }] };
  } }, async url => {
    const response = await fetch(url + '/api/v1/restaurants/1/ingredients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: ' Flour ', purchase_unit: ' lb ', purchase_quantity: 25, purchase_price: 18.5 }) });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).ingredient.name, 'Flour');
  });
});
test('invalid ingredient input never reaches the database', async () => {
  const valid = { name: 'Flour', purchase_unit: 'lb', purchase_quantity: 25, purchase_price: 0 };
  await withApi({ async query() { assert.fail('Invalid input queried database'); } }, async url => {
    for (const body of [{ ...valid, name: ' ' }, { ...valid, purchase_unit: '' }, { ...valid, purchase_quantity: 0 }, { ...valid, purchase_quantity: '25' }, { ...valid, purchase_quantity: 1.12345 }, { ...valid, purchase_price: -1 }, { ...valid, purchase_price: 1.234 }, { ...valid, purchase_price: 1e10 }, { ...valid, name: 'x'.repeat(151) }, { ...valid, extra: true }, {}]) {
      const response = await fetch(url + '/api/v1/restaurants/1/ingredients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
    }
    assert.equal((await fetch(url + '/api/v1/restaurants/0/ingredients')).status, 400);
  });
});
test('lists only the requested restaurant ingredients', async () => {
  await withApi({ async query(sql, values) {
    assert.deepEqual(values, ['7']);
    return { rows: sql.startsWith('SELECT restaurant_id') ? [{ restaurant_id: '7' }] : [{ ingredient_id: '1', name: 'Flour' }] };
  } }, async url => {
    const response = await fetch(url + '/api/v1/restaurants/7/ingredients');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ingredients[0].name, 'Flour');
  });
});
test('missing restaurants and duplicates have clear responses', async () => {
  for (const [code, status] of [['23503', 404], ['23505', 409], ['08006', 503]] as const) {
    await withApi({ async query() { throw Object.assign(new Error('database failure'), { code }); } }, async url => {
      const response = await fetch(url + '/api/v1/restaurants/1/ingredients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Flour', purchase_unit: 'lb', purchase_quantity: 1, purchase_price: 0 }) });
      assert.equal(response.status, status);
      assert(!JSON.stringify(await response.json()).includes('database failure'));
    });
  }
  await withApi({ async query() { return { rows: [] }; } }, async url => {
    assert.equal((await fetch(url + '/api/v1/restaurants/123/ingredients')).status, 404);
  });
});
