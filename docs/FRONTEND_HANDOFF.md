# Heart of House: the backend handoff

The backend is the kitchen's filing cabinet and calculator. React is the counter
where you hand it an order. You do not need to write SQL to build the next screens:
send a request, show the returned result, and handle a failed request honestly.
This contract is **v1 for local kitchen use**, not a production security promise.

## What each piece does

| Piece | Kitchen equivalent | Local address |
|---|---|---|
| React frontend | The order pad and display | http://localhost:5173 |
| Express API | Takes an order and validates it | http://localhost:3000 |
| PostgreSQL | Stores the records after the shift | Configured in apps/api/.env |

Keep PostgreSQL and both development servers running. Follow [LOCAL_SETUP.md](LOCAL_SETUP.md).
The API listens on loopback. Browser origins localhost:5173 and 127.0.0.1:5173
are allowed; set `WEB_ORIGINS` in the API environment for a different development
URL, and `VITE_API_URL` in the web environment for a different API URL.

## The rules to build around

- Select one kitchen once. Every tool uses its `restaurant_id`.
- Keep IDs as **strings**, even when they look like numbers. Do not convert them to Number.
- PostgreSQL money and quantities arrive as decimal **strings**. Input requests use
  JSON numbers; send `null` for an unknown ingredient price. Zero means actually free.
- Get recipe costs from the recipe detail response. Do not add rounded display values
  to calculate a batch cost. `null` means **Unavailable**, never $0.
- Day fields are `YYYY-MM-DD`; timestamps are ISO strings. Use a local day picker,
  not `new Date().toISOString()` to choose today's date near midnight.
- Saved quantities include original measurements and separate purchase-unit measurements.
  Show/edit `original_quantity` and `original_unit`; the API handles costing conversion.
- Use returned records to update the screen, or reload the relevant GET endpoint.
- Disable duplicate saves while pending. Ignore/abort old GET requests when kitchen,
  date, or selection changes. A failed save must not leave a fake success checkbox.
- Archiving keeps data/history. Archived recipes/ingredients disappear from normal lists;
  direct detail URLs still retrieve them. Ingredient archive is blocked while an active
  recipe uses it. Restore ingredients before restoring a recipe that uses them.
- Names remain reserved after archive. Restore/edit the original record instead of
  creating another version with the same normalized name.

## A request you can reuse

```ts
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`http://localhost:3000${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
```

The existing frontend already has `src/request.ts`; reuse it rather than copying
this function into every component. The example explains the API calls.

## Everyday examples

Create a kitchen:

```ts
const { restaurant } = await api("/api/v1/restaurants", "POST", { name: "Charlie's" });
const root = `/api/v1/restaurants/${restaurant.restaurant_id}`;
```

Save an ingredient purchase:

```ts
const { ingredient } = await api(`${root}/ingredients`, "POST", {
  name: "Bread flour", purchase_unit: "lb", purchase_quantity: 25, purchase_price: 18.50
});
```

Example response (additional timestamp fields omitted):

```json
{"ingredient":{"ingredient_id":"7","restaurant_id":"1","name":"Bread flour","purchase_unit":"lb","purchase_quantity":"25.0000","purchase_price":"18.50","is_active":true}}
```

Save a recipe:

```ts
const { recipe } = await api(`${root}/recipes`, "POST", {
  name: "Dough", instructions: "Mix and knead.", yield_quantity: 8, yield_unit: "portion",
  ingredients: [{ ingredient_id: ingredient.ingredient_id, quantity: 16, unit: "oz" }]
});
const detail = (await api(`${root}/recipes/${recipe.recipe_id}`)).recipe;
```

Detail contains `ingredients` and `costing`. That flour line keeps `16.0000 oz`
for editing and `1.0000 lb` for costing. At $18.50/25 lb, batch cost is $0.74 and
unrounded portion cost is $0.0925. Display the latter as an estimate, not a bill.

## CSV import: build this screen first

1. Pick ingredient and/or recipe CSV files. Read them with `await file.text()`.
   These are UTF-8 CSV files, not photos, PDFs or .xlsx workbooks.
2. POST the CSV text as JSON:

```ts
const result = await api(`${root}/imports/preview`, "POST", {
  ingredients_csv: await ingredientFile.text(),
  recipes_csv: await recipeFile.text()
});
```

3. Render the returned preview. A preview can return HTTP 200 and still be invalid:
   check **`can_commit`**, not just the HTTP status. Show every error and warning,
   original/converted measurements, unknown prices, and skipped ingredient rows.

Valid preview shape:

```json
{"import_id":"63c62624-2e55-445c-b65d-63e7b833a951","status":"preview","can_commit":true,"expires_at":"2026-10-15T20:00:00.000Z","expired":false,"preview":{"ingredients":[],"recipes":[],"warnings":[],"errors":[],"skipped_ingredients":0}}
```

The arrays contain the actual planned purchases and recipe lines; the example
omits their contents. Invalid previews have `import_id: null`, `status: "invalid"`,
`can_commit: false`, and populated `preview.errors`. A repeated already-imported
source returns `status: "committed"`, `already_imported: true` and its receipt.

4. Show a separate **Confirm import** button. Never call commit automatically after
   selecting a file or getting a valid preview. Confirmation sends only:

```ts
const receipt = await api(`${root}/imports/${result.import_id}/commit`, "POST", { confirm: true });
```

5. Show the receipt counts, imported record names/IDs, skipped ingredient rows and
   warnings. Refresh ingredients and recipes. The first commit returns 201; retries
   return 200 with `already_committed: true`, not extra rows. With duplicate plans,
   the receipt may identify the original successful import plus `requested_import_id`.

Every preview has an immutable ID. Catalog/recipe changes after preview return
409 and require a new preview. Plans expire after 24 hours. The entire batch saves
in one transaction: an error saves **none** of its kitchen records. On a connection
failure during confirmation, retry the **same** import ID to discover its receipt;
do not assume it failed and upload the files again.

CSV formatting, limits, warning/error codes and conflict policy are in
[RECIPE_IMPORT.md](RECIPE_IMPORT.md). Exact endpoint/body/response contracts are in
[API_CONTRACT.md](API_CONTRACT.md).

## Best order for the next five frontend features

1. **CSV upload → preview → confirm → receipt:** gets the existing recipe binder in.
2. **Recipe library/search/detail/editor:** readable instructions, yields, original
   measurements and current costs; archive/restore controls.
3. **Ingredient pricing workspace:** search, edit purchase prices/quantities, highlight
   unknown prices, and show which recipe costs need pricing.
4. **Daily prep board:** date selection, completion, task wording edits and clear save/error states.
5. **Opening/closing routine editor and shift history:** edit reusable templates,
   start a fresh shift, and review completed runs without altering their snapshots.

All five have backend endpoints. The import upload screen and new archive/template
editing controls are not implemented in React in this sprint.

## What still needs backend work later

Production authentication/authorization, a tested backup/recovery/deployment setup,
historical price snapshots, OCR/Excel ingestion, and large resumable imports beyond
the current batch limits. Existing APIs are restaurant-scoped, but IDs are not login
permissions. Keep this local until those hosting safeguards exist.
