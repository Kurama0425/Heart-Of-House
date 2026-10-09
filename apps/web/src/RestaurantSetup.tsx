import { FormEvent, useEffect, useState } from "react";

export function RestaurantSetup({ apiUrl, onCreated }: { apiUrl: string; onCreated: () => void }) {
  const [loading, setLoading] = useState(true);
  const [hasRestaurant, setHasRestaurant] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`${apiUrl}/api/v1/restaurants`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Restaurant service unavailable. Check that the API and PostgreSQL are running, then retry.");
        const data = await response.json();
        if (!controller.signal.aborted) {
          setHasRestaurant(data.restaurants.length > 0);
          if (attempt > 0 && data.restaurants.length > 0) onCreated();
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Unable to load restaurants. Start the API and PostgreSQL, then retry.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiUrl, attempt]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`${apiUrl}/api/v1/restaurants`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Unable to save your restaurant.");
      }
      setHasRestaurant(true);
      onCreated();
    } catch (e) {
      setError(e instanceof TypeError ? "Unable to reach the API. Start the API and PostgreSQL, then try again." : e instanceof Error ? e.message : "Unable to save your restaurant.");
    } finally { setSaving(false); }
  }

  if (hasRestaurant) return null;
  return <section id="restaurant-setup" className="ingredient-panel" aria-labelledby="setup-heading">
    <p className="eyebrow">Get started</p><h2 id="setup-heading">Set up your kitchen</h2>
    <p>Create your restaurant once to start saving ingredients and recipes.</p>
    {loading ? <p role="status">Checking restaurant setup…</p> : <>
      {error && <p role="alert">{error}</p>}
      <form className="ingredient-form" onSubmit={save}>
        <fieldset disabled={saving}>
          <legend>Your restaurant</legend>
          <label>Restaurant name <input required maxLength={150} placeholder="My Kitchen" value={name} onChange={e => setName(e.target.value)} /></label>
          <button disabled={!name.trim()} type="submit">{saving ? "Saving…" : "Create restaurant"}</button>
        </fieldset>
      </form>
      {error && <button type="button" disabled={saving} onClick={() => setAttempt(current => current + 1)}>Retry connection</button>}
    </>}
  </section>;
}
