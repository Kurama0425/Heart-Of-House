-- Fail safely on legacy normalized duplicates; never silently merge recipes.
CREATE UNIQUE INDEX recipes_restaurant_normalized_name_uniq
  ON recipes (restaurant_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));
