import { request } from "./request";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type PrepTask = { prep_task_id: string; description: string; position: number; is_complete: boolean };
type PrepList = { prep_list_id: string; prep_date: string; title: string; tasks: PrepTask[] };



const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function PrepLists({ apiUrl, restaurantId }: { apiUrl: string; restaurantId: string }) {
  const [date, setDate] = useState(localDate);
  const [title, setTitle] = useState("Daily Prep");
  const [taskText, setTaskText] = useState("");
  const [prepList, setPrepList] = useState<PrepList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mutationPending = useRef(false);
  const tasks = useMemo(() => taskText.split("\n").map(task => task.trim()).filter(Boolean), [taskText]);

  useEffect(() => {
    if (!restaurantId) { setPrepList(null); return; }
    let active = true;
    setLoading(true); setError(""); setPrepList(null);
    request(`${apiUrl}/api/v1/restaurants/${restaurantId}/prep-lists?date=${date}`)
      .then(data => { if (active) setPrepList(data.prep_list); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl, restaurantId, date]);

  async function createList(event: FormEvent) {
    event.preventDefault(); if (mutationPending.current) return; mutationPending.current = true; setSaving(true); setError("");
    try {
      const data = await request(`${apiUrl}/api/v1/restaurants/${restaurantId}/prep-lists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, title, tasks })
      });
      setPrepList(data.prep_list); setTaskText("");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create prep list"); }
    finally { mutationPending.current = false; setSaving(false); }
  }

  async function toggleTask(task: PrepTask) { if (mutationPending.current) return; mutationPending.current = true; setSaving(true); setError("");
    const next = !task.is_complete;
    setPrepList(current => current ? { ...current, tasks: current.tasks.map(item =>
      item.prep_task_id === task.prep_task_id ? { ...item, is_complete: next } : item) } : current);
    try {
      await request(`${apiUrl}/api/v1/restaurants/${restaurantId}/prep-lists/tasks/${task.prep_task_id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_complete: next })
      });
    } catch (error) {
      setPrepList(current => current ? { ...current, tasks: current.tasks.map(item =>
        item.prep_task_id === task.prep_task_id ? task : item) } : current);
      setError(error instanceof Error ? error.message : "Unable to update task");
    }
    finally { mutationPending.current = false; setSaving(false); }
  }

  const completed = prepList?.tasks.filter(task => task.is_complete).length ?? 0;

  return <section id="prep" className="ingredient-panel" aria-labelledby="prep-heading">
    <p className="eyebrow">Shift execution</p><h2 id="prep-heading">Daily Prep List</h2>
    <p>Build the day’s list, then check tasks off on the line. Completion survives a refresh.</p>
    <div className="prep-controls">

      <label>Prep date <input type="date" value={date} disabled={saving} onChange={event => setDate(event.target.value)} /></label>
    </div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading prep list…</p> : !prepList ?
      <form className="prep-form" onSubmit={createList}>
        <fieldset disabled={!restaurantId || saving}>
          <legend>Create this day’s list</legend>
          <label>List title <input required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label>Tasks—one per line <textarea required rows={7} maxLength={15049} placeholder={"Portion chicken\nMake ranch\nSlice tomatoes"} value={taskText} onChange={event => setTaskText(event.target.value)} /></label>
          <p className="form-help">{tasks.length} of 50 tasks</p>
          <button type="submit" disabled={!tasks.length || tasks.length > 50}>{saving ? "Creating…" : "Create prep list"}</button>
        </fieldset>
      </form> :
      <div className="prep-board">
        <div className="prep-summary"><div><h3>{prepList.title}</h3><span>{date}</span></div><strong>{completed} / {prepList.tasks.length} done</strong></div>
        <progress value={completed} max={prepList.tasks.length} aria-label={`${completed} of ${prepList.tasks.length} tasks complete`} />
        <ul className="prep-tasks">
          {prepList.tasks.map(task => <li key={task.prep_task_id} className={task.is_complete ? "complete" : ""}>
            <label><input type="checkbox" disabled={saving || loading} checked={task.is_complete} onChange={() => toggleTask(task)} /> <span>{task.description}</span></label>
          </li>)}
        </ul>
      </div>}
  </section>;
}
