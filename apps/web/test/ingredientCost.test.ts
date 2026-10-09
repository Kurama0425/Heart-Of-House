import test from "node:test";
import assert from "node:assert/strict";
import { ingredientUnitCost, formatIngredientUnitCost } from "../src/ingredientCost.ts";

test("purchase cost is divided by quantity, including fractional quantities", () => {
  assert.equal(ingredientUnitCost("25", "18.50"), 0.74);
  assert.equal(ingredientUnitCost("0.5", "3"), 6);
  assert.equal(ingredientUnitCost("5", "0"), 0);
});
test("incomplete and invalid purchases never produce an invalid displayed cost", () => {
  for (const [quantity, price] of [["", "5"], ["0", "5"], ["-1", "5"], ["2", ""], ["2", "-1"], ["Infinity", "5"], ["2", "NaN"]]) {
    assert.equal(ingredientUnitCost(quantity, price), null);
  }
  assert.equal(formatIngredientUnitCost("2", "5", " "), "—");
});
test("display preserves small costs and identifies the purchase unit", () => {
  assert.equal(formatIngredientUnitCost("25", "18.50", " lb "), "$0.74 / lb");
  assert.equal(formatIngredientUnitCost("1000", "1", "g"), "$0.001 / g");
  assert.equal(formatIngredientUnitCost("3", "1", "each"), "$0.3333 / each");
});
