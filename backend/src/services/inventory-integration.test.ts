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
