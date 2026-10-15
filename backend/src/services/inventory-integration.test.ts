import test from "node:test";
import assert from "node:assert/strict";
import { buildInventoryDeductionPlan } from "./inventory-integration.js";

test("deducts a matching vaccine from inventory", () => {
  const result = buildInventoryDeductionPlan(
    "vaccinations",
    { vaccine_type: "Rabies Vaccine" },
    [{ id: "1", name: "Rabies Vaccine", category: "vaccine", quantity: 2 }]
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(result.plan, [{ itemId: "1", quantity: 1, reason: "Care History — Vaccination" }]);
});

test("rejects treatment inventory if stock is insufficient", () => {
  const result = buildInventoryDeductionPlan(
    "care_records",
    { record_type: "treatment", medication: "Amoxicillin" },
    [{ id: "2", name: "Amoxicillin", category: "medication", quantity: 0 }]
  );

  assert.equal(result.error, "Insufficient available stock for Amoxicillin.");
  assert.deepEqual(result.plan, []);
});

test("deducts matching dewormer inventory", () => {
  const result = buildInventoryDeductionPlan(
    "dewormings",
    { product: "Heartgard Plus" },
    [{ id: "3", name: "Heartgard Plus", category: "dewormer", quantity: 4 }]
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(result.plan, [{ itemId: "3", quantity: 1, reason: "Care History — Deworming" }]);
});

test("does not fail when treatment record has narrative notes but no medications selected", () => {
  const result = buildInventoryDeductionPlan(
    "care_records",
    {
      record_type: "treatment",
      treatment: "Wound cleaned with gauze and povidone iodine, bandage applied",
      medications_json: "[]",
    },
    [
      { id: "10", name: "Gauze Pad", category: "supply", quantity: 0 },
      { id: "11", name: "Povidone Iodine", category: "supply", quantity: 0 },
    ]
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(result.plan, []);
});

test("does not fail when treatment record has narrative notes and medication is null/empty", () => {
  const result = buildInventoryDeductionPlan(
    "care_records",
    {
      record_type: "treatment",
      treatment: "Gauze Pad used for wound dressing",
      medication: null,
    },
    [
      { id: "10", name: "Gauze Pad", category: "supply", quantity: 0 },
    ]
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(result.plan, []);
});

