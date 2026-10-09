/** Cost per purchase unit; this does not convert between units. */
export function ingredientUnitCost(quantity: string, price: string): number | null {
  if (!quantity.trim() || !price.trim()) return null;
  const amount = Number(quantity);
  const total = Number(price);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(total) || total < 0) return null;
  const cost = total / amount;
  return Number.isFinite(cost) ? cost : null;
}

export function formatIngredientUnitCost(quantity: string, price: string, unit: string): string {
  const cost = ingredientUnitCost(quantity, price);
  if (cost === null || !unit.trim()) return "—";
  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4
  }).format(cost);
  return `${dollars} / ${unit.trim()}`;
}
