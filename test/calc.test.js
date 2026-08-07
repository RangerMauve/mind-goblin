import { test } from "node:test";
import { strict as assert } from "node:assert";
import calc from "../src/tools/calc.js";

test("calc evaluates simple addition", () => {
  const result = calc({ expression: "2 + 3" });
  assert.strictEqual(result.result, 5);
});

test("calc evaluates simple subtraction", () => {
  const result = calc({ expression: "10 - 4" });
  assert.strictEqual(result.result, 6);
});

test("calc evaluates simple multiplication", () => {
  const result = calc({ expression: "6 * 7" });
  assert.strictEqual(result.result, 42);
});

test("calc evaluates simple division", () => {
  const result = calc({ expression: "20 / 4" });
  assert.strictEqual(result.result, 5);
});

test("calc evaluates expression with parentheses", () => {
  const result = calc({ expression: "(2 + 3) * 4" });
  assert.strictEqual(result.result, 20);
});

test("calc evaluates expression with multiple operations", () => {
  const result = calc({ expression: "10 + 5 * 2" });
  assert.strictEqual(result.result, 20);
});

test("calc evaluates decimal numbers", () => {
  const result = calc({ expression: "2.5 + 3.5" });
  assert.strictEqual(result.result, 6);
});

test("calc evaluates negative numbers", () => {
  const result = calc({ expression: "-5 + 3" });
  assert.strictEqual(result.result, -2);
});

test("calc evaluates power operation", () => {
  const result = calc({ expression: "2 ** 3" });
  assert.strictEqual(result.result, 8);
});

test("calc evaluates modulo operation", () => {
  const result = calc({ expression: "10 % 3" });
  assert.strictEqual(result.result, 1);
});
