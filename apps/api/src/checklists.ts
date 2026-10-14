import { Router } from "express";
import { Database, TransactionClient } from "./restaurants";

const validId = (value: unknown) => typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const validDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const text = (value: unknown, limit: number) => typeof value === "string" && !!value.trim() && [...value.trim()].length <= limit;

export function checklistRoutes(database: Database) {
  const router = Router({ mergeParams: true });
  router.use((req, res, next) => {
    if (!validId(req.params.restaurantId)) { res.status(400).json({ error: "Invalid restaurant ID" }); return; }
    next();
  });

  router.get<{ restaurantId: string; templateId?: string }>("/templates/:templateId?", async (req, res) => {
    if (req.params.templateId !== undefined && !validId(req.params.templateId)) { res.status(400).json({ error: "Invalid template ID" }); return; }
    try {
      const result = await database.query(
        `SELECT ct.checklist_template_id, ct.name, ct.checklist_type,
                COALESCE(json_agg(json_build_object('description', ctt.description, 'position', ctt.position)
                  ORDER BY ctt.position) FILTER (WHERE ctt.checklist_template_task_id IS NOT NULL), '[]') AS tasks
         FROM checklist_templates ct LEFT JOIN checklist_template_tasks ctt USING (checklist_template_id)
         WHERE ct.restaurant_id = $1 AND ($2::bigint IS NULL OR ct.checklist_template_id = $2) GROUP BY ct.checklist_template_id ORDER BY ct.checklist_type, ct.name`,
        [req.params.restaurantId, req.params.templateId ?? null]
      );
      if (req.params.templateId) {
        if (!result.rows.length) { res.status(404).json({ error: "Checklist template not found" }); return; }
        res.json({ template: result.rows[0] });
      } else res.json({ templates: result.rows });
    } catch (error) {
      console.error("Checklist template lookup failed:", error);
      res.status(503).json({ error: "Checklist service unavailable" });
    }
  });

  router.post<{ restaurantId: string }>("/templates", async (req, res) => {
    const body = req.body;
    const allowed = ["name", "checklist_type", "tasks"];
    const validShape = body && typeof body === "object" && !Array.isArray(body) && !Object.keys(body).some(key => !allowed.includes(key));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const tasks = Array.isArray(body?.tasks) ? body.tasks.map((task: unknown) => typeof task === "string" ? task.trim() : task) : [];
    if (!validShape || !text(name, 150) || !["opening", "closing"].includes(body.checklist_type) || tasks.length < 1 || tasks.length > 50 || tasks.some((task: unknown) => !text(task, 300))) {
      res.status(400).json({ error: "Provide a name, opening or closing type, and 1–50 nonblank tasks" }); return;
    }
    try {
      const result = await database.query(
        `WITH template AS (
           INSERT INTO checklist_templates (restaurant_id, name, checklist_type) VALUES ($1, $2, $3)
           RETURNING checklist_template_id, name, checklist_type
         ), tasks AS (
           INSERT INTO checklist_template_tasks (checklist_template_id, description, position)
           SELECT template.checklist_template_id, task.description, (task.position - 1)::integer
           FROM template, unnest($4::text[]) WITH ORDINALITY AS task(description, position)
           RETURNING checklist_template_id, description, position
         )
         SELECT template.*, json_agg(json_build_object('description', tasks.description, 'position', tasks.position) ORDER BY tasks.position) AS tasks
         FROM template JOIN tasks USING (checklist_template_id) GROUP BY template.checklist_template_id, template.name, template.checklist_type`,
        [req.params.restaurantId, name, body.checklist_type, tasks]
      );
      res.status(201).json({ template: result.rows[0] });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23503") { res.status(404).json({ error: "Restaurant not found" }); return; }
      if (code === "23505") { res.status(409).json({ error: "A checklist template with that name already exists" }); return; }
      console.error("Checklist template creation failed:", error);
      res.status(503).json({ error: "Checklist service unavailable" });
    }
  });

  router.put<{ restaurantId: string; templateId: string }>("/templates/:templateId", async (req, res) => {
    const body = req.body;
    if (!validId(req.params.templateId) || !body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some(k => !["name", "checklist_type", "tasks"].includes(k)) ||
      !text(body.name, 150) || !["opening", "closing"].includes(body.checklist_type) || !Array.isArray(body.tasks) || !body.tasks.length || body.tasks.length > 50 || body.tasks.some((task: unknown) => !text(task, 300))) {
      res.status(400).json({ error: "Provide a valid template ID, name, opening/closing type and 1–50 tasks" }); return;
    }
    let client: TransactionClient | undefined, committed = false;
    try {
      if (!database.connect) throw new Error("Transaction connection required");
      client = await database.connect(); await client.query("BEGIN");
      const target = await client.query("SELECT checklist_template_id FROM checklist_templates WHERE restaurant_id = $1 AND checklist_template_id = $2 FOR UPDATE", [req.params.restaurantId, req.params.templateId]);
      if (!target.rows.length) { res.status(404).json({ error: "Checklist template not found" }); return; }
      const updated = await client.query("UPDATE checklist_templates SET name = $3, checklist_type = $4 WHERE restaurant_id = $1 AND checklist_template_id = $2 RETURNING checklist_template_id, name, checklist_type", [req.params.restaurantId, req.params.templateId, body.name.trim(), body.checklist_type]);
      await client.query("DELETE FROM checklist_template_tasks WHERE checklist_template_id = $1", [req.params.templateId]);
      const tasks = await client.query(`INSERT INTO checklist_template_tasks (checklist_template_id, description, position)
        SELECT $1, t.description, (t.position - 1)::integer FROM unnest($2::text[]) WITH ORDINALITY AS t(description, position) RETURNING description, position`, [req.params.templateId, body.tasks.map((task: string) => task.trim())]);
      await client.query("COMMIT"); committed = true;
      res.json({ template: { ...updated.rows[0], tasks: tasks.rows } });
    } catch (error) { res.status((error as {code?:string}).code === "23505" ? 409 : 503).json({ error: (error as {code?:string}).code === "23505" ? "A template with that name already exists" : "Checklist service unavailable" }); }
    finally { if (client) { if (!committed) await client.query("ROLLBACK").catch(() => {}); client.release(); } }
  });

  router.get<{ restaurantId: string }>("/runs", async (req, res) => {
    if (!validDate(req.query.date)) { res.status(400).json({ error: "date must be a real calendar date in YYYY-MM-DD format" }); return; }
    try {
      const result = await database.query(
        `SELECT cr.checklist_run_id, cr.run_date::text AS run_date, cr.shift_label, cr.template_name, cr.checklist_type,
                COALESCE(json_agg(json_build_object('checklist_run_task_id', crt.checklist_run_task_id::text,
                  'description', crt.description, 'position', crt.position, 'is_complete', crt.is_complete)
                  ORDER BY crt.position) FILTER (WHERE crt.checklist_run_task_id IS NOT NULL), '[]') AS tasks
         FROM checklist_runs cr LEFT JOIN checklist_run_tasks crt USING (checklist_run_id)
         WHERE cr.restaurant_id = $1 AND cr.run_date = $2 GROUP BY cr.checklist_run_id ORDER BY cr.created_at`,
        [req.params.restaurantId, req.query.date]
      );
      res.json({ runs: result.rows });
    } catch (error) {
      console.error("Checklist run lookup failed:", error);
      res.status(503).json({ error: "Checklist service unavailable" });
    }
  });

  router.post<{ restaurantId: string }>("/runs", async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["template_id", "date", "shift_label"].includes(key)) || !validId(body.template_id) || !validDate(body.date) || !text(body.shift_label, 80)) {
      res.status(400).json({ error: "Provide a valid template, date, and shift label up to 80 characters" }); return;
    }
    try {
      const result = await database.query(
        `WITH run AS (
           INSERT INTO checklist_runs (restaurant_id, checklist_template_id, run_date, shift_label, template_name, checklist_type)
           SELECT $1, ct.checklist_template_id, $3, $4, ct.name, ct.checklist_type
           FROM checklist_templates ct WHERE ct.restaurant_id = $1 AND ct.checklist_template_id = $2
           RETURNING checklist_run_id, run_date::text AS run_date, shift_label, template_name, checklist_type
         ), tasks AS (
           INSERT INTO checklist_run_tasks (checklist_run_id, description, position)
           SELECT run.checklist_run_id, ctt.description, ctt.position FROM run
           JOIN checklist_template_tasks ctt ON ctt.checklist_template_id = $2
           RETURNING checklist_run_id, checklist_run_task_id, description, position, is_complete
         )
         SELECT run.*, json_agg(json_build_object('checklist_run_task_id', tasks.checklist_run_task_id::text,
           'description', tasks.description, 'position', tasks.position, 'is_complete', tasks.is_complete) ORDER BY tasks.position) AS tasks
         FROM run JOIN tasks USING (checklist_run_id) GROUP BY run.checklist_run_id, run.run_date, run.shift_label, run.template_name, run.checklist_type`,
        [req.params.restaurantId, body.template_id, body.date, body.shift_label.trim()]
      );
      if (!result.rows.length) { res.status(404).json({ error: "Checklist template not found" }); return; }
      res.status(201).json({ run: result.rows[0] });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") { res.status(409).json({ error: "That checklist has already been started for this date and shift" }); return; }
      console.error("Checklist run creation failed:", error);
      res.status(503).json({ error: "Checklist service unavailable" });
    }
  });

  router.patch<{ restaurantId: string; taskId: string }>("/runs/tasks/:taskId", async (req, res) => {
    if (!validId(req.params.taskId) || !req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length !== 1 || typeof req.body.is_complete !== "boolean") {
      res.status(400).json({ error: "Provide a valid task ID and boolean is_complete" }); return;
    }
    try {
      const result = await database.query(
        `UPDATE checklist_run_tasks crt SET is_complete = $3, completed_at = CASE WHEN $3 THEN NOW() ELSE NULL END, updated_at = NOW()
         FROM checklist_runs cr WHERE crt.checklist_run_id = cr.checklist_run_id AND cr.restaurant_id = $1 AND crt.checklist_run_task_id = $2
         RETURNING crt.checklist_run_task_id, crt.description, crt.position, crt.is_complete`,
        [req.params.restaurantId, req.params.taskId, req.body.is_complete]
      );
      if (!result.rows.length) { res.status(404).json({ error: "Checklist task not found" }); return; }
      res.json({ task: result.rows[0] });
    } catch (error) {
      console.error("Checklist task update failed:", error);
      res.status(503).json({ error: "Checklist service unavailable" });
    }
  });

  return router;
}
