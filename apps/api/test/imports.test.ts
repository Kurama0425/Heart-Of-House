import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
test('imports validate confirmation, IDs, body/CSV size and unavailable database without leaking internals', async () => {
  const app = createApp({ async query() { throw new Error('private connection password'); } });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const a=server.address(); assert(a && typeof a !== 'string'); const base=`http://127.0.0.1:${a.port}/api/v1/restaurants`;
  async function post(path: string, body: unknown, status: number) {
    const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(response.status,status); assert(!JSON.stringify(await response.json()).includes('password'));
  }
  try {
    await post('/0/imports/preview',{ingredients_csv:'name\nx'},400);
    await post('/1/imports/preview',{},400);
    await post('/1/imports/preview',{ingredients_csv:12},400);
    await post('/1/imports/preview',{ingredients_csv:'name\nx', overwrite:true},400);
    await post('/1/imports/not-a-uuid/commit',{confirm:true},400);
    await post('/1/imports/00000000-0000-0000-0000-000000000001/commit',{confirm:false},400);
    await post('/1/imports/preview',{ingredients_csv:'name\nx'},503);
    await post('/1/imports/preview',{ingredients_csv:'x'.repeat(2100000)},413);
  } finally { await new Promise<void>(r => server.close(()=>r())); }
});
test('untrusted websites cannot use the local API; configured development origin works', async () => {
  const server=createApp({async query(){return {rows:[]};}}).listen(0,'127.0.0.1'); await new Promise<void>(r=>server.once('listening',r));
  const a=server.address(); assert(a && typeof a!=='string'); const url=`http://127.0.0.1:${a.port}/health`;
  try {
    assert.equal((await fetch(url,{headers:{Origin:'https://untrusted.example'}})).status,403);
    const response=await fetch(url,{headers:{Origin:'http://localhost:5173'}}); assert.equal(response.status,200); assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost:5173');
  } finally {await new Promise<void>(r=>server.close(()=>r()));}
});
