import { FormEvent, useEffect, useState } from "react";
import { formatIngredientUnitCost } from "./ingredientCost";

type Restaurant = { restaurant_id: string; name: string };
type Ingredient = { ingredient_id: string; name: string; purchase_unit: string; purchase_quantity: string; purchase_price: string };
async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
export function Ingredients({ apiUrl }: { apiUrl: string }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", purchase_unit: "", purchase_quantity: "1", purchase_price: "0" });
  useEffect(() => {
    let active = true;
    request(`${apiUrl}/api/v1/restaurants`).then(data => {
      if (!active) return;
      setRestaurants(data.restaurants);
      setRestaurantId(data.restaurants[0]?.restaurant_id ?? "");
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl]);
  useEffect(() => {
    if (!restaurantId) return;
    let active = true;
    setLoading(true); setError(""); setNotice(""); setIngredients([]);
    request(`${apiUrl}/api/v1/restaurants/${restaurantId}/ingredients`).then(data => {
      if (active) setIngredients(data.ingredients);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl, restaurantId]);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const data = await request(`${apiUrl}/api/v1/restaurants/${restaurantId}/ingredients`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, purchase_quantity: Number(form.purchase_quantity), purchase_price: Number(form.purchase_price) })
      });
      setIngredients(current => [...current, data.ingredient].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: "", purchase_unit: "", purchase_quantity: "1", purchase_price: "0" });
      setNotice("Ingredient saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save ingredient"); }
    finally { setSaving(false); }
  }
  return <section id="ingredients" className="ingredient-panel" aria-labelledby="ingredient-heading">
    <p className="eyebrow">Food cost foundation</p><h2 id="ingredient-heading">Ingredient Catalog</h2>
    <p>Enter the quantity and price of a purchase—for example, 25 lb of flour for $18.50.</p>
    <label>Restaurant <select value={restaurantId} disabled={saving || loading} onChange={e => setRestaurantId(e.target.value)}>
      {!restaurants.length && <option value="">No restaurants available</option>}
      {restaurants.map(r => <option key={r.restaurant_id} value={r.restaurant_id}>{r.name}</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!loading && !error && !restaurants.length && <p>Create a restaurant through the restaurant API first (see README).</p>}
    <form onSubmit={save} className="ingredient-form">
      <fieldset disabled={!restaurantId || loading || saving}>
        <legend>Add an ingredient</legend>
        <label>Name <input required maxLength={150} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>Purchase unit <input required maxLength={50} placeholder="lb, kg, each…" value={form.purchase_unit} onChange={e => setForm({ ...form, purchase_unit: e.target.value })} /></label>
        <label>Purchase quantity <input required type="number" min="0.0001" max="99999999.9999" step="0.0001" value={form.purchase_quantity} onChange={e => setForm({ ...form, purchase_quantity: e.target.value })} /></label>
        <label>Purchase price ($) <input required type="number" min="0" max="9999999999.99" step="0.01" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} /></label>
        <p className="unit-cost-preview" role="status">Cost per purchase unit: <strong>{formatIngredientUnitCost(form.purchase_quantity, form.purchase_price, form.purchase_unit)}</strong><br /><small>Purchase price ÷ quantity. Uses your purchase unit; no unit conversion.</small></p>
        <button type="submit">{saving ? "Saving…" : "Save ingredient"}</button>
      </fieldset>
    </form>
    {loading ? <p role="status">Loading ingredients…</p> : <>
      {!ingredients.length && restaurantId && !error && <p>No ingredients yet. Add your first purchase above.</p>}
      {!!ingredients.length && <div className="ingredient-table"><table><caption>Ingredient purchases</caption><thead><tr><th>Name</th><th>Quantity</th><th>Unit</th><th>Price</th><th>Cost per unit</th></tr></thead><tbody>
        {ingredients.map(i => <tr key={i.ingredient_id}><td>{i.name}</td><td>{i.purchase_quantity}</td><td>{i.purchase_unit}</td><td>${Number(i.purchase_price).toFixed(2)}</td><td>{formatIngredientUnitCost(i.purchase_quantity, i.purchase_price, i.purchase_unit)}</td></tr>)}
      </tbody></table></div>}
    </>}
  </section>;
}
