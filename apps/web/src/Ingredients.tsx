import { request } from "./request";
import { FormEvent, useEffect, useState } from "react";
import { formatIngredientUnitCost } from "./ingredientCost";

type Ingredient = { ingredient_id: string; name: string; purchase_unit: string; purchase_quantity: string; purchase_price: string };

export function Ingredients({ apiUrl, restaurantId, onSaved }: { apiUrl: string; restaurantId: string; onSaved?: () => void }) {
  const [editingId, setEditingId] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", purchase_unit: "", purchase_quantity: "1", purchase_price: "0" });
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
      const data = await request(`${apiUrl}/api/v1/restaurants/${restaurantId}/ingredients${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, purchase_quantity: Number(form.purchase_quantity), purchase_price: Number(form.purchase_price) })
      });
      setIngredients(current => (editingId ? current.map(i => i.ingredient_id === editingId ? data.ingredient : i) : [...current, data.ingredient]).sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: "", purchase_unit: "", purchase_quantity: "1", purchase_price: "0" });
      setEditingId(""); setNotice("Ingredient saved."); onSaved?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save ingredient"); }
    finally { setSaving(false); }
  }
  return <section id="ingredients" className="ingredient-panel" aria-labelledby="ingredient-heading">
    <p className="eyebrow">Food cost foundation</p><h2 id="ingredient-heading">Ingredient Catalog</h2>
    <p>Enter the quantity and price of a purchase—for example, 25 lb of flour for $18.50.</p>

    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form onSubmit={save} className="ingredient-form">
      <fieldset disabled={!restaurantId || loading || saving}>
        <legend>{editingId ? "Edit ingredient purchase" : "Add an ingredient"}</legend>
        <label>Name <input required maxLength={150} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>Purchase unit <input required maxLength={50} placeholder="lb, kg, each…" value={form.purchase_unit} onChange={e => setForm({ ...form, purchase_unit: e.target.value })} /></label>
        <label>Purchase quantity <input required type="number" min="0.0001" max="99999999.9999" step="0.0001" value={form.purchase_quantity} onChange={e => setForm({ ...form, purchase_quantity: e.target.value })} /></label>
        <label>Purchase price ($) <input required type="number" min="0" max="9999999999.99" step="0.01" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} /></label>
        <p className="unit-cost-preview" role="status">Cost per purchase unit: <strong>{formatIngredientUnitCost(form.purchase_quantity, form.purchase_price, form.purchase_unit)}</strong><br /><small>Purchase price ÷ quantity. Uses your purchase unit; no unit conversion.</small></p>
        <button type="submit">{saving ? "Saving…" : "Save ingredient"}</button>
      {editingId && <button type="button" onClick={() => { setEditingId(""); setForm({ name: "", purchase_unit: "", purchase_quantity: "1", purchase_price: "0" }); }}>Cancel edit</button>}</fieldset>
    </form>
    {loading ? <p role="status">Loading ingredients…</p> : <>
      {!ingredients.length && restaurantId && !error && <p>No ingredients yet. Add your first purchase above.</p>}
      {!!ingredients.length && <div className="ingredient-table"><table><caption>Ingredient purchases</caption><thead><tr><th>Name</th><th>Quantity</th><th>Unit</th><th>Price</th><th>Cost per unit</th><th>Action</th></tr></thead><tbody>
        {ingredients.map(i => <tr key={i.ingredient_id}><td>{i.name}</td><td>{i.purchase_quantity}</td><td>{i.purchase_unit}</td><td>${Number(i.purchase_price).toFixed(2)}</td><td>{formatIngredientUnitCost(i.purchase_quantity, i.purchase_price, i.purchase_unit)}</td><td><button type="button" disabled={saving} onClick={() => { setEditingId(i.ingredient_id); setForm({ name: i.name, purchase_unit: i.purchase_unit, purchase_quantity: i.purchase_quantity, purchase_price: i.purchase_price }); }}>Edit {i.name}</button></td></tr>)}
      </tbody></table></div>}
    </>}
  </section>;
}
