import { Router } from "express";
import { Database } from "./restaurants";

const validId = (value: unknown) =>
  typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const validDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

export function prepListRoutes(database: Database) {
  const router = Router({ mergeParams: true });

  router.use((req, res, next) => {
    if (!validId(req.params.restaurantId)) {
      res.status(400).json({ error: "Invalid restaurant ID" });
      return;
    }
    next();
  });

  router.get<{ restaurantId: string }>("/", async (req, res) => {
    const date = req.query.date;
    if (!validDate(date)) {
      res.status(400).json({ error: "date must be a real calendar date in YYYY-MM-DD format" });
      return;
    }
    try {
      const result = await database.query(
        `SELECT pl.prep_list_id, pl.prep_date, pl.title,
                COALESCE(json_agg(json_build_object(
                  'prep_task_id', pt.prep_task_id,
                  'description', pt.description,
                  'position', pt.position,
                  'is_complete', pt.is_complete,
                  'completed_at', pt.completed_at
                ) ORDER BY pt.position) FILTER (WHERE pt.prep_task_id IS NOT NULL), '[]') AS tasks
         FROM prep_lists pl
         LEFT JOIN prep_tasks pt ON pt.prep_list_id = pl.prep_list_id
         WHERE pl.restaurant_id = $1 AND pl.prep_date = $2
         GROUP BY pl.prep_list_id`,
        [req.params.restaurantId, date]
      );
      res.json({ prep_list: result.rows[0] ?? null });
    } catch (error) {
      console.error("Prep list lookup failed:", error);
      res.status(503).json({ error: "Prep list service unavailable" });
    }
  });

  router.post<{ restaurantId: string }>("/", async (req, res) => {
    const body = req.body;
    const allowed = ["date", "title", "tasks"];
    const validShape = body && typeof body === "object" && !Array.isArray(body) &&
      !Object.keys(body).some(key => !allowed.includes(key));
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const tasks = Array.isArray(body?.tasks) ? body.tasks.map((task: unknown) =>
      typeof task === "string" ? task.trim() : task) : [];
    if (!validShape || !validDate(body.date) || !title || [...title].length > 150 ||
        tasks.length < 1 || tasks.length > 50 || tasks.some((task: unknown) =>
          typeof task !== "string" || !task || [...task].length > 300)) {
      res.status(400).json({ error: "Provide a valid date, a title up to 150 characters, and 1–50 nonblank tasks up to 300 characters each" });
      return;
    }
    try {
      const result = await database.query(
        `WITH new_list AS (
           INSERT INTO prep_lists (restaurant_id, prep_date, title)
           VALUES ($1, $2, $3)
           RETURNING prep_list_id, prep_date, title
         ), new_tasks AS (
           INSERT INTO prep_tasks (prep_list_id, description, position)
           SELECT new_list.prep_list_id, task.description, (task.position - 1)::integer
           FROM new_list, unnest($4::text[]) WITH ORDINALITY AS task(description, position)
           RETURNING prep_task_id, prep_list_id, description, position, is_complete, completed_at
         )
         SELECT new_list.prep_list_id, new_list.prep_date, new_list.title,
                json_agg(json_build_object(
                  'prep_task_id', new_tasks.prep_task_id,
                  'description', new_tasks.description,
                  'position', new_tasks.position,
                  'is_complete', new_tasks.is_complete,
                  'completed_at', new_tasks.completed_at
                ) ORDER BY new_tasks.position) AS tasks
         FROM new_list JOIN new_tasks USING (prep_list_id)
         GROUP BY new_list.prep_list_id, new_list.prep_date, new_list.title`,
        [req.params.restaurantId, body.date, title, tasks]
      );
      res.status(201).json({ prep_list: result.rows[0] });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23503") { res.status(404).json({ error: "Restaurant not found" }); return; }
      if (code === "23505") { res.status(409).json({ error: "A prep list already exists for that date" }); return; }
      console.error("Prep list creation failed:", error);
      res.status(503).json({ error: "Prep list service unavailable" });
    }
  });

  router.patch<{ restaurantId: string; taskId: string }>("/tasks/:taskId", async (req, res) => {
    if (!validId(req.params.taskId) || !req.body || typeof req.body !== "object" ||
        Array.isArray(req.body) || Object.keys(req.body).length !== 1 ||
        typeof req.body.is_complete !== "boolean") {
      res.status(400).json({ error: "Provide a valid task ID and boolean is_complete" });
      return;
    }
    try {
      const result = await database.query(
        `UPDATE prep_tasks pt
         SET is_complete = $3,
             completed_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
             updated_at = NOW()
         FROM prep_lists pl
         WHERE pt.prep_list_id = pl.prep_list_id
           AND pl.restaurant_id = $1 AND pt.prep_task_id = $2
         RETURNING pt.prep_task_id, pt.description, pt.position, pt.is_complete, pt.completed_at`,
        [req.params.restaurantId, req.params.taskId, req.body.is_complete]
      );
      if (!result.rows.length) { res.status(404).json({ error: "Prep task not found" }); return; }
      res.json({ task: result.rows[0] });
    } catch (error) {
      console.error("Prep task update failed:", error);
      res.status(503).json({ error: "Prep list service unavailable" });
    }
  });

  return router;
}
