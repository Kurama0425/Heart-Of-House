// US customary volume. Weight and volume cannot be mixed without density data.
const units: Record<string, [string, number]> = {
  g: ['weight', 1], kg: ['weight', 1000], oz: ['weight', 28.349523125], lb: ['weight', 453.59237],
  ml: ['volume', 1], l: ['volume', 1000], tsp: ['volume', 4.92892159375], tbsp: ['volume', 14.78676478125],
  cup: ['volume', 236.5882365], pt: ['volume', 473.176473], qt: ['volume', 946.352946], gal: ['volume', 3785.411784]
};
export function purchaseQuantity(quantity: number, from: string, to: string): number | null {
  from = from.trim().toLowerCase(); to = to.trim().toLowerCase();
  if (from === to) return quantity;
  const a = units[from], b = units[to];
  return a && b && a[0] === b[0] ? quantity * a[1] / b[1] : null;
}
