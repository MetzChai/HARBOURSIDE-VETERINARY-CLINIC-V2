import test from "node:test";
import assert from "node:assert/strict";

// 1. Role resolution mapping logic
export function getRoleDisplay(role?: string | null): {
  label: string;
  badgeVariant: "default" | "secondary" | "outline";
} {
  const normalized = (role || "").toLowerCase().trim();
  switch (normalized) {
    case "admin":
      return { label: "Administrator", badgeVariant: "default" };
    case "staff":
      return { label: "Clinic Staff", badgeVariant: "secondary" };
    case "owner":
      return { label: "Pet Owner", badgeVariant: "outline" };
    default:
      return { label: "Unknown", badgeVariant: "outline" };
  }
}

// 2. Authoritative role priority resolver simulating backend LEFT JOIN LATERAL
export function resolveAuthoritativeRole(roles: Array<{ role: string }>): string {
  if (!roles.length) return "Unknown";
  const priorityOrder: Record<string, number> = {
    admin: 1,
    staff: 2,
    owner: 3,
  };
  const sorted = [...roles].sort((a, b) => {
    const pA = priorityOrder[a.role.toLowerCase()] ?? 99;
    const pB = priorityOrder[b.role.toLowerCase()] ?? 99;
    return pA - pB;
  });
  return sorted[0]?.role || "Unknown";
}

// 3. Timezone-aware date normalization (Asia/Manila UTC+8)
export const PH_TIMEZONE = "Asia/Manila";

export function toDateOnlyPH(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: PH_TIMEZONE }).format(value);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  if (raw.includes("T") || raw.includes(":")) {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: PH_TIMEZONE }).format(parsed);
    }
  }
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw.slice(0, 10);
}

export function filterByDateRange(
  dateStr: string | null | undefined,
  dateFrom: string,
  dateTo: string
): boolean {
  if (dateFrom && dateTo && dateFrom > dateTo) return false;
  if (!dateFrom && !dateTo) return true;
  if (!dateStr) return false;
  const d = toDateOnlyPH(dateStr);
  if (!d) return false;
  if (dateFrom && d < dateFrom) return false;
  if (dateTo && d > dateTo) return false;
  return true;
}

// 4. Multi-level sort comparator for transactions & inventory movements
export function compareNewestFirst<T extends { date?: string | null; created_at?: string | null; id: string | number }>(
  a: T,
  b: T
): number {
  const dateA = a.date || a.created_at || "";
  const dateB = b.date || b.created_at || "";
  if (dateA !== dateB) {
    return dateB.localeCompare(dateA);
  }
  const createdA = a.created_at || "";
  const createdB = b.created_at || "";
  if (createdA !== createdB) {
    return createdB.localeCompare(createdA);
  }
  return String(b.id).localeCompare(String(a.id));
}

// --- TEST SUITES ---

test("Role Attribution: Correctly resolves roles and never defaults to Staff for unknown users", () => {
  // Verifies individual role mapping
  assert.equal(getRoleDisplay("admin").label, "Administrator");
  assert.equal(getRoleDisplay("staff").label, "Clinic Staff");
  assert.equal(getRoleDisplay("owner").label, "Pet Owner");

  // Crucial fix: missing role must be 'Unknown', NOT 'Staff'
  assert.equal(getRoleDisplay(null).label, "Unknown");
  assert.equal(getRoleDisplay(undefined).label, "Unknown");
  assert.equal(getRoleDisplay("").label, "Unknown");
  assert.equal(getRoleDisplay("guest").label, "Unknown");
});

test("Role Priority: Authoritative role resolves admin over staff and staff over owner", () => {
  // If user has both admin and staff, admin takes priority
  assert.equal(resolveAuthoritativeRole([{ role: "staff" }, { role: "admin" }]), "admin");

  // If user has both staff and owner, staff takes priority
  assert.equal(resolveAuthoritativeRole([{ role: "owner" }, { role: "staff" }]), "staff");

  // If user has only owner
  assert.equal(resolveAuthoritativeRole([{ role: "owner" }]), "owner");

  // If user has no roles in user_roles table
  assert.equal(resolveAuthoritativeRole([]), "Unknown");
});

test("Date Filter: Correctly converts UTC timestamps across midnight boundary in Asia/Manila (UTC+8)", () => {
  // 17:30 UTC on Oct 14 is 01:30 AM on Oct 15 in Manila
  const midnightUtc = "2026-10-14T17:30:00.000Z";
  assert.equal(toDateOnlyPH(midnightUtc), "2026-10-15");

  // 15:59 UTC on Oct 15 is 23:59 Manila on Oct 15
  const lateNightUtc = "2026-10-15T15:59:59.000Z";
  assert.equal(toDateOnlyPH(lateNightUtc), "2026-10-15");

  // 16:01 UTC on Oct 15 is 00:01 Manila on Oct 16
  const nextDayUtc = "2026-10-15T16:01:00.000Z";
  assert.equal(toDateOnlyPH(nextDayUtc), "2026-10-16");
});

