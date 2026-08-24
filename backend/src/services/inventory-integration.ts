export type InventoryItemLike = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  reorder_level?: number | null;
  expiration_date?: string | Date | null;
  expirationDate?: string | Date | null;
  status?: string | null;
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
  return expectedCategories.some(
    (exp) => normalized.includes(exp) || exp.includes(normalized)
  );
}

export function isExpired(item: InventoryItemLike): boolean {
  if (item.status === "Expired" || item.status === "EXPIRED") return true;
  const exp = item.expiration_date ?? item.expirationDate;
  if (!exp) return false;
  const expDate = new Date(exp);
  if (isNaN(expDate.getTime())) return false;
  
  // Set to midnight comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expDate.getTime() < today.getTime();
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

  // 1. Check if structured multi-medication array is passed in payload
  let rawMedications = row.medications_json ?? row.medications ?? row.items_used ?? row.medication_items;
  if (typeof rawMedications === "string" && rawMedications.trim().startsWith("[")) {
    try {
      rawMedications = JSON.parse(rawMedications);
    } catch {
      rawMedications = null;
    }
  }

  if (Array.isArray(rawMedications) && rawMedications.length > 0) {
    for (const entry of rawMedications) {
      if (!entry || typeof entry !== "object") continue;
      const itemId = String(
        (entry as any).inventory_item_id ??
        (entry as any).itemId ??
        (entry as any).id ??
        ""
      ).trim();
      const qty = Math.max(1, Number((entry as any).quantity ?? (entry as any).qty ?? 1));

      if (itemId) {
        const item = items.find((c) => c.id === itemId);
        if (item) {
          plan.push({
            itemId: item.id,
            quantity: qty,
            reason: "Used for Care History",
          });
        }
      }
    }

    if (plan.length > 0) {
      return validateInventoryDeductionPlan(plan, items);
    }
  }

  // 2. Check for direct explicit item ID passed in row payload
  const directItemId = String(
    row.inventory_item_id ??
    row.item_id ??
    row.vaccine_item_id ??
    row.dewormer_item_id ??
    row.medication_item_id ??
    ""
  ).trim();

  if (directItemId) {
    const directItem = items.find((candidate) => candidate.id === directItemId);
    if (directItem) {
      plan.push({
        itemId: directItem.id,
        quantity: reqQty,
        reason: `Care History — ${String(row.record_type ?? table).toUpperCase()}`,
      });
      return validateInventoryDeductionPlan(plan, items);
    }
  }

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
          plan.push({
            itemId: item.id,
            quantity: reqQty,
            reason: `Care History — ${recordType === "treatment" ? "Treatment" : "Check-up"}`,
          });
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
    if (isExpired(item)) {
      return {
        plan: [],
        error: `Insufficient available stock for ${item.name}. (Selected item is expired)`,
      };
    }
    if (Number(item.quantity ?? 0) < step.quantity) {
      return {
        plan: [],
        error: `Insufficient available stock for ${item.name}.`,
      };
    }
  }
  return { plan };
}
