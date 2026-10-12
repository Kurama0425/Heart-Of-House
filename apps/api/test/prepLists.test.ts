import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app";
import { Database } from "../src/restaurants";

async function withApi(database: Database, run: (url: string) => Promise<void>) {
  const server = createApp(database).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("creates a dated prep list and trims its tasks", async () => {
  await withApi({ async query(sql, values) {
    assert(sql.includes("INSERT INTO prep_lists"));
    assert.deepEqual(values, ["4", "2026-10-12", "Morning Prep", ["Portion chicken", "Make ranch"]]);
    return { rows: [{ prep_list_id: "9", title: "Morning Prep", tasks: [] }] };
  } }, async url => {
    const response = await fetch(`${url}/api/v1/restaurants/4/prep-lists`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-10-12", title: " Morning Prep ", tasks: [" Portion chicken ", "Make ranch"] })
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).prep_list.title, "Morning Prep");
  });
});

test("rejects invalid dates, blank tasks, too many tasks, and extra fields", async () => {
  await withApi({ async query() { assert.fail("Invalid input queried database"); } }, async url => {
    const valid = { date: "2026-10-12", title: "Prep", tasks: ["Slice onions"] };
    for (const body of [
      { ...valid, date: "2026-02-30" }, { ...valid, title: " " }, { ...valid, tasks: [] },
      { ...valid, tasks: [" "] }, { ...valid, tasks: Array(51).fill("Task") }, { ...valid, extra: true }
    ]) {
      const response = await fetch(`${url}/api/v1/restaurants/4/prep-lists`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      assert.equal(response.status, 400);
    }
    assert.equal((await fetch(`${url}/api/v1/restaurants/4/prep-lists?date=10-12-2026`)).status, 400);
  });
});

test("loads one restaurant prep list by date", async () => {
  await withApi({ async query(sql, values) {
    assert(sql.includes("FROM prep_lists"));
    assert.deepEqual(values, ["7", "2026-10-12"]);
    return { rows: [{ prep_list_id: "3", tasks: [{ prep_task_id: "8", is_complete: false }] }] };
  } }, async url => {
    const response = await fetch(`${url}/api/v1/restaurants/7/prep-lists?date=2026-10-12`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).prep_list.prep_list_id, "3");
  });
});

test("checks off only a task belonging to the requested restaurant", async () => {
  await withApi({ async query(sql, values) {
    assert(sql.startsWith("UPDATE prep_tasks"));
    assert(sql.includes("pl.restaurant_id = $1"));
    assert.deepEqual(values, ["7", "8", true]);
    return { rows: [{ prep_task_id: "8", is_complete: true }] };
  } }, async url => {
    const response = await fetch(`${url}/api/v1/restaurants/7/prep-lists/tasks/8`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_complete: true })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).task.is_complete, true);
  });
});

test("reports duplicate dates, missing tasks, and database failures safely", async () => {
  const valid = { date: "2026-10-12", title: "Prep", tasks: ["Task"] };
  await withApi({ async query() { throw Object.assign(new Error("secret database failure"), { code: "23505" }); } }, async url => {
    const response = await fetch(`${url}/api/v1/restaurants/1/prep-lists`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valid)
    });
    assert.equal(response.status, 409);
    assert(!JSON.stringify(await response.json()).includes("secret"));
  });
  await withApi({ async query() { return { rows: [] }; } }, async url => {
    const response = await fetch(`${url}/api/v1/restaurants/1/prep-lists/tasks/99`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_complete: false })
    });
    assert.equal(response.status, 404);
  });
});
