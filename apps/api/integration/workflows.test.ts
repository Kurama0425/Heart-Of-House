import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createApp } from "../src/app";

test("PostgreSQL kitchen workflows, isolation, costing and migrations", async () => {
  assert(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL to a disposable PostgreSQL database");
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = `hoh_test_${Date.now()}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  async function call(path: string, method = "GET", body?: unknown, status = 200) {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
  }
  try {
    for (const file of (await readdir("../../database/migrations")).filter(f => f.endsWith(".sql")).sort()) {
      await db.query(await readFile(`../../database/migrations/${file}`, "utf8"));
    }
    assert.equal((await call("/api/v1/restaurants")).restaurants.length, 0);
    const r = (await call("/api/v1/restaurants", "POST", { name: "Test Kitchen" }, 201)).restaurant;
    const other = (await call("/api/v1/restaurants", "POST", { name: "Other Kitchen" }, 201)).restaurant;
    const url = `/api/v1/restaurants/${r.restaurant_id}`;
    await call(url, "PATCH", { name: "Updated Kitchen" });
    assert.equal((await call(url)).restaurant.name, "Updated Kitchen");
    const purchase = { name: "Flour", purchase_unit: "lb", purchase_quantity: 25, purchase_price: 18.5 };
    const i = (await call(`${url}/ingredients`, "POST", purchase, 201)).ingredient;
    const butter = (await call(`${url}/ingredients`, "POST", { ...purchase, name: "Butter", purchase_quantity: 1, purchase_price: 4 }, 201)).ingredient;
    await call(`${url}/ingredients`, "POST", purchase, 409);
    const recipeBody = { name: "Dough", instructions: "Mix", yield_quantity: 8, yield_unit: "portion", ingredients: [{ ingredient_id: i.ingredient_id, quantity: 16, unit: "oz" }, { ingredient_id: butter.ingredient_id, quantity: 1, unit: "lb" }] };
    const recipe = (await call(`${url}/recipes`, "POST", recipeBody, 201)).recipe;
    let detail = (await call(`${url}/recipes/${recipe.recipe_id}`)).recipe;
    assert.equal(Number(detail.costing.batch_cost), 4.74);
    assert.equal(Number(detail.ingredients.find((line: any) => line.ingredient_id === i.ingredient_id).quantity), 1);
    await call(`${url}/recipes/${recipe.recipe_id}`, "PUT", { ...recipeBody, ingredients: [{ ingredient_id: i.ingredient_id, quantity: 2, unit: "lb" }] });
    detail = (await call(`${url}/recipes/${recipe.recipe_id}`)).recipe;
    assert.equal(detail.ingredients.length, 1); assert.equal(Number(detail.costing.batch_cost), 1.48);
    await call(`${url}/ingredients/${i.ingredient_id}`, "PUT", { ...purchase, purchase_price: 25 });
    assert.equal(Number((await call(`${url}/recipes/${recipe.recipe_id}`)).recipe.costing.portion_cost), 0.25);
    await call(`${url}/ingredients/${i.ingredient_id}`, "PUT", { ...purchase, purchase_unit: "kg" }, 409);
    await call(`/api/v1/restaurants/${other.restaurant_id}/ingredients/${i.ingredient_id}`, "PUT", purchase, 404);
    await call(`/api/v1/restaurants/${other.restaurant_id}/recipes/${recipe.recipe_id}`, "GET", undefined, 404);
    await call(`/api/v1/restaurants/${other.restaurant_id}/recipes`, "POST", recipeBody, 400);
    const prep = (await call(`${url}/prep-lists`, "POST", { date: "2026-10-14", title: "Prep", tasks: ["Portion dough"] }, 201)).prep_list;
    await call(`${url}/prep-lists/tasks/${prep.tasks[0].prep_task_id}`, "PATCH", { is_complete: true });
    assert.equal((await call(`${url}/prep-lists?date=2026-10-14`)).prep_list.tasks[0].is_complete, true);
    await call(`/api/v1/restaurants/${other.restaurant_id}/prep-lists/tasks/${prep.tasks[0].prep_task_id}`, "PATCH", { is_complete: false }, 404);
    const template = (await call(`${url}/checklists/templates`, "POST", { name: "Open", checklist_type: "opening", tasks: ["Stock line"] }, 201)).template;
    const run = (await call(`${url}/checklists/runs`, "POST", { template_id: template.checklist_template_id, date: "2026-10-14", shift_label: "Morning" }, 201)).run;
    await call(`${url}/checklists/runs/tasks/${run.tasks[0].checklist_run_task_id}`, "PATCH", { is_complete: true });
    assert.equal((await call(`${url}/checklists/runs?date=2026-10-14`)).runs[0].tasks[0].is_complete, true);
    await call(`/api/v1/restaurants/${other.restaurant_id}/checklists/runs/tasks/${run.tasks[0].checklist_run_task_id}`, "PATCH", { is_complete: false }, 404);
    await call("/health");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  }
});
