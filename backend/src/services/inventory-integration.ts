export type InventoryItemLike = {
  id: string;
  name: string;
  category: string;
  quantity: number;
};

export type InventoryDeductionPlan = Array<{
  itemId: string;
  quantity: number;
  reason: string;
}>;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ");
}

function normalizeCategory(value: unknown) {
  return normalizeText(value).replace(/\s+/g, "");
}

function isCategoryMatch(itemCategory: string, expectedCategories: string[]) {
  const normalized = normalizeCategory(itemCategory);
  return expectedCategories.includes(normalized);
}

function findMatches(items: InventoryItemLike[], categoryAliases: string[], label: string) {
  const normalizedLabel = normalizeText(label);
  if (!normalizedLabel) return [];

  return items.filter((item) => {
    if (!isCategoryMatch(item.category, categoryAliases)) return false;
    const normalizedName = normalizeText(item.name);
    return normalizedName.includes(normalizedLabel) || normalizedLabel.includes(normalizedName);
  });
}

export function buildInventoryDeductionPlan(
  table: string,
  row: Record<string, unknown>,
  items: InventoryItemLike[]
): { plan: InventoryDeductionPlan; error?: string } {
  const plan: InventoryDeductionPlan = [];
  const reqQty = Math.max(1, Number(row.medication_qty ?? 1));

  if (table === "vaccinations") {
    const label = String(row.vaccine_type ?? row.product ?? row.name ?? "").trim();
    const matches = findMatches(items, ["vaccine"], label);
    if (matches.length) {
      plan.push({ itemId: matches[0].id, quantity: reqQty, reason: "Care History — Vaccination" });
    }
    return validateInventoryDeductionPlan(plan, items);
  }

  if (table === "dewormings") {
    const label = String(row.product ?? row.dewormer_type ?? row.dewormer_used ?? row.name ?? "").trim();
    const matches = findMatches(items, ["dewormer"], label);
    if (matches.length) {
      plan.push({ itemId: matches[0].id, quantity: reqQty, reason: "Care History — Deworming" });
    }
    return validateInventoryDeductionPlan(plan, items);
  }

  if (table === "care_records") {
    const recordType = String(row.record_type ?? "").trim().toLowerCase();

    if (recordType === "vaccination" || recordType === "vaccine") {
      const label = String(row.vaccine_used ?? row.vaccine_type ?? row.treatment ?? row.medication ?? "").trim();
      const matches = findMatches(items, ["vaccine"], label);
      if (matches.length) {
        plan.push({ itemId: matches[0].id, quantity: reqQty, reason: "Care History — Vaccination" });
      }
      return validateInventoryDeductionPlan(plan, items);
    }

    if (recordType === "deworming") {
      const label = String(row.dewormer_used ?? row.product ?? row.treatment ?? row.medication ?? "").trim();
      const matches = findMatches(items, ["dewormer"], label);
      if (matches.length) {
        plan.push({ itemId: matches[0].id, quantity: reqQty, reason: "Care History — Deworming" });
      }
      return validateInventoryDeductionPlan(plan, items);
    }

    if (recordType === "treatment" || recordType === "checkup") {
      const labelSources = [row.medication, row.treatment, row.diagnosis, row.notes]
        .filter(Boolean)
        .map((value) => String(value))
        .join(" ");
      const matches = findMatches(items, ["medication", "medicine", "supply"], labelSources);
      for (const item of matches) {
        if (!plan.some((candidate) => candidate.itemId === item.id)) {
          plan.push({ itemId: item.id, quantity: reqQty, reason: `Care History — ${recordType === "treatment" ? "Treatment" : "Check-up"}` });
        }
      }
      return validateInventoryDeductionPlan(plan, items);
    }
  }

  return { plan };
}

export function validateInventoryDeductionPlan(
  plan: InventoryDeductionPlan,
  items: InventoryItemLike[]
): { plan: InventoryDeductionPlan; error?: string } {
  for (const step of plan) {
    const item = items.find((candidate) => candidate.id === step.itemId);
    if (!item) continue;
    if (Number(item.quantity ?? 0) < step.quantity) {
      return {
        plan: [],
        error: `Insufficient inventory for item "${item.name}". Available: ${item.quantity ?? 0}, Required: ${step.quantity}.`,
      };
    }
  }
  return { plan };
}
