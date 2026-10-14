/** Shared storage limits used by manual entry and CSV import. */
export const validId = (id: unknown): id is string => typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');
export const nameKey = (name: string) => normalizeName(name).toLowerCase();
export const validLabel = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && [...value.trim()].length <= max;
export function validDecimal(value: unknown, places: number, max: number, positive: boolean): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value < max &&
    (positive ? value > 0 : value >= 0) && /^\d+(?:\.\d+)?$/.test(String(value)) &&
    (String(value).split('.')[1]?.length ?? 0) <= places;
}
export const validQuantity = (value: unknown): value is number => validDecimal(value, 4, 100000000, true);
export const validPrice = (value: unknown): value is number => validDecimal(value, 2, 10000000000, false);
