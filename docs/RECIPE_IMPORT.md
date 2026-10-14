# Preview-first CSV recipe import

Bulk import is implemented through the v1 API. The React upload/preview screen is
future frontend work. See [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md) for that flow.

## Source files

UTF-8 CSV with these exact headers (column order may vary). BOM, CRLF, escaped
quotes, commas and quoted multiline instructions are supported. Headers cannot
be duplicated or renamed. This API does not parse Excel workbooks, photos or PDFs.

`ingredients.csv`:

```csv
name,purchase_unit,purchase_quantity,purchase_price
Bread flour,lb,25,18.50
Water,ml,1000,
Salt,lb,1,0
```

Blank price means unknown. Zero means free. Name/unit are required; name is trimmed,
whitespace collapsed and matched case-insensitively. Positive purchase quantities
have at most four significant decimal places within storage limits. Supplied prices
are nonnegative with at most two decimals. No prices, package sizes or units are guessed.

`recipes.csv` (one record per ingredient line, repeating recipe metadata):

```csv
recipe_name,instructions,yield_quantity,yield_unit,ingredient_name,quantity,unit
Pizza dough,"Mix, then knead.",8,portion,Bread flour,16,oz
Pizza dough,"Mix, then knead.",8,portion,Water,500,ml
Pizza dough,"Mix, then knead.",8,portion,Salt,0.5,oz
```

Group by normalized recipe name. Instructions/yield must agree across all its rows.
Require 1–50 unique ingredients. Combine repeated ingredient lines explicitly; the
importer never guesses whether they are duplicates or separate additions. Use numeric
decimals such as 0.5, not fractions like 1/2, currency symbols or exponents.

Compatible weight (g/kg/oz/lb) and US volume (ml/l/tsp/tbsp/cup/pt/qt/gal) convert
for costing. Custom units must match the catalog. No weight-to-volume/density guesses.
Original quantities/units remain stored beside normalized purchase-unit quantities.

## Limits

Each CSV <=750,000 UTF-8 bytes; combined JSON request <=2 MiB. Up to 1,000 ingredient
records, 5,000 recipe-line records, 200 recipes, and 50 lines per recipe per batch.
Individual CSV record size is bounded at 50,000 characters. Large collections should
be split deliberately; each accepted batch is atomic, not a streaming/resumable job.

## API flow

1. POST `/api/v1/restaurants/:restaurantId/imports/preview` with JSON CSV text:
   `{ingredients_csv,recipes_csv}`. Either file may be omitted.
2. Read `can_commit`, `preview.errors`, `preview.warnings`, planned purchases/recipes
   and original/converted amounts. Preview writes no kitchen records.
3. Fix errors in source files and preview again. Unknown-price warnings are nonblocking.
4. After explicit user confirmation, POST `/imports/:importId/commit` with ONLY
   `{confirm:true}`. The import ID identifies the exact immutable reviewed plan.
5. Display its receipt, then refresh catalog/recipe lists. GET `/imports/:importId`
   retrieves a plan/receipt; retrying the same commit is safe after a lost response.

Plans expire after 24 hours. Catalog or recipe changes make a plan stale; confirmation
returns 409 and requires a fresh preview. A new preview receives a new ID, so it never
silently changes another open screen's plan. A successful source hash has one durable
receipt per kitchen. Concurrent/repeated confirmation saves once and returns that receipt.

The confirmation transaction locks the plan and relevant catalog rows, bulk-inserts
new purchases/recipe lines, and records the receipt in the same transaction. A write
failure rolls back all new purchases, recipes, lines and status changes. No partial
success or silent overwrite occurs. Successful retries return the original counts,
not a claim that new rows were inserted again.

## Matching/conflict policy

- Match catalog ingredients by normalized name within THIS kitchen only.
- Identical ingredient CSV rows reuse existing purchases/earlier source rows and
  contribute to `skipped_ingredients` (a source-row count).
- A different unit, quantity or price for an existing ingredient is an error, even
  if the incoming value is blank. Edit the catalog separately or remove that CSV row.
- Unknown/ambiguous/archived ingredient mappings block recipes until corrected.
- Existing recipe names, including archived ones, block that source recipe. Edit
  the existing recipe manually; bulk import never overwrites it.
- Repeating an already committed set of files returns its receipt instead of importing again.

## Problem codes

Each error/warning has file, logical CSV record number (header=1) or null, code and
message. Quoted multiline fields mean record numbers differ from physical line numbers.

| Code | Meaning |
|---|---|
| HEADERS / CSV_INVALID | Wrong columns, malformed quoting, record length or column counts |
| FILE_TOO_LARGE / ROW_LIMIT / RECIPE_LIMIT / LINE_LIMIT | Split or reduce the source |
| INVALID_INGREDIENT / INVALID_RECIPE_ROW | Missing/invalid labels, prices or measurements |
| AMBIGUOUS_CATALOG | More than one existing ingredient matches; reconcile explicitly |
| INGREDIENT_CONFLICT | Source purchase differs from the existing purchase |
| INGREDIENT_REUSED | Warning: identical ingredient row skipped/reused |
| INGREDIENT_MISSING / INGREDIENT_ARCHIVED | Map or restore the catalog ingredient first |
| RECIPE_CONFLICT / METADATA_CONFLICT / DUPLICATE_LINE | Resolve existing names or inconsistent/repeated recipe rows |
| UNIT_INCOMPATIBLE | Unsupported conversion or a converted amount outside storage precision |
| UNKNOWN_PRICE | Warning: affected costs will be unavailable, not $0 |
| NOTHING_NEW | No new purchases/recipes can be imported |

## Migrations and limits still in place

Migration 004 preserves new recipe inputs and nullable prices; original inputs lost
before it cannot be reconstructed. Migration 005 adds immutable preview plans and
receipts. Migration 006 enforces normalized recipe-name uniqueness. Legacy duplicate
names stop the relevant migration safely; nothing is automatically merged/deleted.

Use fictional/test kitchens first and retain original source files. This importer
is local, with no authentication/authorization, OCR, overwrite mode, price-history
snapshots or preview-retention cleanup job. Public hosting requires separate security
and recovery work. Recipes with unknown prices have unavailable batch/portion costs.

## Read-only legacy duplicate diagnostics

Run these in pgAdmin Query Tool only if a normalized-name index migration fails:

```sql
SELECT restaurant_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AS normalized_name,
       array_agg(ingredient_id::text ORDER BY ingredient_id) AS ids
FROM ingredients
GROUP BY restaurant_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
HAVING count(*) > 1;

SELECT restaurant_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AS normalized_name,
       array_agg(recipe_id::text ORDER BY recipe_id) AS ids
FROM recipes
GROUP BY restaurant_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
HAVING count(*) > 1;
```

These queries do not change data. Rename genuinely different records deliberately;
merging recipe references requires a separate reviewed decision. Do not delete or
recreate the database to make a migration pass.
