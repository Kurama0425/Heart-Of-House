import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { runMigrations } from '../src/migrationRunner';
export async function withDatabase(run: (db: Pool, admin: Pool, schema: string, url: string) => Promise<void>, migrate = true) {
  assert(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL is required');
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 });
  const schema = 'hoh_' + randomUUID().replace(/-/g, '');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}`, application_name: schema, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  const server = createApp(db).listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const a = server.address(); assert(a && typeof a !== 'string');
  try { if (migrate) await runMigrations(db); await run(db, admin, schema, `http://127.0.0.1:${a.port}`); }
  finally {
    await new Promise<void>(r => server.close(()=>r()));
    await db.end();
    try { await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin.end(); }
  }
}
export function api(url: string) {
  return async (path: string, method = 'GET', body?: unknown, status = 200) => {
    const response = await fetch(url + path, { method, headers: {'Content-Type':'application/json'}, signal: AbortSignal.timeout(15000), body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data;
  };
}
