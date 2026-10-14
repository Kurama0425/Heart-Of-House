# Local kitchen API contract — v1

Base: `http://localhost:3000`. JSON request/response bodies. Data paths begin with
`/api/v1/restaurants`. This is the frontend contract for the current local backend;
additive response fields may be added, but the envelopes and semantics below are
stable. It is not a hosted authentication contract.

## Common types and failures

- Resource IDs: positive PostgreSQL bigint **strings**, no leading zeros.
- Import IDs: UUID strings.
- Stored decimal quantities/prices/costs: **strings**; unavailable prices/costs: `null`.
- Input numbers: finite JSON numbers. Positive quantities <100,000,000 with at most
  four decimals; prices >=0 and <10,000,000,000 with at most two decimals.
- Dates: real `YYYY-MM-DD` days. Timestamps: ISO strings.
- Every ordinary API error: `{ "error": "human-readable message" }`.
  Do not key frontend behavior on the exact English sentence; use status/code.

| Status | Meaning / frontend behavior |
|---|---|
| 200 | Read, edit, archive/restore, preview, or repeat import confirmation |
| 201 | Created kitchen/ingredient/recipe/prep/template/run or first committed import |
| 400 | Invalid JSON, fields, IDs, measurements or missing explicit confirmation |
| 403 | Browser Origin is not in WEB_ORIGINS |
| 404 | Target not found in that kitchen |
| 409 | Duplicate/conflicting data, protected archive/unit edit, or stale/expired import preview |
| 413 | JSON request exceeds the route's body limit |
| 503 | Database/service unavailable; show retry, never fake a successful save |
| 500 | Unexpected internal error, with details withheld |

Ordinary JSON requests are limited to 256 KiB; import JSON requests to 2 MiB.
CSV validation problems are different: preview returns HTTP 200 with
`can_commit: false` and structured `preview.errors` so a UI can show every problem.

## Complete endpoint index

`R` below means `/api/v1/restaurants/:restaurantId`.

| Method | Path | Request | Success envelope |
|---|---|---|---|
| GET | `/health` | None | `{status,service,database,timestamp}`; 503 if disconnected |
| GET | `/api/v1/restaurants` | None | `{restaurants:[Restaurant]}` (first 100 by ID) |
| POST | `/api/v1/restaurants` | Restaurant fields, name required | `{restaurant:Restaurant}` |
| GET | `R` | None | `{restaurant:Restaurant}` |
| PATCH | `R` | One or more restaurant fields | `{restaurant:Restaurant}` |
| GET | `R/ingredients` | None | `{ingredients:[Ingredient]}` (active only) |
| POST | `R/ingredients` | IngredientPurchase | `{ingredient:Ingredient}` |
| GET | `R/ingredients/:ingredientId` | None | `{ingredient:Ingredient}` (includes archived) |
| PUT | `R/ingredients/:ingredientId` | IngredientPurchase | `{ingredient:Ingredient}` |
| PATCH | `R/ingredients/:ingredientId` | `{is_active:boolean}` | `{ingredient:Ingredient}` |
| DELETE | `R/ingredients/:ingredientId` | None | `{ingredient:Ingredient}` (soft archive) |
| GET | `R/recipes` | None | `{recipes:[Recipe]}` (active only; no detail lines/costs) |
| POST | `R/recipes` | RecipeInput | `{recipe:Recipe}` |
| GET | `R/recipes/:recipeId` | None | `{recipe:RecipeDetail}` (includes archived) |
| PUT | `R/recipes/:recipeId` | RecipeInput | `{recipe:Recipe}` |
| PATCH | `R/recipes/:recipeId` | `{is_active:boolean}` | `{recipe:Recipe}` |
| DELETE | `R/recipes/:recipeId` | None | `{recipe:Recipe}` (soft archive) |
| GET | `R/prep-lists?date=YYYY-MM-DD` | None | `{prep_list:PrepList|null}` |
| POST | `R/prep-lists` | `{date,title,tasks:string[]}` | `{prep_list:PrepList}` |
| PATCH | `R/prep-lists/tasks/:taskId` | One of `{is_complete:boolean}` or `{description:string}` | `{task:PrepTask}` |
| GET | `R/checklists/templates` | None | `{templates:[Template]}` |
| POST | `R/checklists/templates` | TemplateInput | `{template:Template}` |
| GET | `R/checklists/templates/:templateId` | None | `{template:Template}` |
| PUT | `R/checklists/templates/:templateId` | TemplateInput | `{template:Template}` |
| GET | `R/checklists/runs?date=YYYY-MM-DD` | None | `{runs:[ChecklistRun]}` |
| POST | `R/checklists/runs` | `{template_id,date,shift_label}` | `{run:ChecklistRun}` |
| PATCH | `R/checklists/runs/tasks/:taskId` | `{is_complete:boolean}` | `{task:RunTask}` |
| GET | `R/imports` | None | `{imports:[ImportHistoryEntry]}` (latest 100, no plan contents) |
| POST | `R/imports/preview` | `{ingredients_csv?:string,recipes_csv?:string}` | PreviewResult or prior committed receipt |
| GET | `R/imports/:importId` | None | Stored preview/receipt, expiry and `can_commit` |
| POST | `R/imports/:importId/commit` | Exactly `{confirm:true}` | ImportReceipt (201 first, 200 repeat) |

