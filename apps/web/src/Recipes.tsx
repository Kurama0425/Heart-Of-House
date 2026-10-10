import { formatCost } from './recipeCost';
import { FormEvent, useEffect, useState } from 'react';
type Restaurant = { restaurant_id: string; name: string };
type Ingredient = { ingredient_id: string; name: string; purchase_unit: string };
type Line = { ingredient_id: string; quantity: string; unit: string; name?: string; line_cost?: string | null };
type Recipe = { recipe_id: string; name: string; instructions: string; yield_quantity: string; yield_unit: string; ingredients?: Line[]; costing?: { batch_cost: string | null; portion_cost: string | null } };
async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, options); const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}
export function Recipes({ apiUrl }: { apiUrl: string }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [detail, setDetail] = useState<Recipe | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [form, setForm] = useState({ name: '', instructions: '', yield_quantity: '1', yield_unit: 'portion' });
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const base = `${apiUrl}/api/v1/restaurants/${restaurantId}`;
  useEffect(() => {
    let active = true;
    request(`${apiUrl}/api/v1/restaurants`).then(data => { if (active) { setRestaurants(data.restaurants); setRestaurantId(data.restaurants[0]?.restaurant_id ?? ''); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl]);
  useEffect(() => {
    if (!restaurantId) return;
    let active = true;
    setLoading(true); setError(''); setNotice(''); setDetail(null); setLines([]); setRecipes([]); setIngredients([]);
    setForm({ name: '', instructions: '', yield_quantity: '1', yield_unit: 'portion' });
    Promise.all([request(`${base}/ingredients`), request(`${base}/recipes`)]).then(([catalog, saved]) => {
      if (active) { setIngredients(catalog.ingredients); setRecipes(saved.recipes); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, restaurantId]);
  function updateLine(index: number, patch: Partial<Line>) { setLines(current => current.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const data = await request(`${base}/recipes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, yield_quantity: Number(form.yield_quantity), ingredients: lines.map(i => ({ ...i, quantity: Number(i.quantity) })) }) });
      setRecipes(current => [...current, data.recipe].sort((a,b) => a.name.localeCompare(b.name)));
      setForm({ name: '', instructions: '', yield_quantity: '1', yield_unit: 'portion' }); setLines([]); setNotice('Recipe saved. Select it below to see its details.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save recipe'); }
    finally { setSaving(false); }
  }
  // Abort old detail requests when selection, restaurant, or component changes.
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => {
    setDetail(null);
    if (!selectedId) return;
    const controller = new AbortController();
    request(`${base}/recipes/${selectedId}`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setDetail(data.recipe); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [base, selectedId]);
  return <section id="recipes" className="ingredient-panel" aria-labelledby="recipe-heading">
    <p className="eyebrow">Standardize the kitchen</p><h2 id="recipe-heading">Recipe Builder</h2>
    <p>Save a batch recipe with its yield and ingredient quantities.</p>
    <label>Restaurant <select disabled={loading || saving} value={restaurantId} onChange={e => { setSelectedId(''); setRestaurantId(e.target.value); }}>
      {!restaurants.length && <option value="">Set up your kitchen first</option>}{restaurants.map(r => <option key={r.restaurant_id} value={r.restaurant_id}>{r.name}</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!loading && !error && !restaurants.length && <p><a href="#restaurant-setup">Set up your kitchen above</a> to create recipes.</p>}
    {loading && <p role="status">Loading recipes…</p>}
    {!loading && restaurantId && !ingredients.length && <p>Add ingredients in the catalog, then reload this page to start a recipe.</p>}
    <form onSubmit={save} className="ingredient-form"><fieldset disabled={loading || saving || !ingredients.length}>
      <legend>New recipe</legend>
      <label>Recipe name <input required maxLength={150} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Batch yield <input required type="number" min="0.0001" max="99999999.9999" step="0.0001" value={form.yield_quantity} onChange={e => setForm({ ...form, yield_quantity: e.target.value })} /></label>
      <label>Yield unit <input required maxLength={50} value={form.yield_unit} onChange={e => setForm({ ...form, yield_unit: e.target.value })} /></label>
      <label>Instructions <textarea required maxLength={10000} rows={4} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} /></label>
      <p>Use the purchase unit, or compatible g/kg/oz/lb and ml/l/tsp/tbsp/cup/pt/qt/gal units. Volume is US customary. Weight cannot convert to volume. Saved quantities are converted to purchase units and rounded to four decimals.</p>
      {lines.map((line, index) => <div className="recipe-line" key={index}>
        <label>Ingredient {index + 1} <select required value={line.ingredient_id} onChange={e => updateLine(index, { ingredient_id: e.target.value, unit: ingredients.find(i => i.ingredient_id === e.target.value)?.purchase_unit ?? '' })}>
          <option value="">Choose ingredient</option>{ingredients.filter(i => i.ingredient_id === line.ingredient_id || !lines.some(l => l.ingredient_id === i.ingredient_id)).map(i => <option key={i.ingredient_id} value={i.ingredient_id}>{i.name}</option>)}
        </select></label>
        <label>Quantity <input required type="number" min="0.0001" max="99999999.9999" step="0.0001" value={line.quantity} onChange={e => updateLine(index, { quantity: e.target.value })} /></label>
        <label>Unit <input required maxLength={50} value={line.unit} onChange={e => updateLine(index, { unit: e.target.value })} /></label>
        <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove ingredient {index + 1}</button>
      </div>)}
      <button type="button" disabled={lines.length >= Math.min(50, ingredients.length)} onClick={() => setLines([...lines, { ingredient_id: '', quantity: '1', unit: '' }])}>Add ingredient</button>{' '}
      <button type="submit" disabled={!lines.length}>{saving ? 'Saving…' : 'Save recipe'}</button>
    </fieldset></form>
    {!loading && !recipes.length && restaurantId && <p>No saved recipes yet.</p>}
    {!!recipes.length && <label>Saved recipes <select value={selectedId} onChange={e => { setError(''); setSelectedId(e.target.value); }}>
      <option value="">Choose a recipe</option>{recipes.map(r => <option key={r.recipe_id} value={r.recipe_id}>{r.name} — {r.yield_quantity} {r.yield_unit}</option>)}
    </select></label>}
    {detail && <article><h3>{detail.name}</h3><p>Batch yield: {detail.yield_quantity} {detail.yield_unit}</p><div className="recipe-costing">
      <h4>Food cost estimate</h4>
      <p><strong>Batch cost: {formatCost(detail.costing?.batch_cost)}</strong></p>
      <p><strong>Cost per portion: {formatCost(detail.costing?.portion_cost)}</strong></p>
      <p>Based on current ingredient purchase prices. Ingredient cost only; excludes labor, waste, and overhead. Per-portion cost requires a yield unit of portion(s) or serving(s).</p>
      {detail.costing?.batch_cost == null && <p role="status">Cost unavailable. Check that every ingredient has a valid purchase quantity and matching saved unit.</p>}
      <div className="ingredient-table"><table><thead><tr><th>Ingredient</th><th>Quantity</th><th>Line cost</th></tr></thead><tbody>{detail.ingredients?.map(i => <tr key={i.ingredient_id}><td>{i.name}</td><td>{i.quantity} {i.unit}</td><td>{formatCost(i.line_cost)}</td></tr>)}</tbody></table></div>
    </div><p style={{ whiteSpace: 'pre-wrap' }}>{detail.instructions}</p></article>}
  </section>;
}
