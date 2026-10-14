import { FormEvent, useEffect, useState } from "react";
import { request } from "./request";
type Restaurant = { restaurant_id: string; name: string };
export function RestaurantSetup({ apiUrl, onCreated, onSelected }: { apiUrl: string; onCreated: () => void; onSelected: (id: string) => void }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]), [selected, setSelected] = useState("");
  const [name, setName] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  function choose(id: string, list = restaurants) {
    setSelected(id); onSelected(id); setName(list.find(r => r.restaurant_id === id)?.name ?? "");
    try { localStorage.setItem("hoh.restaurantId", id); } catch {}
  }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    request(`${apiUrl}/api/v1/restaurants`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      setRestaurants(data.restaurants);
      let stored = ""; try { stored = localStorage.getItem("hoh.restaurantId") ?? ""; } catch {}
      choose(data.restaurants.some((r: Restaurant) => r.restaurant_id === stored) ? stored : data.restaurants[0]?.restaurant_id ?? "", data.restaurants);
    }).catch(() => { if (!controller.signal.aborted) { setError("Unable to load kitchens. Start PostgreSQL and the API, apply migrations, then retry."); onSelected(""); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiUrl, attempt]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (saving || !name.trim()) return; setSaving(true); setError("");
    try {
      const data = await request(`${apiUrl}/api/v1/restaurants${selected ? `/${selected}` : ""}`, {
        method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() })
      });
      const list = selected ? restaurants.map(r => r.restaurant_id === selected ? data.restaurant : r) : [...restaurants, data.restaurant];
      setRestaurants(list); choose(data.restaurant.restaurant_id, list); onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save kitchen"); } finally { setSaving(false); }
  }
  return <section id="restaurant-setup" className="ingredient-panel"><h2>Your kitchen</h2>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading kitchens…</p> : <>
      {!!restaurants.length && <label>Active kitchen <select value={selected} disabled={saving} onChange={e => choose(e.target.value)}>
        {restaurants.map(r => <option key={r.restaurant_id} value={r.restaurant_id}>{r.name}</option>)}<option value="">Create another kitchen</option>
      </select></label>}
      {!restaurants.length && <p>Create your kitchen below, or run <code>npm run db:seed</code> in apps/api for a fictional demo kitchen.</p>}
      <form className="ingredient-form" onSubmit={save}><fieldset disabled={saving || !!error}>
        <legend>{selected ? "Edit kitchen name" : "Set up your kitchen"}</legend>
        <label>Restaurant name <input required maxLength={150} value={name} onChange={e => setName(e.target.value)} /></label>
        <button type="submit" disabled={!name.trim()}>{saving ? "Saving…" : selected ? "Save kitchen" : "Create restaurant"}</button>
      </fieldset></form>
      <button type="button" disabled={saving} onClick={() => setAttempt(current => current + 1)}>Retry / refresh kitchens</button>
    </>}
  </section>;
}