Ingredient/recipe lists accept `?include_archived=true` to return active and archived
records together; omitted/false returns active only. Other values return 400.
Import history entries contain import_id, status, creation/expiry/commit timestamps
and summary. GET the entry to resolve duplicate plans to their canonical receipt.

Restaurant selection is frontend state; no "select" write endpoint is required.
An empty day returns null/[] in prep/run reads. These empty-day reads do not separately
verify the kitchen exists; use the restaurant GET when validating a saved selection.
There is no restaurant-delete endpoint and no physical ingredient/recipe delete.

## Restaurant

Supported fields: `name` (150 characters), `address_line1/address_line2` (200),
`city` (100), `state` (50), `postal_code` (20), `phone` (30), `timezone` (80).
Strings are trimmed. Contact/address fields accept null. Name cannot be blank/null;
timezone cannot be blank/null and must be recognized by Node's Intl timezone database.
POST requires name and defaults timezone to America/New_York. PATCH supports partial
updates, preserves omitted fields and requires at least one supported field.

Restaurant responses include `restaurant_id`, all supported fields, `created_at`
and `updated_at`. SQL is scoped by restaurant_id and values are parameterized.

## Ingredient purchase

```json
{"name":"Bread flour","purchase_unit":"lb","purchase_quantity":25,"purchase_price":18.5}
```

Name/unit required (150/50 characters); quantities/prices follow the common numeric
limits. Omitted/null price means unknown. PUT is a full purchase edit: resubmit name,
unit, quantity and the intended price; omitting price changes it to unknown.
Names are trimmed, whitespace collapsed and unique case-insensitively per kitchen.
Unknown custom units are allowed, but recipe conversion requires a matching unit.

Responses include `ingredient_id`, `restaurant_id`, the input fields as stored decimal
strings, `is_active`, `created_at`, `updated_at`. Derive purchase cost per unit as
price ÷ purchase_quantity for display only; do not treat null as 0.

A purchase unit cannot be changed while ANY recipe references the ingredient.
Archiving is blocked while an active recipe uses it. Archive is reversible, preserves
all rows and reserves the name. Direct GET/PUT can retrieve/edit archived purchases;
POST/PUT recipe and import cannot introduce archived ingredients into a new plan.

## Recipe input/detail and costs

```json
{"name":"Dough","instructions":"Mix and knead.","yield_quantity":8,"yield_unit":"portion","ingredients":[{"ingredient_id":"7","quantity":16,"unit":"oz"}]}
```

Name required (150), nonblank instructions (10,000), yield unit (50), positive yield,
and 1–50 unique ingredient IDs in this kitchen. Each line requires a positive quantity
and unit (50). Unknown fields are rejected. Names normalize whitespace and are unique
case-insensitively, including archived records. PUT replaces the full recipe and its
lines transactionally. Ingredient locks prevent conversions from using changed units;
the SQL checks current ingredient ownership, activity and purchase units again.

Weight conversions: g/kg/oz/lb. US volume: ml/l/tsp/tbsp/cup/pt/qt/gal. Custom units
must match after trim/case normalization. No density, case-size, package or fraction
guesses. Converted costing quantities round to four decimals; overflow/underflow
that cannot fit a positive stored quantity is rejected.

Recipe record: `recipe_id`, `restaurant_id`, `name`, `description` (legacy nullable),
`instructions`, `yield_quantity`, `yield_unit`, `is_active`, timestamps. Save results
also include `ingredient_count`. Detail adds:

```json
{"ingredients":[{"ingredient_id":"7","name":"Bread flour","quantity":"1.0000","unit":"lb","original_quantity":"16.0000","original_unit":"oz","purchase_quantity":"25.0000","purchase_price":"18.50","line_cost":"0.74000000000000000000"}],"costing":{"batch_cost":"0.74000000000000000000","portion_cost":"0.09250000000000000000"}}
```

