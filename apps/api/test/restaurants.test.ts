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

test('creates a trimmed restaurant using bound values and default timezone', async () => {
  let called = false;
  await withApi({ async query(sql, values) {
    called = true;
    assert.equal(sql, 'INSERT INTO restaurants (name, city, timezone) VALUES ($1, $2, $3) RETURNING *');
    assert.deepEqual(values, ["Sean's Kitchen", 'Lynchburg', 'America/New_York']);
    return { rows: [{ restaurant_id: '1', name: values![0] }] };
  } }, async url => {
    const response = await fetch(url + '/api/v1/restaurants', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: " Sean's Kitchen ", city: ' Lynchburg ' })
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).restaurant.name, "Sean's Kitchen");
  });
  assert(called);
});

test('rejects invalid input without querying the database', async () => {
  await withApi({ async query() { assert.fail('Invalid input reached database'); } }, async url => {
    for (const body of [{}, { name: ' ' }, { name: 42 }, { name: 'x'.repeat(151) },
      { name: 'Cafe', timezone: 'Mars/Olympus' }, { name: 'Cafe', timezone: '' },
      { name: 'Cafe', restaurant_id: 2 }, { name: 'Cafe', city: 23 }, [], null]) {
      const response = await fetch(url + '/api/v1/restaurants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      assert.equal(response.status, 400, JSON.stringify(body));
    }
  });
});

test('lists restaurants with a bounded stable query', async () => {
  await withApi({ async query(sql) {
    assert.equal(sql, 'SELECT * FROM restaurants ORDER BY restaurant_id LIMIT 100');
    return { rows: [{ restaurant_id: '1', name: 'Cafe' }] };
  } }, async url => {
    const response = await fetch(url + '/api/v1/restaurants');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { restaurants: [{ restaurant_id: '1', name: 'Cafe' }] });
  });
});

test('database failures return a generic error for both endpoints', async () => {
  await withApi({ async query() { throw new Error('private connection details'); } }, async url => {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(url + '/api/v1/restaurants', {
        method, headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ name: 'Cafe' }) } : {})
      });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: 'Restaurant service unavailable' });
    }
  });
});

test('malformed JSON and oversized bodies return JSON errors without database access', async () => {
  await withApi({ async query() { assert.fail('Bad body reached database'); } }, async url => {
    for (const [body, status] of [['{', 400], [JSON.stringify({ name: 'x'.repeat(110000) }), 413]] as const) {
      const response = await fetch(url + '/api/v1/restaurants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body
      });
      assert.equal(response.status, status);
      assert.equal(typeof (await response.json()).error, 'string');
    }
  });
});

test('health and unknown routes retain their response contract', async () => {
  await withApi({ async query(sql) { assert.equal(sql, 'SELECT 1'); return { rows: [] }; } }, async url => {
    const health = await fetch(url + '/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).database, 'connected');
    const missing = await fetch(url + '/missing');
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Not Found' });
  });
});
