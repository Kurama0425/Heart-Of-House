# Recipe import preparation

Goal: migrate an existing kitchen's recipe binder or spreadsheet without
manually retyping every ingredient line. **Bulk import is not implemented yet.**
This document is the source contract for a future preview-first importer.

## Recommended source files

Export two UTF-8 CSV files (or provide the original spreadsheet for review).

`ingredients.csv`:

```csv
name,purchase_unit,purchase_quantity,purchase_price
Bread flour,lb,25,18.50
Water,ml,1000,
Salt,lb,1,2.25
```

Blank `purchase_price` means unknown. `0` means intentionally free. Purchase
quantity must be positive. Prices must not be guessed. Each restaurant's
ingredient names are compared case-insensitively after trimming and collapsing
whitespace, so `Flour` and ` flour ` are the same catalog item.

`recipes.csv` (one row per ingredient line; repeat recipe metadata):

```csv
recipe_name,instructions,yield_quantity,yield_unit,ingredient_name,quantity,unit
Pizza dough,Mix and knead,8,portion,Bread flour,16,oz
Pizza dough,Mix and knead,8,portion,Water,500,ml
Pizza dough,Mix and knead,8,portion,Salt,0.5,oz
```

For multi-line instructions, quote the CSV field correctly or keep a separate
recipe document with a stable recipe name. Include source filenames/notes so
unresolved conversions can be traced to the original kitchen records.

## Preview and validation before importing

1. Back up the original files and the database; use a test restaurant first.
2. Group rows by recipe name, preserving instructions and yield.
3. Match ingredient names within the selected restaurant; flag ambiguous names
   and missing ingredients rather than creating duplicates silently.
4. Validate one consistent recipe yield, 1–50 unique ingredients per recipe,
   positive quantities (up to four decimals), and supported unit conversions.
5. Weight (g/kg/oz/lb) and US volume (ml/l/tsp/tbsp/cup/pt/qt/gal) convert
   only within their respective families. Unknown units such as each/case
   must exactly match the catalog's purchase unit. Do not guess density.
6. Show a preview of converted purchase quantities, original quantities/units,
   unknown prices, and recipe-name conflicts. Require explicit approval of
   ambiguous mappings and existing-recipe overwrites.
7. Import in a transaction or small resumable batches with an audit summary;
   never overwrite existing recipes by default.

## Known limitations

Legacy recipes created before migration 004 cannot recover the units originally
typed: the migration backfills their stored purchase units. New saves and edits
preserve original quantities/units. Recipe costing uses current catalog prices
and excludes waste, labor, overhead, and historical purchase-price snapshots.

Do not load real restaurant data into a publicly accessible installation
until authentication, authorization, backups, and recovery are in place.