Extra internal decimal fields can be returned on detail lines. Treat costs as decimal
strings without assuming a fixed trailing-zero count. Database arithmetic uses NUMERIC
and sums before display rounding. All lines must be priced with valid purchase units;
otherwise batch and portion costs are null. Portion cost is available only for
portion/portions/serving/servings yields. Costs use current purchase prices, excluding
labor, waste, overhead and historical price snapshots. Restore referenced archived
ingredients before restoring an archived recipe.

## Prep

POST: date, title (nonblank <=150), 1–50 nonblank task strings (<=300 each).
Only one prep list per kitchen/date. Tasks trim surrounding whitespace.

PrepList: `prep_list_id`, `prep_date`, `title`, `tasks`.
PrepTask: `prep_task_id`, `description`, integer `position`, boolean `is_complete`,
optional `completed_at` timestamp/null. Completion PATCH persists its timestamp;
description PATCH preserves completion. Send exactly one supported field.

## Checklists

TemplateInput: `{name,checklist_type,tasks}`. Name <=150, type opening/closing,
1–50 task strings <=300. Template: `checklist_template_id`, `name`, `checklist_type`,
`tasks:[{description,position}]`. PUT replaces only the reusable template and is
atomic; dated runs retain their original task/name/type snapshots.

Start run: valid template ID, date and nonblank `shift_label` <=80. One run per
kitchen/template/date/shift label. ChecklistRun: `checklist_run_id`, `run_date`,
`shift_label`, `template_name`, `checklist_type`, `tasks:[RunTask]`.
RunTask: `checklist_run_task_id`, `description`, `position`, `is_complete`.
Template/run task IDs and completion writes cannot cross kitchen boundaries.

## Import contract

[RECIPE_IMPORT.md](RECIPE_IMPORT.md) defines CSV headers, validation codes and limits.
At least one nonempty CSV string is required; no upload/multipart protocol is needed.
Preview plans are immutable, expire after 24 hours, and never write ingredient/recipe
records. Catalog/name conflicts block the entire plan; price warnings do not.

PreviewResult: `import_id` (UUID or null for invalid), `status` (preview/invalid/committed),
`can_commit`, optional `expires_at`, `expired`, `preview`, `summary`, `already_imported`.
Preview: `ingredients` planned new purchases, `recipes` planned new recipes with
converted and original line measurements, `warnings`, `errors`, `skipped_ingredients`.
A Problem is `{file:"ingredients"|"recipes",row:number|null,code,message}`.
Row is the CSV RECORD number including the header, not a physical line number when
instructions contain quoted newlines. File-level/catalog problems have row null.

Commit must contain only `confirm:true`. First commit returns 201:

```json
{"import_id":"63c62624-2e55-445c-b65d-63e7b833a951","status":"committed","already_committed":false,"summary":{"imported_ingredients":3,"imported_recipes":1,"skipped_ingredients":0,"ingredients":[{"ingredient_id":"7","name":"Bread flour"}],"recipes":[{"recipe_id":"9","name":"Dough"}],"warnings":[]}}
```

Summary ingredient/recipe arrays contain ALL imported records (shortened above).
Skipping counts identical ingredient CSV ROWS, including repeated source rows; no
existing recipe is overwritten/skipped silently. Reconfirming a successful batch or
confirming a duplicate preview of the same files returns 200 and the original receipt.
`requested_import_id` may identify the duplicate plan that led to a canonical receipt.

Changed kitchen data or expiry requires a fresh preview (409). Constraint races
return 409 and roll back. Database/write failures return 503, with no partial kitchen
writes. If confirmation's response is lost, retry the same ID or GET its status;
the durable receipt prevents double saves. Original CSV text is not stored; structured
plans and receipts remain local in import_batches. Receipts and previews are not
currently automatically purged; do not expose them publicly.

## Runtime/security boundary

Default bind address is 127.0.0.1. WEB_ORIGINS defaults to localhost/127.0.0.1 port 5173;
untrusted browser origins are rejected with 403. CLI requests without Origin work.
Connection acquisition times out after 5 seconds; statements/idle transactions after
30 seconds. Idle connection failures are handled; Ctrl+C/SIGTERM drain the pool.
These limits are not a replacement for authentication/authorization. Local SQL
restaurant scoping prevents accidental mixing; it does not prove the caller owns
that kitchen. Hosting, backups, recovery and login/access control remain separate work.
