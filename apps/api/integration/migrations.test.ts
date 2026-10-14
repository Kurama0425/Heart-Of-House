import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withDatabase } from './helpers';
import { runMigrations } from '../src/migrationRunner';
test('separate migration processes wait for one lock, preserve legacy data and apply each migration once', async () => {
  await withDatabase(async (db,admin,schema) => {
    const temp=await mkdtemp(path.join(tmpdir(),'hoh-legacy-'));
    try {
      await writeFile(path.join(temp,'001_initial_schema.sql'),await readFile('../../database/migrations/001_initial_schema.sql','utf8'));
      await runMigrations(db,temp);
      const r=(await db.query("INSERT INTO restaurants(name) VALUES('Legacy Kitchen') RETURNING restaurant_id")).rows[0];
      const i=(await db.query("INSERT INTO ingredients(restaurant_id,name,purchase_unit,purchase_quantity,purchase_price) VALUES($1,'Legacy Flour','lb',25,0) RETURNING ingredient_id",[r.restaurant_id])).rows[0];
      const recipe=(await db.query("INSERT INTO recipes(restaurant_id,name) VALUES($1,'Legacy Dough') RETURNING recipe_id",[r.restaurant_id])).rows[0];
      await db.query("INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit) VALUES($1,$2,2,'lb')",[recipe.recipe_id,i.ingredient_id]);
      const lock=await admin.connect(); await lock.query('SELECT pg_advisory_lock(72425,1)');
      const applicationName='migrate_'+schema;
      const connection=new URL(process.env.TEST_DATABASE_URL!); connection.searchParams.set('options','-c search_path='+schema); connection.searchParams.set('application_name',applicationName);
      const children: ReturnType<typeof spawn>[]=[];
      const outcomes: Promise<{code:number|null;output:string}>[]=[];
      try {
        for(let n=0;n<2;n++) {
          const child=spawn(process.execPath,['--import','tsx','src/migrate.ts'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:connection.toString()},stdio:['ignore','pipe','pipe']}); children.push(child);
          outcomes.push(new Promise((resolve,reject)=>{let output='';child.stdout!.on('data',d=>output+=d);child.stderr!.on('data',d=>output+=d);child.on('error',reject);child.on('close',code=>resolve({code,output}));}));
        }
        let waiting=0;
        for(let attempt=0;attempt<100;attempt++) {
          waiting=Number((await admin.query("SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[applicationName])).rows[0].count);
          if(waiting===2) break; await new Promise(r=>setTimeout(r,50));
        }
        assert.equal(waiting,2,'Both separate processes should wait behind the held migration lock');
      } finally { await lock.query('SELECT pg_advisory_unlock(72425,1)');lock.release(); }
      const results=await Promise.all(outcomes); for(const result of results) assert.equal(result.code,0,result.output);
      const files=(await readdir('../../database/migrations')).filter(f=>f.endsWith('.sql'));
      assert.equal(Number((await db.query('SELECT count(*) FROM schema_migrations')).rows[0].count),files.length);
      assert.equal(results.map(r=>r.output).join('').match(/Applied /g)?.length,files.length-1);
      await runMigrations(db);
      assert.equal((await db.query('SELECT name FROM restaurants WHERE restaurant_id=$1',[r.restaurant_id])).rows[0].name,'Legacy Kitchen');
      const line=(await db.query('SELECT * FROM recipe_ingredients WHERE recipe_id=$1',[recipe.recipe_id])).rows[0];
      assert.equal(line.original_quantity,'2.0000'); assert.equal(line.original_unit,'lb');
      assert.equal((await db.query('SELECT purchase_price FROM ingredients WHERE ingredient_id=$1',[i.ingredient_id])).rows[0].purchase_price,'0.00');
      await writeFile(path.join(temp,'999_failed.sql'),'CREATE TABLE rollback_probe(id integer); SELECT 1/0;');
      await assert.rejects(runMigrations(db,temp));
      assert.equal((await db.query("SELECT to_regclass('rollback_probe') AS table_name")).rows[0].table_name,null);
      assert.equal((await db.query("SELECT count(*) FROM schema_migrations WHERE migration_name='999_failed.sql'")).rows[0].count,'0');
      const check=await admin.connect(); try { assert.equal((await check.query('SELECT pg_try_advisory_lock(72425,1) AS locked')).rows[0].locked,true); await check.query('SELECT pg_advisory_unlock(72425,1)'); } finally {check.release();}
    } finally { await rm(temp,{recursive:true,force:true}); }
  },false);
});
