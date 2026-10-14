import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Restaurant = { restaurant_id: string; name: string };
type Template = { checklist_template_id: string; name: string; checklist_type: "opening" | "closing"; tasks: { description: string }[] };
type RunTask = { checklist_run_task_id: string; description: string; is_complete: boolean };
type Run = { checklist_run_id: string; shift_label: string; template_name: string; checklist_type: string; tasks: RunTask[] };
async function request(url: string, options?: RequestInit) { const response = await fetch(url, options); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Request failed"); return data; }
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };

export function Checklists({ apiUrl }: { apiUrl: string }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]), [restaurantId, setRestaurantId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]), [runs, setRuns] = useState<Run[]>([]);
  const [date, setDate] = useState(today), [name, setName] = useState("Opening Checklist"), [type, setType] = useState<"opening" | "closing">("opening");
  const [taskText, setTaskText] = useState(""), [templateId, setTemplateId] = useState(""), [shiftLabel, setShiftLabel] = useState("Morning");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [pendingTasks, setPendingTasks] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const tasks = useMemo(() => taskText.split("\n").map(task => task.trim()).filter(Boolean), [taskText]);

  useEffect(() => { let active = true; request(`${apiUrl}/api/v1/restaurants`).then(data => { if (active) { setRestaurants(data.restaurants); setRestaurantId(data.restaurants[0]?.restaurant_id ?? ""); } }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [apiUrl]);
  useEffect(() => {
    if (!restaurantId) { setTemplates([]); setRuns([]); setLoading(false); return; }
    let active = true; setLoading(true); setError(""); setTemplates([]); setRuns([]); setTemplateId("");
    Promise.all([request(`${apiUrl}/api/v1/restaurants/${restaurantId}/checklists/templates`), request(`${apiUrl}/api/v1/restaurants/${restaurantId}/checklists/runs?date=${date}`)])
      .then(([a, b]) => { if (active) { setTemplates(a.templates); setRuns(b.runs); setTemplateId(current => a.templates.some((item: Template) => item.checklist_template_id === current) ? current : a.templates[0]?.checklist_template_id ?? ""); } })
      .catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl, restaurantId, date]);

  async function createTemplate(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const data = await request(`${apiUrl}/api/v1/restaurants/${restaurantId}/checklists/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, checklist_type: type, tasks }) }); setTemplates(current => [...current, data.template]); setTemplateId(data.template.checklist_template_id); setTaskText(""); } catch (error) { setError(error instanceof Error ? error.message : "Unable to create template"); } finally { setSaving(false); } }
  async function startRun(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const data = await request(`${apiUrl}/api/v1/restaurants/${restaurantId}/checklists/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template_id: templateId, date, shift_label: shiftLabel }) }); setRuns(current => [...current, data.run]); } catch (error) { setError(error instanceof Error ? error.message : "Unable to start checklist"); } finally { setSaving(false); } }
  async function toggle(runId: string, task: RunTask) {
    if (pendingRef.current.has(task.checklist_run_task_id)) return;
    pendingRef.current.add(task.checklist_run_task_id);
    setPendingTasks(new Set(pendingRef.current));
    const next = !task.is_complete;
    setRuns(current => current.map(run => run.checklist_run_id === runId
      ? { ...run, tasks: run.tasks.map(item => item.checklist_run_task_id === task.checklist_run_task_id ? { ...item, is_complete: next } : item) } : run));
    try {
      await request(`${apiUrl}/api/v1/restaurants/${restaurantId}/checklists/runs/tasks/${task.checklist_run_task_id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_complete: next })
      });
    } catch (error) {
      setRuns(current => current.map(run => run.checklist_run_id === runId
        ? { ...run, tasks: run.tasks.map(item => item.checklist_run_task_id === task.checklist_run_task_id ? task : item) } : run));
      setError(error instanceof Error ? error.message : "Unable to update checklist");
    } finally {
      pendingRef.current.delete(task.checklist_run_task_id);
      setPendingTasks(new Set(pendingRef.current));
    }
  }

  return <section id="checklists" className="ingredient-panel" aria-labelledby="checklists-heading">
    <p className="eyebrow">Open &amp; close</p><h2 id="checklists-heading">Shift Checklists</h2><p>Create a routine once, then start a fresh tracked copy for each shift.</p>
    <div className="prep-controls"><label>Restaurant <select value={restaurantId} disabled={saving || loading || pendingTasks.size > 0} onChange={event => setRestaurantId(event.target.value)}>{!restaurants.length && <option value="">Set up your kitchen first</option>}{restaurants.map(item => <option key={item.restaurant_id} value={item.restaurant_id}>{item.name}</option>)}</select></label><label>Shift date <input type="date" value={date} disabled={saving || pendingTasks.size > 0} onChange={event => setDate(event.target.value)} /></label></div>
    {error && <p role="alert">{error}</p>}{loading ? <p role="status">Loading checklists…</p> : <div className="checklist-workspace">
      <form className="prep-form" onSubmit={createTemplate}><fieldset disabled={!restaurantId || saving}><legend>Create reusable template</legend><label>Name <input required maxLength={150} value={name} onChange={event => setName(event.target.value)} /></label><label>Type <select value={type} onChange={event => setType(event.target.value as "opening" | "closing")}><option value="opening">Opening</option><option value="closing">Closing</option></select></label><label>Tasks—one per line <textarea required rows={6} maxLength={15049} placeholder={"Turn on equipment\nCheck walk-in temperatures\nStock the line"} value={taskText} onChange={event => setTaskText(event.target.value)} /></label><p className="form-help">{tasks.length} of 50 tasks</p><button type="submit" disabled={!tasks.length || tasks.length > 50}>{saving ? "Saving…" : "Save template"}</button></fieldset></form>
      <form className="prep-form" onSubmit={startRun}><fieldset disabled={!templateId || saving}><legend>Start a shift checklist</legend><label>Template <select value={templateId} onChange={event => setTemplateId(event.target.value)}><option value="">Create a template first</option>{templates.map(item => <option key={item.checklist_template_id} value={item.checklist_template_id}>{item.name} ({item.tasks.length})</option>)}</select></label><label>Shift label <input required maxLength={80} value={shiftLabel} placeholder="Morning" onChange={event => setShiftLabel(event.target.value)} /></label><button type="submit">{saving ? "Starting…" : "Start fresh checklist"}</button></fieldset></form>
    </div>}
    <div className="checklist-runs">{!loading && !runs.length && <p className="form-help">No checklists started for this date.</p>}{!loading && runs.map(run => { const complete = run.tasks.filter(task => task.is_complete).length; return <article className="prep-board" key={run.checklist_run_id}><div className="prep-summary"><div><span className="checklist-type">{run.checklist_type}</span><h3>{run.template_name}</h3><span>{run.shift_label}</span></div><strong>{complete} / {run.tasks.length} done</strong></div><progress value={complete} max={run.tasks.length} aria-label={`${complete} of ${run.tasks.length} tasks complete`} /><ul className="prep-tasks">{run.tasks.map(task => <li key={task.checklist_run_task_id} className={task.is_complete ? "complete" : ""}><label><input type="checkbox" checked={task.is_complete} disabled={pendingTasks.has(task.checklist_run_task_id)} onChange={() => toggle(run.checklist_run_id, task)} /> <span>{task.description}</span></label></li>)}</ul></article>; })}</div>
  </section>;
}
