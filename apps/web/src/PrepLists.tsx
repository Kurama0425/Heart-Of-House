import { FormEvent, useEffect, useMemo, useState } from "react";

type Restaurant = { restaurant_id: string; name: string };
type PrepTask = { prep_task_id: string; description: string; position: number; is_complete: boolean };
type PrepList = { prep_list_id: string; prep_date: string; title: string; tasks: PrepTask[] };

async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function PrepLists({ apiUrl }: { apiUrl: string }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [date, setDate] = useState(localDate);
  const [title, setTitle] = useState("Daily Prep");
  const [taskText, setTaskText] = useState("");
  const [prepList, setPrepList] = useState<PrepList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const tasks = useMemo(() => taskText.split("\n").map(task => task.trim()).filter(Boolean), [taskText]);

  useEffect(() => {
    let active = true;
    request(`${apiUrl}/api/v1/restaurants`).then(data => {
      if (!active) return;
      setRestaurants(data.restaurants);
      setRestaurantId(data.restaurants[0]?.restaurant_id ?? "");
    }).catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl]);

  useEffect(() => {
    if (!restaurantId) { setPrepList(null); return; }
    let active = true;
    setLoading(true); setError("");
    request(`${apiUrl}/api/v1/restaurants/${restaurantId}/prep-lists?date=${date}`)
      .then(data => { if (active) setPrepList(data.prep_list); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl, restaurantId, date]);

  async function createList(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const data = await request(`${apiUrl}/api/v1/restaurants/${restaurantId}/prep-lists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, title, tasks })
      });
      setPrepList(data.prep_list); setTaskText("");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create prep list"); }
    finally { setSaving(false); }
  }

  async function toggleTask(task: PrepTask) {
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
  }

  const completed = prepList?.tasks.filter(task => task.is_complete).length ?? 0;

  return <section id="prep" className="ingredient-panel" aria-labelledby="prep-heading">
    <p className="eyebrow">Shift execution</p><h2 id="prep-heading">Daily Prep List</h2>
    <p>Build the day’s list, then check tasks off on the line. Completion survives a refresh.</p>
    <div className="prep-controls">
      <label>Restaurant <select value={restaurantId} disabled={saving || loading} onChange={event => setRestaurantId(event.target.value)}>
        {!restaurants.length && <option value="">Set up your kitchen first</option>}
        {restaurants.map(restaurant => <option key={restaurant.restaurant_id} value={restaurant.restaurant_id}>{restaurant.name}</option>)}
      </select></label>
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
            <label><input type="checkbox" checked={task.is_complete} onChange={() => toggleTask(task)} /> <span>{task.description}</span></label>
          </li>)}
        </ul>
      </div>}
  </section>;
}
