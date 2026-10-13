import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app";
import { Database } from "../src/restaurants";

async function withApi(database: Database, run: (url: string) => Promise<void>) {
  const server = createApp(database).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("creates a reusable opening checklist template", async () => {
  await withApi({ async query(sql, values) { assert(sql.includes("INSERT INTO checklist_templates")); assert.deepEqual(values, ["3", "Open Kitchen", "opening", ["Turn on fryers", "Check walk-in"]]); return { rows: [{ checklist_template_id: "8", name: "Open Kitchen", tasks: [] }] }; } }, async url => {
    const response = await fetch(`${url}/api/v1/restaurants/3/checklists/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: " Open Kitchen ", checklist_type: "opening", tasks: [" Turn on fryers ", "Check walk-in"] }) });
    assert.equal(response.status, 201); assert.equal((await response.json()).template.checklist_template_id, "8");
  });
});

test("rejects invalid template and run input", async () => {
  await withApi({ async query() { assert.fail("Invalid input queried database"); } }, async url => {
    for (const body of [{ name: "", checklist_type: "opening", tasks: ["Task"] }, { name: "Close", checklist_type: "weekly", tasks: ["Task"] }, { name: "Close", checklist_type: "closing", tasks: [] }, { name: "Close", checklist_type: "closing", tasks: Array(51).fill("Task") }]) {
      assert.equal((await fetch(`${url}/api/v1/restaurants/1/checklists/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 400);
    }
    assert.equal((await fetch(`${url}/api/v1/restaurants/1/checklists/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template_id: "2", date: "2026-02-30", shift_label: "AM" }) })).status, 400);
  });
});

test("starts a dated shift run by copying its template tasks", async () => {
  await withApi({ async query(sql, values) { assert(sql.includes("INSERT INTO checklist_runs")); assert(sql.includes("INSERT INTO checklist_run_tasks")); assert.deepEqual(values, ["3", "8", "2026-10-13", "Dinner"]); return { rows: [{ checklist_run_id: "11", template_name: "Close Kitchen", tasks: [] }] }; } }, async url => {
    const response = await fetch(`${url}/api/v1/restaurants/3/checklists/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template_id: "8", date: "2026-10-13", shift_label: " Dinner " }) });
    assert.equal(response.status, 201); assert.equal((await response.json()).run.checklist_run_id, "11");
  });
});

test("loads runs by date and updates only restaurant-owned tasks", async () => {
  let call = 0;
  await withApi({ async query(sql, values) { call++; if (call === 1) { assert(sql.includes("FROM checklist_runs")); assert.deepEqual(values, ["7", "2026-10-13"]); return { rows: [{ checklist_run_id: "4", tasks: [] }] }; } assert(sql.startsWith("UPDATE checklist_run_tasks")); assert(sql.includes("cr.restaurant_id = $1")); assert.deepEqual(values, ["7", "9", true]); return { rows: [{ checklist_run_task_id: "9", is_complete: true }] }; } }, async url => {
    assert.equal((await fetch(`${url}/api/v1/restaurants/7/checklists/runs?date=2026-10-13`)).status, 200);
    const response = await fetch(`${url}/api/v1/restaurants/7/checklists/runs/tasks/9`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_complete: true }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).task.is_complete, true);
  });
});

test("reports duplicate runs without leaking database details", async () => {
  await withApi({ async query() { throw Object.assign(new Error("secret"), { code: "23505" }); } }, async url => {
    const response = await fetch(`${url}/api/v1/restaurants/1/checklists/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template_id: "2", date: "2026-10-13", shift_label: "AM" }) });
    assert.equal(response.status, 409); assert(!JSON.stringify(await response.json()).includes("secret"));
  });
});