test("Date Filter: Date range filtering includes midnight boundary records and handles boundaries", () => {
  const recordA = "2026-10-14T17:30:00.000Z"; // Manila: 2026-10-15
  const recordB = "2026-10-15T08:00:00.000Z"; // Manila: 2026-10-15
  const recordC = "2026-10-15T16:30:00.000Z"; // Manila: 2026-10-16

  // Filtering exclusively for Oct 15
  assert.equal(filterByDateRange(recordA, "2026-10-15", "2026-10-15"), true);
  assert.equal(filterByDateRange(recordB, "2026-10-15", "2026-10-15"), true);
  assert.equal(filterByDateRange(recordC, "2026-10-15", "2026-10-15"), false);

  // Date From only
  assert.equal(filterByDateRange(recordA, "2026-10-15", ""), true);
  assert.equal(filterByDateRange("2026-10-14T10:00:00.000Z", "2026-10-15", ""), false);

  // Date To only
  assert.equal(filterByDateRange(recordA, "", "2026-10-15"), true);
  assert.equal(filterByDateRange(recordC, "", "2026-10-15"), false);

  // Invalid date range (dateFrom > dateTo) rejects all records safely
  assert.equal(filterByDateRange(recordA, "2026-10-20", "2026-10-10"), false);
});

test("Sorting & Freshness: Tie-breakers guarantee newest transactions appear first", () => {
  const txns = [
    { id: "tx-1", date: "2026-10-15", created_at: "2026-10-15T08:00:00.000Z" },
    { id: "tx-3", date: "2026-10-15", created_at: "2026-10-15T10:00:00.000Z" },
    { id: "tx-2", date: "2026-10-15", created_at: "2026-10-15T09:00:00.000Z" },
    { id: "tx-4", date: "2026-10-16", created_at: "2026-10-16T01:00:00.000Z" },
  ];

  const sorted = [...txns].sort(compareNewestFirst);

  // tx-4 is newest date, followed by tx-3 (10:00), tx-2 (09:00), tx-1 (08:00)
  assert.deepEqual(sorted.map((t) => t.id), ["tx-4", "tx-3", "tx-2", "tx-1"]);
});

test("Inventory Movement Tracking: Movements and care deductions calculate accurate remaining stock", () => {
  const initialStock = 100;
  const movements = [
    { type: "stock_in", quantity: 50 },
    { type: "care_deduction", quantity: 15 },
    { type: "stock_out", quantity: 20 },
    { type: "adjustment", quantity: -5 },
  ];

  let currentStock = initialStock;
  for (const m of movements) {
    if (m.type === "stock_in") currentStock += m.quantity;
    else if (m.type === "care_deduction" || m.type === "stock_out") currentStock -= m.quantity;
    else if (m.type === "adjustment") currentStock += m.quantity;
  }

  // 100 + 50 - 15 - 20 - 5 = 110
  assert.equal(currentStock, 110);
});

test("Inventory Date Filtering: Correctly filters inventory stock by created/updated date and expiring by expiration date", () => {
  const items = [
    {
      id: "item-1",
      name: "Amoxicillin 250mg",
      created_at: "2026-10-10T08:00:00.000Z",
      updated_at: "2026-10-10T08:00:00.000Z",
      expiration_date: "2026-12-31",
    },
    {
      id: "item-2",
      name: "Rabies Vaccine",
      created_at: "2026-09-01T08:00:00.000Z",
      updated_at: "2026-10-12T09:00:00.000Z",
      expiration_date: "2026-10-20",
    },
    {
      id: "item-3",
      name: "Surgical Gauze",
      created_at: "2026-08-15T08:00:00.000Z",
      updated_at: "2026-08-15T08:00:00.000Z",
      expiration_date: null,
    },
  ];

  // Test 1: Filter general stock for Oct 10 to Oct 15
  // item-1 was created Oct 10 (match)
  // item-2 was restocked/updated Oct 12 (match)
  // item-3 was created Aug 15 and updated Aug 15 (no match)
  const stockFiltered = items.filter((i) => {
    const matchesCreated = i.created_at ? filterByDateRange(i.created_at, "2026-10-10", "2026-10-15") : false;
    const matchesUpdated = i.updated_at ? filterByDateRange(i.updated_at, "2026-10-10", "2026-10-15") : false;
    return matchesCreated || matchesUpdated;
  });
  assert.deepEqual(stockFiltered.map((i) => i.id), ["item-1", "item-2"]);

  // Test 2: Filter expiring items for October 2026 (2026-10-01 to 2026-10-31)
  // item-2 expires 2026-10-20 (match)
  // item-1 expires 2026-12-31 (no match)
  // item-3 has no expiration (no match)
  const expiringFiltered = items.filter((i) => {
    return filterByDateRange(i.expiration_date, "2026-10-01", "2026-10-31");
  });
  assert.deepEqual(expiringFiltered.map((i) => i.id), ["item-2"]);
});

