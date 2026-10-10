/** Display estimates without changing the API's unrounded decimal values. */
export function formatCost(value: string | null | undefined): string {
  if (value == null || !value.trim()) return 'Unavailable';
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 'Unavailable';
  if (amount > 0 && amount < 0.0001) return '<$0.0001';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: amount > 0 && amount < 0.01 ? 4 : 2 }).format(amount);
}
