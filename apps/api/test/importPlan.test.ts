import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildImportPlan, ingredientHeaders, recipeHeaders } from '../src/importPlan';
const ih = ingredientHeaders.join(',') + '\n', rh = recipeHeaders.join(',') + '\n';
const catalog = [{ ingredient_id: '2', name: 'Flour', purchase_unit: 'lb', purchase_quantity: '25', purchase_price: '18.50', is_active: true }];
test('CSV handles BOM, CRLF, commas, escaped quotes and multiline instructions', () => {
  const plan = buildImportPlan('\ufeff' + ih + 'Water,ml,1000,\r\nSalt,lb,1,0', rh + 'Dough,"Mix, then ""knead""\nRest.",8,portion,flour,16,oz\nDough,"Mix, then ""knead""\nRest.",8,portion,Water,500,ml', catalog, []);
  assert.deepEqual(plan.errors, []); assert.equal(plan.ingredients[0].purchase_price, null); assert.equal(plan.ingredients[1].purchase_price, 0);
  assert.equal(plan.recipes[0].instructions, 'Mix, then "knead"\nRest.');
  assert.deepEqual(plan.recipes[0].ingredients[0], { ingredient_name: 'Flour', quantity: 1, unit: 'lb', original_quantity: 16, original_unit: 'oz' });
  assert(plan.warnings.some(w => w.code === 'UNKNOWN_PRICE'));
});
test('normalizes matching names and skips identical catalog/input rows but rejects changed purchases', () => {
  const p = buildImportPlan(ih + ' flour ,lb,25,18.50\nBread   flour,lb,25,18.50\nbread flour,lb,25,18.50', '', catalog, []);
  assert.equal(p.ingredients.length, 1); assert.equal(p.ingredients[0].name, 'Bread flour'); assert.equal(p.skipped_ingredients, 2);
  assert(buildImportPlan(ih + 'Flour,lb,25,20', '', catalog, []).errors.some(e => e.code === 'INGREDIENT_CONFLICT'));
});
test('flags metadata, name conflicts, unknown ingredients, duplicate lines and incompatible units', () => {
  for (const [csv, code] of [
    ['Dough,Mix,8,portion,Missing,1,each', 'INGREDIENT_MISSING'],
    ['Dough,Mix,8,portion,Flour,1,cup', 'UNIT_INCOMPATIBLE'],
    ['Dough,Mix,8,portion,Flour,1,lb\nDough,Mix,8,portion,flour,2,lb', 'DUPLICATE_LINE'],
    ['Dough,Mix,8,portion,Flour,1,lb\nDough,Other,8,portion,Flour,2,lb', 'METADATA_CONFLICT']
  ]) assert(buildImportPlan('', rh + csv, catalog, []).errors.some(e => e.code === code));
  assert(buildImportPlan('', rh + ' dough ,Mix,8,portion,Flour,1,lb', catalog, [{name: 'Dough'}]).errors.some(e => e.code === 'RECIPE_CONFLICT'));
});
test('strict CSV and storage validation reject malformed headers, quoting, blank/negative/precision/exponent fields', () => {
  for (const [csv, code] of [['name,name\na,b', 'HEADERS'], [ih + '"bad,lb,1,2', 'CSV_INVALID'], [ih + 'Flour,lb,-1,2', 'INVALID_INGREDIENT'], [ih + 'Flour,lb,1,0.001', 'INVALID_INGREDIENT'], [ih + 'Flour,lb,1e2,2', 'INVALID_INGREDIENT'], [ih + 'Flour,lb,,2', 'INVALID_INGREDIENT']]) {
    assert(buildImportPlan(csv, '', [], []).errors.some(e => e.code === code), code);
  }
  assert(buildImportPlan(ih + 'Flour,lb,1,2\n', '', [], []).errors.length === 0);
});
test('bounded input and archived/ambiguous mappings cannot produce valid imports', () => {
  assert(buildImportPlan(ih + 'x'.repeat(750001), '', [], []).errors.some(e => e.code === 'FILE_TOO_LARGE'));
  assert(buildImportPlan('', rh + 'Dough,Mix,8,portion,Flour,1,lb', [{...catalog[0],is_active:false}], []).errors.some(e => e.code === 'INGREDIENT_ARCHIVED'));
  assert(buildImportPlan('', rh + 'Dough,Mix,8,portion,Flour,1,lb', [...catalog, {...catalog[0], ingredient_id:'3'}], []).errors.some(e => e.code === 'AMBIGUOUS_CATALOG'));
});
