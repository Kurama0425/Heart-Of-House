import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from '../src/request.ts';

test('request rejects malformed success responses and preserves API errors', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html>proxy page</html>', { status: 200 });
    await assert.rejects(request('/api'), /Unexpected API response/);
    globalThis.fetch = async () => new Response('not JSON', { status: 502 });
    await assert.rejects(request('/api'), /Unexpected API response/);
    globalThis.fetch = async () => Response.json({ error: 'Price conflict' }, { status: 409 });
    await assert.rejects(request('/api'), /Price conflict/);
    globalThis.fetch = async () => Response.json({ ingredient: { purchase_price: null } });
    assert.deepEqual(await request('/api'), { ingredient: { purchase_price: null } });
  } finally { globalThis.fetch = original; }
});
