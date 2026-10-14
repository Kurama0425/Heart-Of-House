import { parse } from 'csv-parse/sync';
import { purchaseQuantity } from './recipeUnits';
import { nameKey, normalizeName, validLabel, validPrice, validQuantity } from './validation';

export type Problem = { file: 'ingredients' | 'recipes'; row: number | null; code: string; message: string };
export type ImportIngredient = { name: string; purchase_unit: string; purchase_quantity: number; purchase_price: number | null; existing_id?: string };
export type ImportLine = { ingredient_name: string; quantity: number; unit: string; original_quantity: number; original_unit: string };
export type ImportRecipe = { name: string; instructions: string; yield_quantity: number; yield_unit: string; ingredients: ImportLine[] };
export type ImportPlan = { ingredients: ImportIngredient[]; recipes: ImportRecipe[]; warnings: Problem[]; errors: Problem[]; skipped_ingredients: number };
export const ingredientHeaders = ['name', 'purchase_unit', 'purchase_quantity', 'purchase_price'];
export const recipeHeaders = ['recipe_name', 'instructions', 'yield_quantity', 'yield_unit', 'ingredient_name', 'quantity', 'unit'];

function readCsv(input: string, file: Problem['file'], headers: string[], limit: number, errors: Problem[]): Record<string, string>[] {
  if (!input.trim()) return [];
  if (Buffer.byteLength(input) > 750000) { errors.push({ file, row: null, code: 'FILE_TOO_LARGE', message: 'Each CSV must be at most 750,000 UTF-8 bytes' }); return []; }
  try {
    // Strict RFC-style quoting, BOM, CRLF and quoted multiline instructions.
    const records = parse(input, { bom: true, skip_empty_lines: true, max_record_size: 50000 }) as string[][];
    const header = records.shift()?.map(s => s.trim());
    if (!header || new Set(header).size !== headers.length || header.length !== headers.length || headers.some(h => !header.includes(h))) {
      errors.push({ file, row: 1, code: 'HEADERS', message: `Use exactly these columns: ${headers.join(',')}` }); return [];
    }
    if (records.length > limit) { errors.push({ file, row: null, code: 'ROW_LIMIT', message: `At most ${limit} data rows per file` }); return []; }
    return records.map(record => Object.fromEntries(header.map((key, index) => [key, record[index]])));
  } catch {
    errors.push({ file, row: null, code: 'CSV_INVALID', message: 'Invalid CSV quoting, column count, or record length' }); return [];
  }
}
function numberCell(value: string): number {
  // Exponents, currency symbols, fractions and empty strings are not guessed.
  return /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : NaN;
}
export function buildImportPlan(ingredientsCsv: string, recipesCsv: string, catalog: any[], savedRecipes: any[]): ImportPlan {
  const plan: ImportPlan = { ingredients: [], recipes: [], warnings: [], errors: [], skipped_ingredients: 0 };
  const problem = (file: Problem['file'], row: number | null, code: string, message: string, warning = false) => (warning ? plan.warnings : plan.errors).push({ file, row, code, message });
  const available = new Map<string, ImportIngredient>();
  for (const item of catalog) {
    const key = nameKey(item.name);
    if (available.has(key)) problem('ingredients', null, 'AMBIGUOUS_CATALOG', `Multiple catalog ingredients match ${item.name}`);
    available.set(key, { name: item.name, purchase_unit: item.purchase_unit, purchase_quantity: Number(item.purchase_quantity), purchase_price: item.purchase_price == null ? null : Number(item.purchase_price), existing_id: String(item.ingredient_id) });
  }
  const seen = new Map<string, ImportIngredient>();
  for (const [index, row] of readCsv(ingredientsCsv, 'ingredients', ingredientHeaders, 1000, plan.errors).entries()) {
    const n = index + 2, name = normalizeName(row.name), quantity = numberCell(row.purchase_quantity);
    const price = row.purchase_price.trim() ? numberCell(row.purchase_price) : null;
    if (!validLabel(name, 150) || !validLabel(row.purchase_unit, 50) || !validQuantity(quantity) || (price !== null && !validPrice(price))) {
      problem('ingredients', n, 'INVALID_INGREDIENT', 'Name/unit required; quantity positive (4 decimals); price blank or nonnegative (2 decimals), within storage limits'); continue;
    }
    const item: ImportIngredient = { name, purchase_unit: row.purchase_unit.trim().toLowerCase(), purchase_quantity: quantity, purchase_price: price };
    const key = nameKey(name), previous = seen.get(key) ?? available.get(key);
    if (previous) {
      if (previous.purchase_unit.trim().toLowerCase() !== item.purchase_unit || previous.purchase_quantity !== quantity || previous.purchase_price !== price) {
        problem('ingredients', n, 'INGREDIENT_CONFLICT', `${name} already has different purchase details. Edit/remove the CSV row; import never overwrites a purchase`);
      } else {
        plan.skipped_ingredients++;
        problem('ingredients', n, 'INGREDIENT_REUSED', `${name} matches an existing catalog or earlier CSV row`, true);
      }
      continue;
    }
    seen.set(key, item); available.set(key, item); plan.ingredients.push(item);
    if (price === null) problem('ingredients', n, 'UNKNOWN_PRICE', `${name} is unpriced; affected recipe costs will be unavailable`, true);
  }
  const existingNames = new Set(savedRecipes.map(r => nameKey(r.name)));
  const groups = new Map<string, ImportRecipe>();
  for (const [index, row] of readCsv(recipesCsv, 'recipes', recipeHeaders, 5000, plan.errors).entries()) {
    const n = index + 2, name = normalizeName(row.recipe_name), key = nameKey(name);
    const quantity = numberCell(row.quantity), yieldQuantity = numberCell(row.yield_quantity);
    if (!validLabel(name, 150) || !validLabel(row.instructions, 10000) || !validQuantity(yieldQuantity) || !validLabel(row.yield_unit, 50) || !validLabel(row.ingredient_name, 150) || !validQuantity(quantity) || !validLabel(row.unit, 50)) {
      problem('recipes', n, 'INVALID_RECIPE_ROW', 'Name/instructions/yield/unit and ingredient measurement are required; positive quantities have at most four decimals'); continue;
    }
    if (existingNames.has(key)) { problem('recipes', n, 'RECIPE_CONFLICT', `${name} already exists, including archived recipes. Import never overwrites it`); continue; }
    const ingredient = available.get(nameKey(row.ingredient_name));
    if (!ingredient) { problem('recipes', n, 'INGREDIENT_MISSING', `No catalog or CSV ingredient matches ${row.ingredient_name}`); continue; }
    const stored = catalog.find(i => String(i.ingredient_id) === ingredient.existing_id);
    if (stored?.is_active === false) { problem('recipes', n, 'INGREDIENT_ARCHIVED', `${ingredient.name} is archived; restore it first`); continue; }
    const converted = purchaseQuantity(quantity, row.unit, ingredient.purchase_unit);
    const rounded = converted === null ? 0 : Math.round(converted * 10000) / 10000;
    if (!validQuantity(rounded)) { problem('recipes', n, 'UNIT_INCOMPATIBLE', `Cannot convert ${row.unit} to ${ingredient.purchase_unit} for ${ingredient.name} within storage precision`); continue; }
    const candidate: ImportRecipe = { name, instructions: row.instructions.trim(), yield_quantity: yieldQuantity, yield_unit: row.yield_unit.trim(), ingredients: [] };
    let recipe = groups.get(key);
    if (recipe && (recipe.instructions !== candidate.instructions || recipe.yield_quantity !== yieldQuantity || recipe.yield_unit !== candidate.yield_unit)) {
      problem('recipes', n, 'METADATA_CONFLICT', `${name} has inconsistent instructions or yield across rows`); continue;
    }
    if (!recipe) { recipe = candidate; groups.set(key, recipe); }
    if (recipe.ingredients.some(i => nameKey(i.ingredient_name) === nameKey(ingredient.name))) {
      problem('recipes', n, 'DUPLICATE_LINE', `${ingredient.name} occurs more than once in ${name}; combine its amounts explicitly`); continue;
    }
    recipe.ingredients.push({ ingredient_name: ingredient.name, quantity: rounded, unit: ingredient.purchase_unit, original_quantity: quantity, original_unit: row.unit.trim() });
    if (ingredient.purchase_price === null) problem('recipes', n, 'UNKNOWN_PRICE', `${ingredient.name} is unpriced; ${name} will have unavailable batch cost`, true);
    if (recipe.ingredients.length > 50) problem('recipes', n, 'LINE_LIMIT', `${name} exceeds 50 ingredient lines`);
  }
  plan.recipes = [...groups.values()];
  if (plan.recipes.length > 200) problem('recipes', null, 'RECIPE_LIMIT', 'At most 200 recipes per import');
  if (!plan.ingredients.length && !plan.recipes.length && !plan.errors.length) problem('ingredients', null, 'NOTHING_NEW', 'No new ingredients or recipes to import');
  return plan;
}
