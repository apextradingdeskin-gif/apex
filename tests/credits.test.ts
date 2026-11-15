import test from "node:test";
import assert from "node:assert/strict";
import { estimateCredits } from "../src/lib/credits.ts";

const offer = { price: 150, discount_percent: 20, credit_base: 10, credit_rate: 0.5, credit_cap: null, min_purchase: 0 };

test("uses discounted price when no amount given", () => {
  const e = estimateCredits(offer);               // 150 × 0.8 = 120 → 10 + 60 = 70
  assert.equal(e.credits, 70); assert.equal(e.discountedPrice, 120); assert.ok(e.eligible);
});
test("override amount replaces price", () => assert.equal(estimateCredits(offer, 100).credits, 60));
test("minimum purchase blocks credits", () => {
  const e = estimateCredits({ ...offer, min_purchase: 200 }, 100);
  assert.equal(e.eligible, false); assert.equal(e.credits, 0);
});
test("cap applies", () => assert.equal(estimateCredits({ ...offer, credit_cap: 25 }).credits, 25));
test("floors fractional credits", () => assert.equal(estimateCredits({ ...offer, credit_base: 0, credit_rate: 0.333 }, 10).credits, 3));
test("no price and no amount with a rate is ineligible", () => {
  const e = estimateCredits({ ...offer, price: null });
  assert.equal(e.eligible, false);
});
test("flat-credit offer needs no amount", () => {
  assert.equal(estimateCredits({ price: null, discount_percent: null, credit_base: 40, credit_rate: 0, credit_cap: null, min_purchase: null }).credits, 40);
});
