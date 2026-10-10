import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCost } from '../src/recipeCost.ts';
test('formats batch, fractional portion, free and unavailable food costs', () => {
  assert.equal(formatCost('18.5'), '$18.50');
  assert.equal(formatCost('0.0925'), '$0.09');
  assert.equal(formatCost('0.0037'), '$0.0037');
  assert.equal(formatCost('0.0000001'), '<$0.0001');
  assert.equal(formatCost('0'), '$0.00');
  for (const value of [null, undefined, '', 'NaN', '-1']) assert.equal(formatCost(value), 'Unavailable');
});
