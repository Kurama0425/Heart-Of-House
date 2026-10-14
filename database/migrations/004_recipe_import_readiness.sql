-- Preserve recipe measurements and distinguish unknown prices from free ingredients.
-- Existing recipe lines were stored only in purchase units; legacy values are
-- backfilled from those units because the original input cannot be reconstructed.
ALTER TABLE recipe_ingredients
  ADD COLUMN original_quantity NUMERIC(12,4),
  ADD COLUMN original_unit VARCHAR(50);

UPDATE recipe_ingredients
SET original_quantity = quantity, original_unit = unit;

ALTER TABLE recipe_ingredients
  ALTER COLUMN original_quantity SET NOT NULL,
  ALTER COLUMN original_unit SET NOT NULL,
  ADD CONSTRAINT recipe_ingredients_original_quantity_positive CHECK (original_quantity > 0);

-- A null price means not yet priced; existing zeroes are preserved as entered.
ALTER TABLE ingredients
  ALTER COLUMN purchase_price DROP DEFAULT,
  ALTER COLUMN purchase_price DROP NOT NULL;

-- Do not silently merge existing ingredients: that could corrupt recipe references.
-- If this index finds legacy case/whitespace duplicates, migration fails safely
-- and reports the duplicates so the operator can reconcile them explicitly.
CREATE UNIQUE INDEX ingredients_restaurant_normalized_name_uniq
  ON ingredients (restaurant_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));
