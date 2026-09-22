import type { SessionUser } from "./auth.js";
import { isClinicUser, resolvePrimaryRole } from "./auth.js";
import { getPool, isTableName, parseSelect, quoteIdent, type TableName } from "../lib/db.js";
import { APPOINTMENT_SLOTS, isSlotBlockingStatus, normalizeCareType } from "../lib/appointment-slots.js";
import { toDateOnly, nowPHIso } from "../lib/datetime.js";
import { buildInventoryDeductionPlan, validateInventoryDeductionPlan } from "./inventory-integration.js";

type Filter = { column: string; value: unknown };

const WALK_IN_OWNER_ID = "00000000-0000-0000-0000-0000000000aa";

type CareSyncResult = { recorded: boolean; skipReason?: string };

const ADMIN_ONLY_TABLES: TableName[] = [
  "inventory_suppliers",
];

const CLINIC_ONLY_TABLES: TableName[] = [
  "inventory_items",
  "inventory_batches",
  "inventory_transactions",
  "inventory_suppliers",
  "messages",
];

const STAFF_FORBIDDEN_TABLES: TableName[] = ["user_roles"];

const STAFF_READ_ONLY_TABLES: TableName[] = [];

const STAFF_NO_DELETE_TABLES: TableName[] = [
  "owners",
  "pets",
  "appointments",
  "care_records",
  "vaccinations",
  "dewormings",
  "lab_transactions",
  "lab_transaction_items",
  "inventory_items",
  "inventory_batches",
  "inventory_transactions",
  "inventory_suppliers",
  "messages",
  "profiles",
];

async function getOwnerIds(userId: string): Promise<string[]> {
  const pool = getPool();
  const { rows: directRows } = await pool.query(
    "SELECT id FROM owners WHERE user_id = $1 OR id = $1",
    [userId]
  );
  if (directRows.length > 0) {
    return directRows.map((r: { id: string }) => r.id);
  }

  const { rows: emailRows } = await pool.query(
    `SELECT o.id 
     FROM owners o 
     JOIN profiles p ON lower(trim(o.email)) = lower(trim(p.email))
     WHERE p.id = $1`,
    [userId]
  );

  const ids = emailRows.map((r: { id: string }) => r.id);
  if (ids.length > 0) {
    await pool.query(
      "UPDATE owners SET user_id = $1 WHERE id = ANY($2::uuid[]) AND user_id IS NULL",
      [userId, ids]
    );
  }

  return ids;
}

async function getPetIds(userId: string): Promise<string[]> {
  const pool = getPool();
  const ownerIds = await getOwnerIds(userId);
  if (!ownerIds.length) {
    const { rows: directPetRows } = await pool.query(
      "SELECT id FROM pets WHERE owner_id = $1",
      [userId]
    );
    return directPetRows.map((r: { id: string }) => r.id);
  }
  const { rows } = await pool.query(
    `SELECT id FROM pets WHERE owner_id = ANY($1::uuid[]) OR owner_id = $2`,
    [ownerIds, userId]
  );
  return rows.map((r: { id: string }) => r.id);
}

function assertTable(table: string): TableName {
  if (!isTableName(table)) throw new Error(`Invalid table: ${table}`);
  return table;
}

export async function authorizeTableAccess(
  user: SessionUser,
  table: TableName,
  action: "select" | "insert" | "update" | "delete"
) {
  if (user.role === "admin") return;

  if (user.role === "staff") {
    if (STAFF_FORBIDDEN_TABLES.includes(table)) {
      throw new Error("Forbidden");
    }
    if (STAFF_READ_ONLY_TABLES.includes(table) && action !== "select") {
      throw new Error("Forbidden");
    }
    if (action === "delete" && STAFF_NO_DELETE_TABLES.includes(table)) {
      throw new Error("Forbidden");
    }
    if (table === "profiles" && action !== "select") {
      throw new Error("Forbidden");
    }
    return;
  }

  if (ADMIN_ONLY_TABLES.includes(table)) {
    throw new Error("Forbidden");
  }

  if (action !== "select" && user.role === "owner") {
    if (table === "appointments" && action === "insert") return;
    if (table === "messages" && action === "insert") return;
    if (table === "owners" && action === "update") return;
    throw new Error("Forbidden");
  }
}

export async function buildOwnerScope(
  user: SessionUser,
  table: TableName
): Promise<{ clause: string; params: unknown[] } | null> {
  if (isClinicUser(user.role)) return null;

  const ownerIds = await getOwnerIds(user.id);
  const petIds = await getPetIds(user.id);

  switch (table) {
    case "owners":
      return { clause: "t.user_id = $1", params: [user.id] };
    case "pets":
      return ownerIds.length
        ? { clause: `t.owner_id = ANY($1::uuid[])`, params: [ownerIds] }
        : { clause: "FALSE", params: [] };
    case "appointments":
      return ownerIds.length
        ? { clause: `t.owner_id = ANY($1::uuid[])`, params: [ownerIds] }
        : { clause: "FALSE", params: [] };
    case "vaccinations":
    case "dewormings":
    case "care_records":
      return petIds.length
        ? { clause: `t.pet_id = ANY($1::uuid[])`, params: [petIds] }
        : { clause: "FALSE", params: [] };
    case "lab_transactions":
      return ownerIds.length
        ? { clause: `t.owner_id = ANY($1::uuid[])`, params: [ownerIds] }
        : { clause: "FALSE", params: [] };
    case "lab_transaction_items": {
      if (!ownerIds.length) return { clause: "FALSE", params: [] };
      return {
        clause: `t.transaction_id IN (SELECT id FROM lab_transactions WHERE owner_id = ANY($1::uuid[]))`,
        params: [ownerIds],
      };
    }
    case "profiles":
      return { clause: "t.id = $1", params: [user.id] };
    case "user_roles":
      return { clause: "t.user_id = $1", params: [user.id] };
    case "messages": {
      const parts = ["t.owner_id IS NULL"];
      const params: unknown[] = [];
      if (ownerIds.length) {
        params.push(ownerIds);
        parts.push(`t.owner_id = ANY($${params.length}::uuid[])`);
      }
      if (petIds.length) {
        params.push(petIds);
        parts.push(`t.pet_id = ANY($${params.length}::uuid[])`);
      }
      return { clause: `(${parts.join(" OR ")}) AND UPPER(COALESCE(t.status, '')) <> 'PENDING'`, params };
    }
    default:
      return null;
  }
}

function shapeRows(rows: Record<string, unknown>[], joins: ReturnType<typeof parseSelect>["joins"]) {
  return rows.map((row) => {
    const result = { ...row };
    for (const j of joins) {
      const nested: Record<string, unknown> = {};
      let hasNested = false;
      for (const key of Object.keys(row)) {
        if (key.startsWith(`${j.alias}_`)) {
          nested[key.slice(j.alias.length + 1)] = row[key];
          delete result[key];
          hasNested = true;
        }
      }
      if (hasNested) (result as Record<string, unknown>)[j.alias] = nested;
    }
    return result;
  });
}

export async function querySelect(opts: {
  user: SessionUser;
  table: string;
  select?: string;
  filters?: Filter[];
  order?: { column: string; ascending?: boolean };
  single?: boolean;
  maybeSingle?: boolean;
}) {
  const table = assertTable(opts.table);
  await authorizeTableAccess(opts.user, table, "select");

  const pool = getPool();
  if (table === "messages") {
    const { ensureMessagesSchema } = await import("./message-dispatch.js");
    await ensureMessagesSchema();
  }
  const selectStr = opts.select ?? "*";
  const { baseColumns, joins } = parseSelect(selectStr);
  const scope = await buildOwnerScope(opts.user, table);

  const params: unknown[] = [];
  let paramIdx = 1;
  const tableAlias = "t";
  const tableName = quoteIdent(table);

  const baseSelect =
    baseColumns === "*"
      ? `${tableAlias}.*`
      : baseColumns
          .split(",")
          .map((c) => `${tableAlias}.${quoteIdent(c.trim())}`)
          .join(", ");

  const joinSelect = joins
    .map((j) => {
      const alias = quoteIdent(j.alias);
      return j.columns === "*"
        ? `${alias}.*`
        : j.columns
            .split(",")
            .map((c) => `${alias}.${quoteIdent(c.trim())} AS ${j.alias}_${c.trim()}`)
            .join(", ");
    })
    .join(", ");

  const joinClauses = joins
    .map((j) => {
      const alias = quoteIdent(j.alias);
      const joinTable = quoteIdent(j.table);
      return `LEFT JOIN ${joinTable} ${alias} ON ${tableAlias}.${quoteIdent(j.fk)} = ${alias}.id`;
    })
    .join(" ");

  const selectClause = joinSelect ? `${baseSelect}, ${joinSelect}` : baseSelect;
  let query = `SELECT ${selectClause} FROM ${tableName} ${tableAlias}`;
  if (joinClauses) query += ` ${joinClauses}`;

  const where: string[] = [];

  if (scope) {
    where.push(scope.clause.replace(/\bt\./g, `${tableAlias}.`));
    params.push(...scope.params);
    paramIdx += scope.params.length;
  }

  for (const f of opts.filters ?? []) {
    const col = f.column.includes(".") ? f.column : `${tableAlias}.${quoteIdent(f.column)}`;
    where.push(`${col} = $${paramIdx}`);
    params.push(f.value);
    paramIdx++;
  }

  if (where.length) query += ` WHERE ${where.join(" AND ")}`;

  if (opts.order?.column) {
    const dir = opts.order.ascending === false ? "DESC" : "ASC";
    query += ` ORDER BY ${tableAlias}.${quoteIdent(opts.order.column)} ${dir}`;
  }

  if (opts.single || opts.maybeSingle) query += " LIMIT 1";

  const { rows } = await pool.query(query, params);
  const shaped = shapeRows(rows as Record<string, unknown>[], joins);

  if (opts.single) {
    if (shaped.length === 0) throw new Error("No rows found");
    return shaped[0];
  }
  if (opts.maybeSingle) return shaped[0] ?? null;
  return shaped;
}

export async function getAppointmentAvailability(date: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT time, status FROM appointments WHERE date = $1`,
    [date]
  );
  const taken = new Set(
    rows
      .filter((r: { status?: string }) => isSlotBlockingStatus(r.status))
      .map((r: { time: string }) => r.time)
  );
  const available = APPOINTMENT_SLOTS.filter((s) => !taken.has(s));
  return { date, slots: [...APPOINTMENT_SLOTS], taken: [...taken], available };
}

async function assertAppointmentSlotAvailable(date: string, time: string, excludeId?: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, status FROM appointments WHERE date = $1 AND time = $2`,
    [date, time]
  );
  const conflict = rows.find(
    (r: { id: string; status?: string }) =>
      r.id !== excludeId && isSlotBlockingStatus(r.status)
  );
  if (conflict) {
    throw new Error("That time slot is already booked.");
  }
}

async function sanitizeOwnerAppointmentInsert(user: SessionUser, row: Record<string, unknown>) {
  const petId = String(row.pet_id ?? "");
  const date = String(row.date ?? "");
  const time = String(row.time ?? "");
  const reason = String(row.reason ?? "").trim();

  if (!petId || !date || !time || !reason) {
    throw new Error("Pet, date, time, and reason are required.");
  }

  const pool = getPool();
  const { rows: petRows } = await pool.query(`SELECT owner_id FROM pets WHERE id = $1`, [petId]);
  let ownerId = petRows[0]?.owner_id as string | undefined;

  const ownerIds = await getOwnerIds(user.id);
  if (ownerId && ownerIds.includes(ownerId)) {
    await pool.query(`UPDATE owners SET user_id = $1 WHERE id = $2 AND user_id IS NULL`, [user.id, ownerId]);
  } else if (user.role !== "admin" && user.role !== "staff") {
    const petIds = await getPetIds(user.id);
    if (!petIds.includes(petId)) {
      throw new Error("You can only request appointments for your own pets.");
    }
  }

  if (!ownerId) {
    ownerId = ownerIds[0] || user.id;
  }

  await assertAppointmentSlotAvailable(date, time);

  const aptNum = String(row.appointment_number ?? `APT-${Date.now().toString().slice(-6)}`);

  return {
    appointment_number: aptNum,
    pet_id: petId,
    owner_id: ownerId,
    date,
    time,
    reason,
    vet: row.vet ? String(row.vet) : null,
    type: "request",
    status: "Requested",
    care_type: normalizeCareType(row.care_type ?? row.appointment_type),
    notes: row.notes ? String(row.notes) : null,
  };
}

async function sanitizeOwnerMessageInsert(user: SessionUser, row: Record<string, unknown>) {
  const { normalizeMessagePayload } = await import("./message-dispatch.js");
  const ownerIds = await getOwnerIds(user.id);
  if (!ownerIds.length) {
    throw new Error("No owner profile is linked to this account.");
  }

  const ownerId = ownerIds[0];
  const pool = getPool();
  const { rows: ownerRows } = await pool.query(`SELECT email, contact FROM owners WHERE id = $1`, [ownerId]);

  let petId = typeof row.pet_id === "string" ? row.pet_id : null;
  if (petId) {
    const { rows: petRows } = await pool.query(`SELECT id FROM pets WHERE id = $1 AND owner_id = $2`, [petId, ownerId]);
    if (!petRows.length) petId = null;
  }

  return normalizeMessagePayload({
    owner_id: ownerId,
    pet_id: petId,
    phone: ownerRows[0]?.contact ?? null,
    email: ownerRows[0]?.email ?? null,
    subject: row.subject || "Message to clinic",
    body: row.body,
    channel: "IN_APP",
    message_type: "Owner Reply",
    status: "SENT",
    sent_by: "Owner",
    scheduled_at: null,
  });
}

async function ensureInventorySchema(poolOrClient: any) {
  await poolOrClient.query(`ALTER TABLE inventory_items ALTER COLUMN category TYPE text USING category::text`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS item_code text`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS description text`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS supplier text`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS reorder_level integer DEFAULT 5`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS storage_location text`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS manufacture_date date`);
  await poolOrClient.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS batch_no text`);
  await poolOrClient.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS transaction_no text`);
  await poolOrClient.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) NOT NULL DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS notes text`);
  await poolOrClient.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS staff_name text`);
  await poolOrClient.query(`CREATE TABLE IF NOT EXISTS inventory_suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    contact_person text,
    phone_number text,
    email text,
    address text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await poolOrClient.query(`CREATE TABLE IF NOT EXISTS inventory_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    batch_no text NOT NULL,
    expiration_date date,
    initial_quantity integer NOT NULL DEFAULT 0,
    remaining_quantity integer NOT NULL DEFAULT 0,
    received_date date DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_inventory_batches_item_batch_exp UNIQUE (inventory_item_id, batch_no, expiration_date)
  )`);
  await poolOrClient.query(`CREATE INDEX IF NOT EXISTS idx_inv_batches_item_id ON inventory_batches(inventory_item_id)`);
  await poolOrClient.query(`CREATE INDEX IF NOT EXISTS idx_inv_batches_expiration ON inventory_batches(expiration_date)`);
  await poolOrClient.query(`CREATE INDEX IF NOT EXISTS idx_inv_batches_remaining_qty ON inventory_batches(remaining_quantity)`);
  await poolOrClient.query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS inventory_batch_id uuid REFERENCES inventory_batches(id) ON DELETE SET NULL`);
  await poolOrClient.query(`ALTER TABLE care_records ADD COLUMN IF NOT EXISTS medications_json text`);
  await poolOrClient.query(`UPDATE inventory_items SET unit_price = 0 WHERE unit_price IS NULL`);
  await poolOrClient.query(`UPDATE inventory_transactions SET unit_price = 0 WHERE unit_price IS NULL`);
  await poolOrClient.query(`UPDATE inventory_transactions SET total_amount = 0 WHERE total_amount IS NULL`);

  // Ensure lab_transactions columns exist
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS transaction_number text`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS care_record_id uuid REFERENCES care_records(id) ON DELETE SET NULL`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'Cash'`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Pending'`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS services_rendered text`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS additional_fees numeric DEFAULT 0`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS processed_by text`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS notes text`);
  await poolOrClient.query(`ALTER TABLE lab_transactions ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0`);

  // Ensure lab_transaction_items columns exist
  await poolOrClient.query(`ALTER TABLE lab_transaction_items ADD COLUMN IF NOT EXISTS category text`);
  await poolOrClient.query(`ALTER TABLE lab_transaction_items ADD COLUMN IF NOT EXISTS source text`);
  await poolOrClient.query(`ALTER TABLE lab_transaction_items ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL`);
  await poolOrClient.query(`ALTER TABLE lab_transaction_items ADD COLUMN IF NOT EXISTS batch_no text`);
  await poolOrClient.query(`ALTER TABLE lab_transaction_items ADD COLUMN IF NOT EXISTS inventory_transaction_id uuid REFERENCES inventory_transactions(id) ON DELETE SET NULL`);

  // Ensure lab_records table exists
  await poolOrClient.query(`CREATE TABLE IF NOT EXISTS lab_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_record_number text,
    pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
    owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
    appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
    care_record_id uuid REFERENCES care_records(id) ON DELETE SET NULL,
    test_type text NOT NULL,
    result text,
    remarks text,
    status text NOT NULL DEFAULT 'Completed',
    lab_fee numeric DEFAULT 0,
    performed_by text,
    notes text,
    date_conducted date DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);

  // LEGACY backfill migration script for missing batches
  await poolOrClient.query(`
    DO $$
    DECLARE
      item_rec RECORD;
      seq INT := 1;
      b_no TEXT;
      b_id UUID;
    BEGIN
      FOR item_rec IN SELECT id, quantity, expiration_date, batch_no FROM inventory_items LOOP
        IF NOT EXISTS (SELECT 1 FROM inventory_batches WHERE inventory_item_id = item_rec.id) THEN
          b_no := COALESCE(NULLIF(TRIM(item_rec.batch_no), ''), 'LEGACY-' || LPAD(seq::text, 3, '0'));
          seq := seq + 1;
          INSERT INTO inventory_batches (
            inventory_item_id,
            batch_no,
            expiration_date,
            initial_quantity,
            remaining_quantity
          ) VALUES (
            item_rec.id,
            b_no,
            item_rec.expiration_date,
            GREATEST(0, item_rec.quantity),
            GREATEST(0, item_rec.quantity)
          )
          ON CONFLICT (inventory_item_id, batch_no, expiration_date) DO UPDATE
          SET initial_quantity = inventory_batches.initial_quantity + EXCLUDED.initial_quantity,
              remaining_quantity = inventory_batches.remaining_quantity + EXCLUDED.remaining_quantity
          RETURNING id INTO b_id;

          UPDATE inventory_transactions
          SET inventory_batch_id = b_id, batch_no = COALESCE(batch_no, b_no)
          WHERE item_id = item_rec.id AND inventory_batch_id IS NULL;
        END IF;
      END LOOP;
    END $$;
  `);

  try {
    const { rows: records } = await poolOrClient.query(`SELECT id, pet_id, date FROM care_records`);
    for (const rec of records) {
      await syncCareLabTransaction(poolOrClient, String(rec.id), rec.pet_id ? String(rec.pet_id) : null, rec.date);
    }
  } catch (err) {
    console.error("Error backfilling care lab transactions:", err);
  }
}

async function applyCareInventoryAdjustment(
  poolOrClient: any,
  table: string,
  payload: Record<string, unknown>,
  recordId?: string,
  petId?: string | null
) {
  if (!["care_records", "vaccinations", "dewormings"].includes(table)) return;
  if (payload.skip_stock_deduction || payload.skip_inventory_deduction) return;
  await ensureInventorySchema(poolOrClient);

  if (recordId) {
    const txnPrefix = `CARE-${recordId.slice(0, 8)}`;
    const { rows: oldTxns } = await poolOrClient.query(
      `SELECT id, inventory_batch_id, item_id, quantity FROM inventory_transactions WHERE transaction_no = $1 AND type = 'out'`,
      [txnPrefix]
    );
    if (oldTxns.length > 0) {
      for (const oldTxn of oldTxns) {
        if (oldTxn.inventory_batch_id) {
          await poolOrClient.query(
            `UPDATE inventory_batches SET remaining_quantity = remaining_quantity + $1, updated_at = now() WHERE id = $2`,
            [Number(oldTxn.quantity ?? 0), oldTxn.inventory_batch_id]
          );
        }
        await poolOrClient.query(
          `UPDATE inventory_items SET quantity = COALESCE((SELECT SUM(remaining_quantity) FROM inventory_batches WHERE inventory_item_id = $1), 0), updated_at = now() WHERE id = $1`,
          [oldTxn.item_id]
        );
      }
      await poolOrClient.query(
        `DELETE FROM inventory_transactions WHERE transaction_no = $1 AND type = 'out'`,
        [txnPrefix]
      );
    }
  }

  const { rows: itemRows } = await poolOrClient.query(
    "SELECT id, name, category, quantity, expiration_date, status, COALESCE(unit_price, purchase_price, 0) AS unit_price FROM inventory_items"
  );
  const inventoryItems = itemRows as Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    expiration_date?: string | Date | null;
    status?: string | null;
    unit_price?: number | string | null;
  }>;
  const plan = buildInventoryDeductionPlan(table, payload, inventoryItems);
  const validation = validateInventoryDeductionPlan(plan.plan, inventoryItems);
  if (plan.plan.length && validation.error) {
    throw new Error(validation.error);
  }

  for (const step of plan.plan) {
    const item = inventoryItems.find((i) => i.id === step.itemId);
    const unitPrice = Number(item?.unit_price ?? 0);

    // FEFO Multi-Batch Deduction across active, non-expired batches
    const { rows: activeBatches } = await poolOrClient.query(
      `SELECT id, batch_no, expiration_date, remaining_quantity 
       FROM inventory_batches 
       WHERE inventory_item_id = $1 AND remaining_quantity > 0 AND (expiration_date >= CURRENT_DATE OR expiration_date IS NULL)
       ORDER BY expiration_date ASC NULLS LAST, created_at ASC`,
      [step.itemId]
    );

    const totalAvailable = activeBatches.reduce((acc: number, b: any) => acc + Number(b.remaining_quantity ?? 0), 0);
    if (totalAvailable < step.quantity) {
      throw new Error(`Insufficient available stock for ${item?.name || step.itemId}.`);
    }

    let remainingNeeded = step.quantity;
    for (const batch of activeBatches) {
      if (remainingNeeded <= 0) break;
      const batchQty = Number(batch.remaining_quantity ?? 0);
      const deductQty = Math.min(batchQty, remainingNeeded);
      const stepTotalAmount = Number((deductQty * unitPrice).toFixed(2));

      await poolOrClient.query(
        `UPDATE inventory_batches SET remaining_quantity = remaining_quantity - $1, updated_at = now() WHERE id = $2`,
        [deductQty, batch.id]
      );

      await poolOrClient.query(
        `INSERT INTO inventory_transactions (item_id, inventory_batch_id, type, quantity, batch_no, expiration_date, reason, pet_id, date, transaction_no, unit_cost, unit_price, total_amount, notes, staff_name)
         VALUES ($1, $2, 'out', $3, $4, $5, $6, $7, CURRENT_DATE, $8, $9, $9, $10, $11, $12)`,
        [
          step.itemId,
          batch.id,
          deductQty,
          batch.batch_no,
          batch.expiration_date,
          step.reason,
          petId ?? null,
          `CARE-${recordId?.slice(0, 8) ?? "AUTO"}`,
          unitPrice,
          stepTotalAmount,
          `Care history record ${recordId ?? "pending"}`,
          null,
        ]
      );

      remainingNeeded -= deductQty;
    }

    // Sync InventoryItem.quantity to equal SUM(remaining_quantity) across active batches
    await poolOrClient.query(
      `UPDATE inventory_items SET quantity = COALESCE((SELECT SUM(remaining_quantity) FROM inventory_batches WHERE inventory_item_id = $1), 0), updated_at = now() WHERE id = $1`,
      [step.itemId]
    );
  }
}

async function syncCareLabTransaction(
  poolOrClient: any,
  recordId: string,
  petId?: string | null,
  recordDate?: string | Date | null
) {
  if (!recordId) return;

  // 1. Fetch Care Record details
  const { rows: careRows } = await poolOrClient.query(
    `SELECT id, pet_id, appointment_id, record_type, diagnosis, treatment, medication, vaccine_used, dewormer_used, vet
     FROM care_records WHERE id = $1`,
    [recordId]
  );
  if (!careRows.length) return;
  const careRecord = careRows[0];
  const effectivePetId = petId || careRecord.pet_id;

  // 2. Fetch Owner ID from pet
  let ownerId: string | null = null;
  if (effectivePetId) {
    const { rows: petRows } = await poolOrClient.query(`SELECT owner_id FROM pets WHERE id = $1`, [effectivePetId]);
    ownerId = petRows[0]?.owner_id ?? null;
  }

  // 3. Format Date string
  const dateValue =
    recordDate instanceof Date
      ? recordDate.toISOString().slice(0, 10)
      : recordDate
      ? String(recordDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  // 4. Fetch medication inventory transactions generated by FEFO
  const txnPrefix = `CARE-${recordId.slice(0, 8)}`;
  const { rows: invTxns } = await poolOrClient.query(
    `SELECT it.id, it.item_id, it.quantity, it.unit_price, it.total_amount, it.batch_no, ii.name AS item_name
     FROM inventory_transactions it
     JOIN inventory_items ii ON ii.id = it.item_id
     WHERE it.transaction_no = $1 AND it.type = 'out'
     ORDER BY it.created_at ASC`,
    [txnPrefix]
  );

  // 5. Find or create lab_transactions row
  const { rows: existing } = await poolOrClient.query(
    `SELECT id, amount_paid FROM lab_transactions WHERE care_record_id = $1`,
    [recordId]
  );

  let labTxnId: string;
  let currentAmountPaid = 0;

  if (existing.length) {
    labTxnId = String(existing[0].id);
    currentAmountPaid = Number(existing[0].amount_paid ?? 0);
  } else {
    const txnNumber = `TXN-${Date.now().toString().slice(-6)}`;
    const { rows: inserted } = await poolOrClient.query(
      `INSERT INTO lab_transactions (
        transaction_number, pet_id, owner_id, care_record_id, appointment_id, date, vet,
        services_rendered, total_amount, subtotal, amount_paid, payment_method, payment_status, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 0, 'Cash', 'Pending', 'Pending', $9)
      RETURNING id`,
      [
        txnNumber,
        effectivePetId ?? null,
        ownerId,
        recordId,
        careRecord.appointment_id ?? null,
        dateValue,
        careRecord.vet || "Clinic Staff",
        "Veterinary Services & Medication",
        "Auto-generated from Care History record.",
      ]
    );
    labTxnId = String(inserted[0].id);
  }

  // 6. Remove old Care History items to avoid duplication on resave
  await poolOrClient.query(
    `DELETE FROM lab_transaction_items WHERE transaction_id = $1 AND source = 'Care History'`,
    [labTxnId]
  );

  // 7. Insert Service line item based on Care Record type
  const recType = String(careRecord.record_type || "checkup").toLowerCase();
  if (recType === "checkup" || recType === "consultation") {
    await poolOrClient.query(
      `INSERT INTO lab_transaction_items (
        transaction_id, description, quantity, unit_price, line_total, category, source
      ) VALUES ($1, $2, 1, 300, 300, 'Service', 'Care History')`,
      [labTxnId, "General Veterinary Consultation & Check-up"]
    );
  } else if (recType === "vaccination" || recType === "vaccine") {
    const desc = careRecord.vaccine_used ? `Vaccination Service (${careRecord.vaccine_used})` : "Vaccination Service";
    await poolOrClient.query(
      `INSERT INTO lab_transaction_items (
        transaction_id, description, quantity, unit_price, line_total, category, source
      ) VALUES ($1, $2, 1, 350, 350, 'Service', 'Care History')`,
      [labTxnId, desc]
    );
  } else if (recType === "deworming") {
    const desc = careRecord.dewormer_used ? `Deworming Service (${careRecord.dewormer_used})` : "Deworming Service";
    await poolOrClient.query(
      `INSERT INTO lab_transaction_items (
        transaction_id, description, quantity, unit_price, line_total, category, source
      ) VALUES ($1, $2, 1, 150, 150, 'Service', 'Care History')`,
      [labTxnId, desc]
    );
  } else if (recType === "treatment") {
    const desc = careRecord.treatment ? `Medical Treatment (${careRecord.treatment})` : "Veterinary Treatment";
    await poolOrClient.query(
      `INSERT INTO lab_transaction_items (
        transaction_id, description, quantity, unit_price, line_total, category, source
      ) VALUES ($1, $2, 1, 400, 400, 'Service', 'Care History')`,
      [labTxnId, desc]
    );
  } else if (recType === "lab" || recType === "laboratory") {
    await poolOrClient.query(
      `INSERT INTO lab_transaction_items (
        transaction_id, description, quantity, unit_price, line_total, category, source
      ) VALUES ($1, $2, 1, 500, 500, 'Laboratory', 'Care History')`,
      [labTxnId, "Laboratory Test & Diagnostic Examination"]
    );
  }

  // 8. Insert Medication line items from medications_json and inventory transactions (lock in accurate unit_price!)
  let rawMeds = careRecord.medications_json;
  if (typeof rawMeds === "string" && rawMeds.trim().startsWith("[")) {
    try {
      rawMeds = JSON.parse(rawMeds);
    } catch {
      rawMeds = null;
    }
  }

  const processedItemIds = new Set<string>();

  if (Array.isArray(rawMeds) && rawMeds.length > 0) {
    for (const med of rawMeds) {
      if (!med || typeof med !== "object") continue;
      const itemId = String(med.inventory_item_id || med.itemId || med.id || "").trim();
      const name = String(med.name || med.item_name || "Prescribed Medication").trim();
      const qty = Math.max(1, Number(med.quantity || med.qty || 1));
      const unit = String(med.unit || "unit").trim();

      const invMatch = itemId ? invTxns.find((i: any) => String(i.item_id) === itemId) : null;

      let unitPrice = Number(invMatch?.unit_price ?? 0);
      if (unitPrice <= 0 && itemId) {
        const { rows: pRows } = await poolOrClient.query(
          `SELECT COALESCE(unit_price, purchase_price, 0) AS price FROM inventory_items WHERE id = $1`,
          [itemId]
        );
        unitPrice = Number(pRows[0]?.price ?? 0);
      }
      if (unitPrice <= 0 && Number(med.unit_price) > 0) {
        unitPrice = Number(med.unit_price);
      }

      const lineTotal = Number((qty * unitPrice).toFixed(2));

      await poolOrClient.query(
        `INSERT INTO lab_transaction_items (
          transaction_id, description, quantity, unit_price, line_total, category, source, item_id, batch_no, inventory_transaction_id
        ) VALUES ($1, $2, $3, $4, $5, 'Medication Used', 'Care History', $6, $7, $8)`,
        [
          labTxnId,
          `${name} (${qty} ${unit})`,
          qty,
          unitPrice,
          lineTotal,
          itemId || null,
          invMatch?.batch_no || "DEFAULT",
          invMatch?.id || null,
        ]
      );

      if (itemId) processedItemIds.add(itemId);
    }
  }

  for (const inv of invTxns) {
    if (processedItemIds.has(String(inv.item_id))) continue;
    const qty = Number(inv.quantity ?? 0);
    let unitPrice = Number(inv.unit_price ?? 0);
    if (unitPrice <= 0 && inv.item_id) {
      const { rows: pRows } = await poolOrClient.query(
        `SELECT COALESCE(unit_price, purchase_price, 0) AS price FROM inventory_items WHERE id = $1`,
        [inv.item_id]
      );
      unitPrice = Number(pRows[0]?.price ?? 0);
    }
    const lineTotal = Number((qty * unitPrice).toFixed(2));
    await poolOrClient.query(
      `INSERT INTO lab_transaction_items (
        transaction_id, description, quantity, unit_price, line_total, category, source, item_id, batch_no, inventory_transaction_id
      ) VALUES ($1, $2, $3, $4, $5, 'Medication Used', 'Care History', $6, $7, $8)`,
      [labTxnId, inv.item_name, qty, unitPrice, lineTotal, inv.item_id, inv.batch_no, inv.id]
    );
    if (inv.item_id) processedItemIds.add(String(inv.item_id));
  }

  // Fallback: match plain text medication in care record against inventory items
  if (processedItemIds.size === 0 && careRecord.medication) {
    const medText = String(careRecord.medication).trim();
    if (medText) {
      const { rows: items } = await poolOrClient.query(
        `SELECT id, name, COALESCE(unit_price, purchase_price, 0) AS price FROM inventory_items`
      );
      for (const item of items) {
        if (item.name && medText.toLowerCase().includes(item.name.toLowerCase())) {
          const unitPrice = Number(item.price ?? 0);
          await poolOrClient.query(
            `INSERT INTO lab_transaction_items (
              transaction_id, description, quantity, unit_price, line_total, category, source, item_id
            ) VALUES ($1, $2, 1, $3, $3, 'Medication Used', 'Care History', $4)`,
            [labTxnId, item.name, unitPrice, item.id]
          );
          processedItemIds.add(item.id);
        }
      }
    }
  }

  // 9. Calculate subtotal & total amount
  const { rows: totals } = await poolOrClient.query(
    `SELECT COALESCE(SUM(line_total), 0) AS subtotal, STRING_AGG(description, ', ') AS services_summary
     FROM lab_transaction_items WHERE transaction_id = $1`,
    [labTxnId]
  );
  const subtotal = Number(totals[0]?.subtotal ?? 0);
  const servicesSummary = totals[0]?.services_summary || "Veterinary Care & Medication";

  const { rows: txnDetails } = await poolOrClient.query(
    `SELECT discount, additional_fees, amount_paid FROM lab_transactions WHERE id = $1`,
    [labTxnId]
  );
  const discount = Number(txnDetails[0]?.discount ?? 0);
  const fees = Number(txnDetails[0]?.additional_fees ?? 0);
  const amountPaid = Number(txnDetails[0]?.amount_paid ?? currentAmountPaid);
  const totalAmount = Number((subtotal - discount + fees).toFixed(2));
  const balance = Number(Math.max(0, totalAmount - amountPaid).toFixed(2));

  let paymentStatus = "Pending";
  if (amountPaid >= totalAmount && totalAmount > 0) {
    paymentStatus = "Paid";
  } else if (amountPaid > 0 && amountPaid < totalAmount) {
    paymentStatus = "Partially Paid";
  } else if (amountPaid === 0) {
    paymentStatus = "Unpaid";
  }

  await poolOrClient.query(
    `UPDATE lab_transactions
     SET subtotal = $1, total_amount = $2, total = $2, amount_paid = $3, balance = $4, services_rendered = $5, payment_status = $6, status = $6, updated_at = now()
     WHERE id = $7`,
    [subtotal, totalAmount, amountPaid, balance, servicesSummary.slice(0, 255), paymentStatus, labTxnId]
  );
}

export async function queryInsert(opts: {
  user: SessionUser;
  table: string;
  data: Record<string, unknown> | Record<string, unknown>[];
  returning?: boolean;
}) {
  const table = assertTable(opts.table);
  await authorizeTableAccess(opts.user, table, "insert");

  const pool = getPool();
  const rows = Array.isArray(opts.data) ? opts.data : [opts.data];
  const results: Record<string, unknown>[] = [];
  const useTransaction = ["care_records", "vaccinations", "dewormings", "inventory_items", "inventory_batches", "inventory_transactions", "lab_transactions", "lab_transaction_items"].includes(table);
  const client = useTransaction ? await pool.connect() : null;

  if (["lab_transactions", "lab_transaction_items", "care_records", "vaccinations", "dewormings", "inventory_items", "inventory_batches", "inventory_transactions"].includes(table)) {
    await ensureInventorySchema(client ?? pool);
  }

  try {
    if (client) await client.query("BEGIN");

    for (const row of rows) {
      let payload = row;
      if (table === "appointments" && opts.user.role === "owner") {
        payload = await sanitizeOwnerAppointmentInsert(opts.user, row);
      }

      if (table === "messages") {
        const { normalizeMessagePayload, ensureMessagesSchema } = await import("./message-dispatch.js");
        await ensureMessagesSchema();
        if (opts.user.role === "owner") {
          payload = await sanitizeOwnerMessageInsert(opts.user, row as Record<string, unknown>);
        } else {
          payload = normalizeMessagePayload(row as Record<string, unknown>);
        }
        if (!String(payload.body ?? "").trim()) {
          throw new Error("Message body is required.");
        }
      }

      if (table === "care_records") {
        const aptId = (payload.appointment_id ?? payload.appointmentId) as string | undefined;
        if (aptId) {
          const { rows: existingRecords } = await (client ?? pool).query(
            `SELECT id FROM care_records WHERE appointment_id = $1`,
            [aptId]
          );
          if (existingRecords.length > 0) {
            const existingId = String(existingRecords[0].id);
            const updateKeys = Object.keys(payload).filter((k) => k !== "id");
            const updateValues = updateKeys.map((k) => payload[k]);
            const setClause = updateKeys.map((k, i) => `${quoteIdent(k)} = $${i + 1}`).join(", ");
            const updateQuery = `UPDATE care_records SET ${setClause}, updated_at = now() WHERE id = $${updateKeys.length + 1} RETURNING *`;
            const { rows: updatedRows } = await (client ?? pool).query(updateQuery, [...updateValues, existingId]);
            const record = updatedRows[0] as Record<string, unknown>;
            if (opts.returning && record) results.push(record);
            const petId = payload.pet_id ? String(payload.pet_id) : payload.petId ? String(payload.petId) : undefined;
            await applyCareInventoryAdjustment(client ?? pool, table, payload, existingId, petId);
            if (table === "care_records") {
              await syncCareLabTransaction(
                client ?? pool,
                existingId,
                petId,
                (payload.date ?? payload.record_date) as string | Date | null | undefined
              );
            }
            continue;
          }
        }
      }

      if (table === "inventory_items") {
        await ensureInventorySchema(client ?? pool);
        const itemCode = String((payload as Record<string, unknown>).item_code ?? (payload as Record<string, unknown>).itemCode ?? "");
        const unitPrice = Number((payload as Record<string, unknown>).unit_price ?? (payload as Record<string, unknown>).unitPrice ?? 0);
        payload = {
          ...(payload as Record<string, unknown>),
          item_code: itemCode || `INV-${Date.now().toString().slice(-6)}`,
          quantity: Number((payload as Record<string, unknown>).quantity ?? 0),
          unit_price: unitPrice >= 0 ? unitPrice : 0,
        };
      }

      if (table === "inventory_suppliers" || table === "inventory_batches" || table === "inventory_transactions") {
        await ensureInventorySchema(client ?? pool);
      }

      if (table === "inventory_transactions") {
        const itemId = String(payload.item_id ?? payload.itemId ?? "");
        const qty = Number(payload.quantity ?? 0);
        let unitPrice = Number(payload.unit_price ?? payload.unitPrice ?? payload.unit_cost ?? 0);

        if ((unitPrice === 0 || !payload.unit_price) && itemId) {
          const { rows: itemRows } = await (client ?? pool).query(
            `SELECT COALESCE(unit_price, purchase_price, 0) AS unit_price FROM inventory_items WHERE id = $1`,
            [itemId]
          );
          if (itemRows.length) {
            unitPrice = Number(itemRows[0].unit_price ?? 0);
          }
        }

        const totalAmount = Number((Math.max(0, qty) * Math.max(0, unitPrice)).toFixed(2));
        payload = {
          ...payload,
          unit_price: unitPrice,
          unit_cost: unitPrice,
          total_amount: totalAmount,
        };
      }

      if (table === "inventory_batches") {
        const itemId = String(payload.inventory_item_id ?? payload.inventoryItemId ?? "");
        const batchNo = String(payload.batch_no ?? payload.batchNo ?? "");
        const expDate = payload.expiration_date ?? payload.expirationDate ?? null;
        const initialQty = Number(payload.initial_quantity ?? payload.initialQuantity ?? payload.quantity ?? 0);
        const remainingQty = Number(payload.remaining_quantity ?? payload.remainingQuantity ?? initialQty);

        const upsertQuery = `
          INSERT INTO inventory_batches (inventory_item_id, batch_no, expiration_date, initial_quantity, remaining_quantity)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (inventory_item_id, batch_no, expiration_date) DO UPDATE
          SET initial_quantity = inventory_batches.initial_quantity + EXCLUDED.initial_quantity,
              remaining_quantity = inventory_batches.remaining_quantity + EXCLUDED.remaining_quantity,
              updated_at = now()
          RETURNING *;
        `;
        const { rows: inserted } = await (client ?? pool).query(upsertQuery, [itemId, batchNo, expDate, initialQty, remainingQty]);
        if (opts.returning && inserted.length) results.push(inserted[0] as Record<string, unknown>);

        // Sync InventoryItem.quantity to equal SUM(remaining_quantity)
        if (itemId) {
          await (client ?? pool).query(
            `UPDATE inventory_items SET quantity = COALESCE((SELECT SUM(remaining_quantity) FROM inventory_batches WHERE inventory_item_id = $1), 0), updated_at = now() WHERE id = $1`,
            [itemId]
          );
        }
        continue;
      }

      const keys = Object.keys(payload).map(quoteIdent);
      const values = Object.values(payload);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const query = `INSERT INTO ${quoteIdent(table)} (${keys.join(", ")}) VALUES (${placeholders})${
        opts.returning ? " RETURNING *" : ""
      }`;
      const { rows: inserted } = await (client ?? pool).query(query, values);
      if (opts.returning && inserted.length) results.push(inserted[0] as Record<string, unknown>);

      if (table === "inventory_items" && inserted[0]?.id) {
        const newItemId = String(inserted[0].id);
        const initBatchNo = String(payload.batch_no ?? payload.batchNo ?? "LOT-001");
        const initExpDate = payload.expiration_date ?? payload.expirationDate ?? null;
        const initQty = Number(payload.quantity ?? 0);
        const itemUnitPrice = Number(payload.unit_price ?? payload.unitPrice ?? 0);
        const initTotalAmount = Number((initQty * itemUnitPrice).toFixed(2));

        const { rows: createdBatch } = await (client ?? pool).query(
          `INSERT INTO inventory_batches (inventory_item_id, batch_no, expiration_date, initial_quantity, remaining_quantity)
           VALUES ($1, $2, $3, $4, $4)
           ON CONFLICT (inventory_item_id, batch_no, expiration_date) DO UPDATE
           SET initial_quantity = inventory_batches.initial_quantity + EXCLUDED.initial_quantity,
               remaining_quantity = inventory_batches.remaining_quantity + EXCLUDED.remaining_quantity,
               updated_at = now()
           RETURNING id;`,
          [newItemId, initBatchNo, initExpDate, initQty]
        );

        if (initQty > 0) {
          await (client ?? pool).query(
            `INSERT INTO inventory_transactions (item_id, inventory_batch_id, type, quantity, batch_no, expiration_date, reason, notes, recorded_by, date, transaction_no, unit_cost, unit_price, total_amount)
             VALUES ($1, $2, 'in', $3, $4, $5, 'Initial Stock', 'Item created', $6, CURRENT_DATE, $7, $8, $8, $9)`,
            [
              newItemId,
              createdBatch[0]?.id || null,
              initQty,
              initBatchNo,
              initExpDate,
              opts.user.email || "Admin",
              `TXN-IN-${Date.now().toString().slice(-6)}`,
              itemUnitPrice,
              initTotalAmount,
            ]
          );
        }

        await (client ?? pool).query(
          `UPDATE inventory_items SET quantity = COALESCE((SELECT SUM(remaining_quantity) FROM inventory_batches WHERE inventory_item_id = $1), 0), updated_at = now() WHERE id = $1`,
          [newItemId]
        );
      }

      if (table === "inventory_transactions") {
        let batchId = payload.inventory_batch_id ? String(payload.inventory_batch_id) : undefined;
        const type = String(payload.type ?? "").toLowerCase();
        const qty = Number(payload.quantity ?? 0);
        const itemId = String(payload.item_id ?? payload.itemId ?? "");
        const batchNo = String(payload.batch_no ?? payload.batchNo ?? "LOT-001");
        const expDate = payload.expiration_date ?? payload.expirationDate ?? null;
        const unitPrice = Number(payload.unit_price ?? payload.unitPrice ?? 0);

        const reason = String(payload.reason ?? "");
        const isAuditOnly = reason.startsWith("Adjustment:") || reason === "Initial Stock";

        if (type === "in" && itemId && unitPrice > 0) {
          await (client ?? pool).query(
            `UPDATE inventory_items SET unit_price = $1, updated_at = now() WHERE id = $2`,
            [unitPrice, itemId]
          );
        }

        if (!isAuditOnly) {
          if (!batchId && itemId && type === "in") {
            const { rows: upsertedBatch } = await (client ?? pool).query(
              `INSERT INTO inventory_batches (inventory_item_id, batch_no, expiration_date, initial_quantity, remaining_quantity)
               VALUES ($1, $2, $3, $4, $4)
               ON CONFLICT (inventory_item_id, batch_no, expiration_date) DO UPDATE
               SET initial_quantity = inventory_batches.initial_quantity + EXCLUDED.initial_quantity,
                   remaining_quantity = inventory_batches.remaining_quantity + EXCLUDED.remaining_quantity,
                   updated_at = now()
               RETURNING id;`,
              [itemId, batchNo, expDate, qty]
            );
            if (upsertedBatch.length) {
              batchId = upsertedBatch[0].id;
              if (inserted[0]?.id) {
                await (client ?? pool).query(
                  `UPDATE inventory_transactions SET inventory_batch_id = $1 WHERE id = $2`,
                  [batchId, inserted[0].id]
                );
              }
            }
          } else if (batchId && type === "in") {
            await (client ?? pool).query(
              `UPDATE inventory_batches SET initial_quantity = initial_quantity + $1, remaining_quantity = remaining_quantity + $1, updated_at = now() WHERE id = $2`,
              [qty, batchId]
            );
          } else if (batchId && type === "out") {
            await (client ?? pool).query(
              `UPDATE inventory_batches SET remaining_quantity = GREATEST(0, remaining_quantity - $1), updated_at = now() WHERE id = $2`,
              [qty, batchId]
            );
          } else if (!batchId && itemId && type === "out" && batchNo) {
            const { rows: foundBatch } = await (client ?? pool).query(
              `SELECT id FROM inventory_batches WHERE inventory_item_id = $1 AND batch_no = $2 ORDER BY remaining_quantity DESC LIMIT 1`,
              [itemId, batchNo]
            );
            if (foundBatch.length) {
              batchId = foundBatch[0].id;
              await (client ?? pool).query(
                `UPDATE inventory_batches SET remaining_quantity = GREATEST(0, remaining_quantity - $1), updated_at = now() WHERE id = $2`,
                [qty, batchId]
              );
              if (inserted[0]?.id) {
                await (client ?? pool).query(
                  `UPDATE inventory_transactions SET inventory_batch_id = $1 WHERE id = $2`,
                  [batchId, inserted[0].id]
                );
              }
            }
          }
        }

        if (itemId) {
          await (client ?? pool).query(
            `UPDATE inventory_items SET quantity = COALESCE((SELECT SUM(remaining_quantity) FROM inventory_batches WHERE inventory_item_id = $1), 0), updated_at = now() WHERE id = $1`,
            [itemId]
          );
        }
      }

      if (table === "care_records" || table === "vaccinations" || table === "dewormings") {
        const insertedId = inserted[0]?.id ? String(inserted[0].id) : undefined;
        const petId = payload.pet_id ? String(payload.pet_id) : payload.petId ? String(payload.petId) : undefined;
        await applyCareInventoryAdjustment(client ?? pool, table, payload, insertedId, petId);
        if (table === "care_records" && insertedId) {
          await syncCareLabTransaction(
            client ?? pool,
            insertedId,
            petId,
            (payload.date ?? payload.record_date) as string | Date | null | undefined
          );
        }
      }

      if (table === "lab_records" && inserted[0]?.id) {
        const fee = Number(payload.lab_fee ?? payload.labFee ?? 500);
        const code = String(payload.lab_record_number || `LAB-${Date.now().toString().slice(-6)}`);
        const testType = String(payload.test_type || "Laboratory Test");
        
        const txnNumber = `TXN-${Date.now().toString().slice(-6)}`;
        const { rows: insertedTxn } = await (client ?? pool).query(
          `INSERT INTO lab_transactions (
            transaction_number, pet_id, owner_id, appointment_id, care_record_id, date, vet,
            services_rendered, subtotal, total_amount, total, amount_paid, balance, payment_method, payment_status, status, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $9, 0, $9, 'Cash', 'Pending', 'Pending', $10)
          RETURNING id`,
          [
            txnNumber,
            payload.pet_id || null,
            payload.owner_id || null,
            payload.appointment_id || null,
            payload.care_record_id || null,
            payload.date_conducted || new Date().toISOString().slice(0, 10),
            payload.performed_by || "Clinic Staff",
            `Laboratory Test (${testType})`,
            fee,
            `Auto-generated billing transaction for Lab Record ${code}`,
          ]
        );

        if (insertedTxn.length) {
          const txnId = insertedTxn[0].id;
          await (client ?? pool).query(
            `INSERT INTO lab_transaction_items (
              transaction_id, description, quantity, unit_price, line_total, category, source
            ) VALUES ($1, $2, 1, $3, $3, 'Laboratory', 'Lab Record')`,
            [txnId, `Laboratory Test: ${testType} (${code})`, fee]
          );
        }
      }

      if (table === "appointments" && inserted[0]?.id && isClinicUser(opts.user.role)) {
        const status = String(payload.status || "Scheduled");
        if (["Scheduled"].includes(status)) {
          try {
            const { notifyOwnerOnAppointmentChange } = await import("./message-dispatch.js");
            await notifyOwnerOnAppointmentChange({
              appointmentId: String(inserted[0].id),
              nextStatus: status,
              sentBy: opts.user.fullName || opts.user.email || "Clinic",
            });
          } catch (err) {
            console.error("[messages] Appointment creation notice failed:", err);
          }
        }
      }

      if (table === "messages") {
        const { deliverClinicMessage } = await import("./message-dispatch.js");
        try {
          await deliverClinicMessage(payload as Record<string, unknown>);
        } catch (err) {
          console.error("[messages] Delivery failed after insert:", err);
        }
      }
    }

    if (client) await client.query("COMMIT");
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    throw err;
  } finally {
    if (client) client.release();
  }

  if (opts.returning) {
    return Array.isArray(opts.data) ? results : results[0] ?? null;
  }
  return null;
}

export async function queryDelete(opts: {
  user: SessionUser;
  table: string;
  filters: Filter[];
}) {
  const table = assertTable(opts.table);
  await authorizeTableAccess(opts.user, table, "delete");

  const pool = getPool();

  if (table === "inventory_batches") {
    const idFilter = opts.filters.find((f) => f.column === "id");
    if (idFilter?.value) {
      const { rows: txnRows } = await pool.query(
        "SELECT 1 FROM inventory_transactions WHERE inventory_batch_id = $1 LIMIT 1",
        [idFilter.value]
      );
      if (txnRows.length > 0) {
        throw new Error(
          "Batches with transaction history cannot be deleted because they are part of the inventory audit trail."
        );
      }
    }
  }

  let paramIdx = 1;
  const values: unknown[] = [];
  const whereParts = opts.filters.map((f) => {
    const part = `${quoteIdent(f.column)} = $${paramIdx}`;
    paramIdx++;
    values.push(f.value);
    return part;
  });

  const query = `DELETE FROM ${quoteIdent(table)}${whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : ""}`;
  await pool.query(query, values);
  return { deleted: true };
}

export async function queryUpdate(opts: {
  user: SessionUser;
  table: string;
  data: Record<string, unknown>;
  filters: Filter[];
}): Promise<{ careRecorded?: boolean; careSkipReason?: string }> {
  const table = assertTable(opts.table);
  await authorizeTableAccess(opts.user, table, "update");

  const pool = getPool();
  const data = { ...opts.data };

  if (["lab_transactions", "lab_transaction_items", "care_records", "vaccinations", "dewormings", "inventory_items", "inventory_batches", "inventory_transactions"].includes(table)) {
    await ensureInventorySchema(pool);
  }

  if (table === "appointments") {
    if (data.date !== undefined) {
      data.date = toDateOnly(data.date);
    }
    if (data.time !== undefined) {
      const timeMatch = String(data.time).match(/(\d{1,2}:\d{2})/);
      data.time = timeMatch?.[1] ?? String(data.time).slice(0, 5);
    }

    if (isClinicUser(opts.user.role)) {
      const idFilter = opts.filters.find((f) => f.column === "id");
      const appointmentId = idFilter?.value ? String(idFilter.value) : undefined;

      if (data.status === "Scheduled" && appointmentId) {
        const { rows } = await pool.query(`SELECT date, time FROM appointments WHERE id = $1`, [appointmentId]);
        const current = rows[0] as { date?: string | Date; time?: string } | undefined;
        if (current) {
          const slotDate = data.date ? String(data.date) : toDateOnly(current.date);
          const slotTime = data.time ? String(data.time) : String(current.time ?? "");
          if (slotDate && slotTime) {
            await assertAppointmentSlotAvailable(slotDate, slotTime, appointmentId);
          }
        }
      }
    }
  }

  if (table === "lab_transactions") {
    const idFilter = opts.filters.find((f) => f.column === "id");
    if (idFilter?.value) {
      const txnId = String(idFilter.value);
      const { rows: currentTxn } = await pool.query(
        `SELECT subtotal, total_amount, amount_paid, discount, additional_fees, payment_status FROM lab_transactions WHERE id = $1`,
        [txnId]
      );
      if (currentTxn.length) {
        const c = currentTxn[0];
        const subtotal = data.subtotal !== undefined ? Number(data.subtotal) : Number(c.subtotal ?? c.total_amount ?? 0);
        const discount = data.discount !== undefined ? Number(data.discount) : Number(c.discount ?? 0);
        const fees = data.additional_fees !== undefined ? Number(data.additional_fees) : Number(c.additional_fees ?? 0);
        let amountPaid = data.amount_paid !== undefined ? Number(data.amount_paid) : Number(c.amount_paid ?? 0);

        const totalAmount = data.total_amount !== undefined ? Number(data.total_amount) : Number((subtotal - discount + fees).toFixed(2));

        if (data.payment_status === "Paid" && amountPaid < totalAmount) {
          amountPaid = totalAmount;
        }

        let paymentStatus = data.payment_status ? String(data.payment_status) : (c.payment_status || "Pending");
        if (data.amount_paid !== undefined || data.total_amount !== undefined || data.subtotal !== undefined || data.payment_status !== undefined) {
          if (amountPaid >= totalAmount && totalAmount > 0) {
            paymentStatus = "Paid";
          } else if (amountPaid > 0 && amountPaid < totalAmount) {
            paymentStatus = "Partially Paid";
          } else if (amountPaid === 0) {
            paymentStatus = "Unpaid";
          }
        }

        data.subtotal = subtotal;
        data.discount = discount;
        data.additional_fees = fees;
        data.total_amount = totalAmount;
        data.total = totalAmount;
        data.amount_paid = amountPaid;
        data.payment_status = paymentStatus;
        data.status = paymentStatus;
      }
    }
  }

  const keys = Object.keys(data).map(quoteIdent);
  let values = Object.values(data);

  let shouldSyncCare = false;
  let appointmentIdForSync: string | undefined;
  let previousAppointmentStatus: string | undefined;
  if (table === "appointments") {
    const idFilter = opts.filters.find((f) => f.column === "id");
    appointmentIdForSync = idFilter?.value ? String(idFilter.value) : undefined;
    if (appointmentIdForSync) {
      const { rows } = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [appointmentIdForSync]);
      previousAppointmentStatus = rows[0]?.status as string | undefined;
      if (data.status === "Completed") {
        shouldSyncCare = previousAppointmentStatus !== "Completed";
      }
    }
  }

  let paramIdx = values.length + 1;
  const whereParts = opts.filters.map((f) => {
    const part = `${quoteIdent(f.column)} = $${paramIdx}`;
    paramIdx++;
    values.push(f.value);
    return part;
  });

  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const query = `UPDATE ${quoteIdent(table)} SET ${setClause} WHERE ${whereParts.join(" AND ")}`;
  await pool.query(query, values);

  if (table === "inventory_batches") {
    const idFilter = opts.filters.find((f) => f.column === "id");
    if (idFilter?.value) {
      await pool.query(
        `UPDATE inventory_items SET quantity = COALESCE((SELECT SUM(remaining_quantity) FROM inventory_batches WHERE inventory_item_id = (SELECT inventory_item_id FROM inventory_batches WHERE id = $1)), 0), updated_at = now() WHERE id = (SELECT inventory_item_id FROM inventory_batches WHERE id = $1)`,
        [idFilter.value]
      );
    }
  }

  if (table === "appointments" && appointmentIdForSync && isClinicUser(opts.user.role) && (data.status || data.date || data.time)) {
    try {
      const { notifyOwnerOnAppointmentChange } = await import("./message-dispatch.js");
      await notifyOwnerOnAppointmentChange({
        appointmentId: appointmentIdForSync,
        previousStatus: previousAppointmentStatus,
        nextStatus: data.status ? String(data.status) : previousAppointmentStatus,
        dateChanged: data.date !== undefined || data.time !== undefined,
        sentBy: opts.user.fullName || opts.user.email || "Clinic",
      });
    } catch (err) {
      console.error("[messages] Appointment notice failed:", err);
    }
  }

  if (shouldSyncCare && appointmentIdForSync) {
    try {
      const result = await syncCareRecordFromCompletedAppointment(appointmentIdForSync);
      return { careRecorded: result.recorded, careSkipReason: result.skipReason };
    } catch (err) {
      console.error("[care-sync] Failed after appointment completed:", err);
      const message = err instanceof Error ? err.message : "Care record sync failed";
      return { careRecorded: false, careSkipReason: message };
    }
  }

  return {};
}

async function resolveAppointmentPetId(
  pool: ReturnType<typeof getPool>,
  apt: { pet_id: string | null; notes: string | null }
): Promise<string | null> {
  if (apt.pet_id) return apt.pet_id;

  const notes = apt.notes ?? "";
  const match = notes.match(/^Walk-in pet:\s*([^|]+)/i);
  if (!match) return null;

  const petName = match[1].trim();
  if (!petName) return null;

  const { rows } = await pool.query(
    `SELECT id FROM pets WHERE name ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
    [petName]
  );
  if (rows.length) return rows[0].id as string;

  const { rows: created } = await pool.query(
    `INSERT INTO pets (owner_id, name) VALUES ($1, $2) RETURNING id`,
    [WALK_IN_OWNER_ID, petName]
  );
  return (created[0] as { id: string } | undefined)?.id ?? null;
}

async function syncCareRecordFromCompletedAppointment(appointmentId: string): Promise<CareSyncResult> {
  const pool = getPool();

  let aptRows;
  try {
    ({ rows: aptRows } = await pool.query(
      `SELECT pet_id, date, vet, reason, status, notes, COALESCE(care_type, 'checkup') AS care_type
       FROM appointments WHERE id = $1`,
      [appointmentId]
    ));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("care_type")) throw err;
    ({ rows: aptRows } = await pool.query(
      `SELECT pet_id, date, vet, reason, status, notes FROM appointments WHERE id = $1`,
      [appointmentId]
    ));
  }
  if (!aptRows.length) return { recorded: false, skipReason: "Appointment not found" };

  const apt = aptRows[0] as {
    pet_id: string | null;
    date: string;
    vet: string | null;
    reason: string | null;
    status: string;
    care_type: string | null;
    notes: string | null;
  };

  if (apt.status !== "Completed") return { recorded: false, skipReason: "Appointment is not completed" };

  const petId = await resolveAppointmentPetId(pool, apt);
  if (!petId) {
    return {
      recorded: false,
      skipReason: "No pet linked — select a registered pet or add a walk-in pet name when booking",
    };
  }

  if (!apt.pet_id) {
    await pool.query(`UPDATE appointments SET pet_id = $1 WHERE id = $2`, [petId, appointmentId]);
  }

  const rawCareType = normalizeCareType(apt.care_type);
  const careType = rawCareType === "vaccine" ? "vaccination" : rawCareType;
  const reason = apt.reason?.trim() || (careType === "vaccination" ? "Vaccination" : careType === "deworming" ? "Deworming" : "Routine visit");
  const autoNote = "Auto-recorded from completed appointment.";
  const recordDate = toDateOnly(apt.date);

  const existing = await pool.query(`SELECT id FROM care_records WHERE appointment_id = $1`, [appointmentId]);
  if (existing.rows.length) return { recorded: true };

  try {
    const insertResult = await pool.query(
      `INSERT INTO care_records (
        pet_id, appointment_id, record_type, date, vet, chief_complaint, diagnosis, treatment,
        vaccine_used, dewormer_used, outcome, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (appointment_id) DO NOTHING
      RETURNING id`,
      [
        petId,
        appointmentId,
        careType,
        recordDate,
        apt.vet,
        reason,
        null,
        null,
        null,
        null,
        null,
        apt.notes || autoNote,
      ]
    );
    let insertedId = insertResult.rows[0]?.id ? String(insertResult.rows[0].id) : undefined;
    if (!insertedId) {
      const dup = await pool.query(`SELECT id FROM care_records WHERE appointment_id = $1`, [appointmentId]);
      if (dup.rows.length) return { recorded: true };
    }
    await applyCareInventoryAdjustment(
      pool,
      "care_records",
      {
        pet_id: petId,
        record_type: careType,
        vaccine_used: careType === "vaccination" ? reason : null,
        dewormer_used: careType === "deworming" ? reason : null,
        treatment: careType === "treatment" ? reason : null,
        medication: reason,
        notes: autoNote,
      },
      insertedId,
      petId
    );

    // Auto-create Clinic Transaction
    const petRes = await pool.query(`SELECT owner_id FROM pets WHERE id = $1`, [petId]);
    const ownerId = petRes.rows[0]?.owner_id ?? null;

    const txnExisting = await pool.query(`SELECT id FROM lab_transactions WHERE appointment_id = $1`, [appointmentId]);
    if (!txnExisting.rows.length) {
      const txnNumber = `TXN-${Date.now().toString().slice(-6)}`;
      const serviceName =
        careType === "vaccination"
          ? "Vaccination Service"
          : careType === "deworming"
          ? "Deworming Service"
          : careType === "treatment"
          ? "Medical Treatment Service"
          : "General Veterinary Check-up";

      await pool.query(
        `INSERT INTO lab_transactions (
          transaction_number, appointment_id, pet_id, owner_id, care_record_id, date,
          services_rendered, total_amount, payment_method, payment_status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          txnNumber,
          appointmentId,
          petId,
          ownerId,
          insertedId,
          recordDate,
          serviceName,
          500.0,
          "Cash",
          "Pending",
          "Auto-generated from completed appointment.",
        ]
      );
    }

    return { recorded: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("care_records_appointment_id_key") || msg.includes("duplicate key")) {
      return { recorded: true };
    }
    if (!msg.includes("appointment_id")) throw err;

    const marker = `appointment:${appointmentId}`;
    const dup = await pool.query(`SELECT id FROM care_records WHERE notes LIKE $1`, [`%${marker}%`]);
    if (dup.rows.length) return { recorded: true };

    const insertResult = await pool.query(
      `INSERT INTO care_records (
        pet_id, record_type, date, vet, chief_complaint, diagnosis, treatment,
        vaccine_used, dewormer_used, outcome, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        petId,
        careType,
        recordDate,
        apt.vet,
        reason,
        null,
        null,
        null,
        null,
        null,
        apt.notes || `${autoNote} ${marker}`,
      ]
    );
    const insertedId = insertResult.rows[0]?.id ? String(insertResult.rows[0].id) : undefined;
    await applyCareInventoryAdjustment(
      pool,
      "care_records",
      {
        pet_id: petId,
        record_type: careType,
        vaccine_used: careType === "vaccination" ? reason : null,
        dewormer_used: careType === "deworming" ? reason : null,
        treatment: careType === "treatment" ? reason : null,
        medication: reason,
        notes: `${autoNote} ${marker}`,
      },
      insertedId,
      petId
    );
    return { recorded: true };
  }
}

export async function recordLoginHistory(userId: string, loginMethod: "Email" | "Google", ipAddress?: string | null) {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO login_history (user_id, login_method, ip_address) VALUES ($1, $2, $3)`,
      [userId, loginMethod, ipAddress || null]
    );
    await pool.query(`UPDATE users SET last_login = now() WHERE id = $1`, [userId]);
  } catch (e) {
    console.error("Failed to record login history:", e);
  }
}

export async function getUserLoginHistory(userId: string, limit = 10) {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT id, login_method, login_time, ip_address FROM login_history WHERE user_id = $1 ORDER BY login_time DESC LIMIT $2`,
      [userId, limit]
    );
    return rows.map((r: { id: string; login_method: string; login_time: Date; ip_address: string | null }) => ({
      id: r.id,
      loginMethod: r.login_method,
      loginTime: r.login_time ? new Date(r.login_time).toISOString() : null,
      ipAddress: r.ip_address,
    }));
  } catch {
    return [];
  }
}

export async function registerUser(opts: {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
}) {
  const pool = getPool();
  const { hashPassword, validatePasswordPolicy } = await import("./auth.js");
  const { sendVerificationEmail } = await import("./email.js");
  const { isGmailAddress } = await import("./google.js");
  const crypto = await import("crypto");

  const email = opts.email.toLowerCase().trim();
  if (!isGmailAddress(email)) {
    throw new Error("Registration requires a valid @gmail.com email address.");
  }

  const passValidation = validatePasswordPolicy(opts.password);
  if (!passValidation.valid) {
    throw new Error(passValidation.error || "Password does not meet complexity requirements.");
  }

  const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [email]);
  if (existing.rows.length) {
    throw new Error("An account with this email address already exists.");
  }

  const passwordHash = await hashPassword(opts.password);
  const firstName = opts.firstName.trim();
  const middleName = opts.middleName?.trim() || null;
  const lastName = opts.lastName.trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO users (
        email, password_hash, first_name, middle_name, last_name, full_name,
        phone, address, email_verified, must_verify_gmail, verification_token, verification_token_expires
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, $9, $10)
       RETURNING id, email, full_name`,
      [email, passwordHash, firstName, middleName, lastName, fullName, opts.phone || null, opts.address || null, token, expiresAt]
    );
    const user = rows[0] as { id: string; email: string; full_name: string };

    await client.query(`INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3)`, [
      user.id,
      fullName,
      email,
    ]);

    await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'owner'::app_role)`, [user.id]);

    try {
      await client.query(
        `INSERT INTO owners (user_id, name, first_name, middle_name, last_name, email, contact, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user.id, fullName, firstName, middleName, lastName, email, opts.phone ?? null, opts.address ?? null]
      );
    } catch (_err) {
      await client.query(
        `INSERT INTO owners (user_id, name, email, contact, address)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, fullName, email, opts.phone ?? null, opts.address ?? null]
      );
    }

    await client.query("COMMIT");

    await sendVerificationEmail(email, fullName, token);

    return { id: user.id, email: user.email, fullName, role: "owner" as const, needsVerification: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyEmailToken(token: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email, full_name, verification_token_expires FROM users WHERE verification_token = $1`,
    [token]
  );
  if (!rows.length) {
    return { success: false, error: "INVALID_TOKEN", message: "Invalid email verification token." };
  }

  const user = rows[0] as { id: string; email: string; full_name: string; verification_token_expires: Date | null };
  if (user.verification_token_expires && new Date(user.verification_token_expires) < new Date()) {
    return { success: false, error: "EXPIRED_TOKEN", email: user.email, message: "Verification link has expired. Please request a new one." };
  }

  await pool.query(
    `UPDATE users SET email_verified = true, must_verify_gmail = false, verification_token = NULL, verification_token_expires = NULL WHERE id = $1`,
    [user.id]
  );

  return { success: true, message: "Your email has been verified successfully.", email: user.email };
}

export async function resendEmailVerification(email: string) {
  const pool = getPool();
  const crypto = await import("crypto");
  const { sendVerificationEmail } = await import("./email.js");
  const normalized = email.toLowerCase().trim();

  const { rows } = await pool.query(
    `SELECT id, email, full_name, email_verified FROM users WHERE LOWER(email) = $1`,
    [normalized]
  );
  if (!rows.length) {
    return { success: false, error: "USER_NOT_FOUND", message: "User not found." };
  }
  const user = rows[0] as { id: string; email: string; full_name: string; email_verified: boolean };
  if (user.email_verified) {
    return { success: true, message: "Email is already verified." };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    `UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3`,
    [token, expiresAt, user.id]
  );

  await sendVerificationEmail(user.email, user.full_name || user.email, token);
  return { success: true, message: "Verification email has been resent." };
}

export async function forgotPasswordRequest(email: string) {
  const pool = getPool();
  const crypto = await import("crypto");
  const { sendPasswordResetEmail } = await import("./email.js");
  const normalized = email.toLowerCase().trim();

  const { rows } = await pool.query(
    `SELECT id, email, full_name FROM users WHERE LOWER(email) = $1`,
    [normalized]
  );

  if (rows.length) {
    const user = rows[0] as { id: string; email: string; full_name: string };
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await pool.query(
      `UPDATE users SET reset_password_token = $1, reset_password_token_expires = $2 WHERE id = $3`,
      [token, expiresAt, user.id]
    );

    await sendPasswordResetEmail(user.email, user.full_name || user.email, token);
  }

  return { success: true, message: "A password reset link has been sent to your Gmail." };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const pool = getPool();
  const { hashPassword, validatePasswordPolicy } = await import("./auth.js");

  const passValidation = validatePasswordPolicy(newPassword);
  if (!passValidation.valid) {
    throw new Error(passValidation.error || "Password does not meet requirements.");
  }

  const { rows } = await pool.query(
    `SELECT id, email, reset_password_token_expires FROM users WHERE reset_password_token = $1`,
    [token]
  );

  if (!rows.length) {
    throw new Error("Invalid or expired password reset token.");
  }

  const user = rows[0] as { id: string; email: string; reset_password_token_expires: Date | null };
  if (user.reset_password_token_expires && new Date(user.reset_password_token_expires) < new Date()) {
    throw new Error("Password reset link has expired. Please request a new one.");
  }

  const newHash = await hashPassword(newPassword);
  await pool.query(
    `UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_token_expires = NULL, failed_login_attempts = 0, account_locked_until = NULL WHERE id = $2`,
    [newHash, user.id]
  );

  return { success: true, message: "Password changed successfully." };
}

async function setUserVerifiedWithAvatar(userId: string, picture?: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE users SET email_verified = true, must_verify_gmail = false WHERE id = $1`,
    [userId]
  );
  if (picture) {
    await pool.query(`UPDATE profiles SET avatar_url = $1 WHERE id = $2`, [picture, userId]);
    await pool.query(`UPDATE users SET profile_image = $1 WHERE id = $2`, [picture, userId]);
  }
}

export async function loginOrRegisterGoogleUser(
  googleUser: {
    googleId: string;
    email: string;
    fullName: string;
    emailVerified: boolean;
    picture?: string;
  },
  ipAddress?: string
): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getUserSession>>> }
  | { error: "NOT_GMAIL" }
  | { error: "ACCOUNT_DEACTIVATED" }
> {
  const pool = getPool();
  const { isGmailAddress } = await import("./google.js");
  const email = googleUser.email.toLowerCase().trim();

  const { rows: byGoogle } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.account_status
     FROM users u
     WHERE u.google_id = $1`,
    [googleUser.googleId]
  );

  if (byGoogle.length) {
    const id = byGoogle[0].id as string;
    if (byGoogle[0].account_status === "Deactivated") {
      return { error: "ACCOUNT_DEACTIVATED" as const };
    }
    await setUserVerifiedWithAvatar(id, googleUser.picture);
    await recordLoginHistory(id, "Google", ipAddress);
    return { user: await getUserSession(id) };
  }

  const { rows: byEmail } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.account_status
     FROM users u
     WHERE LOWER(u.email) = $1`,
    [email]
  );

  if (byEmail.length) {
    const id = byEmail[0].id as string;
    if (byEmail[0].account_status === "Deactivated") {
      return { error: "ACCOUNT_DEACTIVATED" as const };
    }
    await pool.query(`UPDATE users SET google_id = $1, full_name = COALESCE(full_name, $2) WHERE id = $3`, [
      googleUser.googleId,
      googleUser.fullName,
      id,
    ]);
    await setUserVerifiedWithAvatar(id, googleUser.picture);
    await recordLoginHistory(id, "Google", ipAddress);
    return { user: await getUserSession(id) };
  }

  if (!isGmailAddress(email)) {
    return { error: "NOT_GMAIL" as const };
  }

  const nameParts = googleUser.fullName.trim().split(" ");
  const firstName = nameParts[0] || googleUser.fullName;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const { rows: users } = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, full_name, google_id, profile_image, email_verified, account_status)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, true, 'Active')
     RETURNING id, email, full_name`,
    [email, firstName, lastName, googleUser.fullName, googleUser.googleId, googleUser.picture || null]
  );
  const user = users[0] as { id: string; email: string; full_name: string };

  await pool.query(`INSERT INTO profiles (id, full_name, email, avatar_url) VALUES ($1, $2, $3, $4)`, [
    user.id,
    googleUser.fullName,
    email,
    googleUser.picture ?? null,
  ]);
  // Default role assigned MUST be Pet Owner (owner)
  await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'owner'::app_role)`, [user.id]);
  try {
    await pool.query(`INSERT INTO owners (user_id, name, first_name, last_name, email, image_url) VALUES ($1, $2, $3, $4, $5, $6)`, [
      user.id,
      googleUser.fullName,
      firstName,
      lastName,
      email,
      googleUser.picture || null,
    ]);
  } catch (_err) {
    await pool.query(`INSERT INTO owners (user_id, name, email, image_url) VALUES ($1, $2, $3, $4)`, [
      user.id,
      googleUser.fullName,
      email,
      googleUser.picture || null,
    ]);
  }

  await recordLoginHistory(user.id, "Google", ipAddress);

  return { user: await getUserSession(user.id) };
}

async function getUserSession(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name,
            CASE
              WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'admin') THEN 'admin'
              WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'staff') THEN 'staff'
              ELSE 'owner'
            END AS role
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );
  if (!rows.length) return null;
  const u = rows[0] as { id: string; email: string; full_name: string; role: string };
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role as "admin" | "staff" | "owner",
  };
}

export async function ensureUserProfile(userId: string, email: string, fullName: string | null) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO profiles (id, full_name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
       email = COALESCE(EXCLUDED.email, profiles.email)`,
    [userId, fullName, email]
  );
}

async function fetchUserRow(userId: string) {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT id, email, first_name, middle_name, last_name, full_name, google_id, profile_image, phone, address, account_status, email_verified, last_login, created_at FROM users WHERE id = $1`,
      [userId]
    );
    return (rows[0] as Record<string, unknown>) ?? null;
  } catch {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, created_at FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length) return null;
    return { ...rows[0], google_id: null, email_verified: true };
  }
}

export async function getUserProfile(userId: string) {
  const u = await fetchUserRow(userId);
  if (!u) return null;

  const email = String(u.email ?? "");
  const fullName = u.full_name ? String(u.full_name) : null;
  await ensureUserProfile(userId, email, fullName);

  const pool = getPool();
  const { rows: roleRows } = await pool.query(
    `SELECT role::text AS role FROM user_roles WHERE user_id = $1`,
    [userId]
  );
  const role = resolvePrimaryRole(roleRows.map((r: { role: string }) => r.role));

  let owner: { contact?: string; address?: string; name?: string } | null = null;
  if (role === "owner") {
    const { rows: ownerRows } = await pool.query(
      `SELECT name, contact, address, email FROM owners WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );
    owner = (ownerRows[0] as typeof owner) ?? null;

    if (!owner) {
      await pool.query(
        `INSERT INTO owners (user_id, name, email) VALUES ($1, $2, $3)`,
        [userId, fullName ?? email.split("@")[0], email]
      );
      const { rows: created } = await pool.query(
        `SELECT name, contact, address, email FROM owners WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      owner = (created[0] as typeof owner) ?? null;
    }
  }

  let avatarUrl: string | null = (u.profile_image as string | null) ?? null;
  if (!avatarUrl) {
    try {
      const { rows: profileRows } = await pool.query(`SELECT avatar_url FROM profiles WHERE id = $1`, [userId]);
      avatarUrl = (profileRows[0]?.avatar_url as string | null) ?? null;
    } catch {
      avatarUrl = null;
    }
  }

  const loginHistory = await getUserLoginHistory(userId, 5);

  let firstName = (u.first_name as string | null) ?? null;
  let middleName = (u.middle_name as string | null) ?? null;
  let lastName = (u.last_name as string | null) ?? null;

  if (!firstName && fullName) {
    const parts = fullName.split(" ").filter(Boolean);
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
    } else if (parts.length >= 3) {
      firstName = parts[0];
      middleName = parts[1];
      lastName = parts.slice(2).join(" ");
    }
  }

  return {
    id: String(u.id),
    email,
    firstName,
    middleName,
    lastName,
    fullName,
    role: role as "admin" | "staff" | "owner",
    authMethod: u.google_id ? ("google" as const) : ("password" as const),
    createdAt: String(u.created_at ?? nowPHIso()),
    lastLogin: u.last_login ? new Date(u.last_login as Date).toISOString() : null,
    accountStatus: String(u.account_status ?? "Active"),
    contact: (u.phone as string | null) ?? owner?.contact ?? null,
    address: (u.address as string | null) ?? owner?.address ?? null,
    ownerName: owner?.name ?? null,
    avatarUrl,
    emailVerified: Boolean(u.email_verified ?? true),
    loginHistory,
  };
}

export async function updateUserProfile(
  userId: string,
  opts: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    fullName?: string;
    contact?: string;
    address?: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  }
) {
  const pool = getPool();
  const { verifyPassword, hashPassword, validatePasswordPolicy } = await import("./auth.js");

  if (opts.newPassword) {
    const passVal = validatePasswordPolicy(opts.newPassword);
    if (!passVal.valid) throw new Error(passVal.error || "Password does not meet requirements.");

    const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    const hash = rows[0]?.password_hash as string | null;
    if (!hash) throw new Error("Google accounts cannot set a password here. Use Google sign-in.");
    if (!opts.currentPassword || !(await verifyPassword(opts.currentPassword, hash))) {
      throw new Error("Current password is incorrect.");
    }
    const newHash = await hashPassword(opts.newPassword);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);
  }

  const nameParts = [opts.firstName?.trim(), opts.middleName?.trim(), opts.lastName?.trim()].filter(Boolean);
  const computedName = nameParts.length ? nameParts.join(" ") : (opts.fullName?.trim() || "");
  if (computedName.trim()) {
    await pool.query(`UPDATE users SET full_name = $1, first_name = $2, middle_name = $3, last_name = $4 WHERE id = $5`, [
      computedName.trim(),
      opts.firstName?.trim() || null,
      opts.middleName?.trim() || null,
      opts.lastName?.trim() || null,
      userId,
    ]);
    await pool.query(`UPDATE profiles SET full_name = $1 WHERE id = $2`, [computedName.trim(), userId]);
    const { rows: roles } = await pool.query(
      `SELECT role FROM user_roles WHERE user_id = $1 AND role = 'owner'`,
      [userId]
    );
    if (roles.length) {
      await pool.query(`UPDATE owners SET name = $1, first_name = $2, middle_name = $3, last_name = $4 WHERE user_id = $5`, [
        computedName.trim(),
        opts.firstName?.trim() || null,
        opts.middleName?.trim() || null,
        opts.lastName?.trim() || null,
        userId,
      ]);
    }
  }

  if (opts.contact !== undefined) {
    await pool.query(`UPDATE users SET phone = $1 WHERE id = $2`, [opts.contact ? opts.contact.trim() : null, userId]);
  }
  if (opts.address !== undefined) {
    await pool.query(`UPDATE users SET address = $1 WHERE id = $2`, [opts.address ? opts.address.trim() : null, userId]);
  }

  const { rows: roleCheck } = await pool.query(
    `SELECT role FROM user_roles WHERE user_id = $1 AND role = 'owner'`,
    [userId]
  );
  if (roleCheck.length) {
    if (opts.contact !== undefined) {
      await pool.query(`UPDATE owners SET contact = $1 WHERE user_id = $2`, [opts.contact ? opts.contact.trim() : null, userId]);
    }
    if (opts.address !== undefined) {
      await pool.query(`UPDATE owners SET address = $1 WHERE user_id = $2`, [opts.address ? opts.address.trim() : null, userId]);
    }
  }

  if (opts.avatarUrl !== undefined) {
    const { rows: userRows } = await pool.query(`SELECT email, full_name FROM users WHERE id = $1`, [userId]);
    if (userRows.length) {
      const u = userRows[0] as { email: string; full_name: string | null };
      await ensureUserProfile(userId, u.email, u.full_name);
    }
    await pool.query(`UPDATE profiles SET avatar_url = $1 WHERE id = $2`, [opts.avatarUrl || null, userId]);
    await pool.query(`UPDATE users SET profile_image = $1 WHERE id = $2`, [opts.avatarUrl || null, userId]);
    await pool.query(`UPDATE owners SET image_url = $1 WHERE user_id = $2`, [opts.avatarUrl || null, userId]);
  }

  return getUserProfile(userId);
}

export type LoginUserResult =
  | { id: string; email: string; fullName: string; role: "admin" | "staff" | "owner" }
  | { error: "EMAIL_NOT_VERIFIED"; email: string }
  | { error: "GOOGLE_ONLY"; email: string }
  | { error: "ACCOUNT_DEACTIVATED"; message: string }
  | { error: "ACCOUNT_LOCKED"; message: string }
  | { error: "INVALID_CREDENTIALS"; message: string };

export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string
): Promise<LoginUserResult> {
  const pool = getPool();
  const { verifyPassword, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS } = await import("./auth.js");
  const normalized = email.toLowerCase().trim();

  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.password_hash, u.google_id,
            u.email_verified, u.account_status, u.failed_login_attempts,
            u.account_locked_until, ur.role
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE LOWER(u.email) = $1
     ORDER BY ur.role ASC`,
    [normalized]
  );
  const rows = result.rows as Record<string, unknown>[];

  if (!rows.length) {
    return { error: "INVALID_CREDENTIALS", message: "Invalid email or password." };
  }

  const user = rows[0] as {
    id: string;
    email: string;
    full_name: string;
    password_hash: string | null;
    google_id?: string | null;
    email_verified?: boolean;
    account_status?: string;
    failed_login_attempts?: number;
    account_locked_until?: Date | null;
    role: "admin" | "staff" | "owner" | null;
  };

  if (user.account_status === "Deactivated") {
    return { error: "ACCOUNT_DEACTIVATED", message: "Account is deactivated. Please contact an administrator." };
  }

  if (user.account_locked_until) {
    const lockedUntil = new Date(user.account_locked_until);
    if (lockedUntil > new Date()) {
      return { error: "ACCOUNT_LOCKED", message: "Too many failed login attempts. Please try again later." };
    } else {
      // Lock duration expired, reset attempts
      await pool.query(`UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1`, [user.id]);
    }
  }

  if (!user.password_hash) {
    if (user.google_id) {
      return { error: "GOOGLE_ONLY", email: user.email };
    }
    return { error: "INVALID_CREDENTIALS", message: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const newAttempts = (user.failed_login_attempts || 0) + 1;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await pool.query(
        `UPDATE users SET failed_login_attempts = $1, account_locked_until = $2 WHERE id = $3`,
        [newAttempts, lockUntil, user.id]
      );
      return { error: "ACCOUNT_LOCKED", message: "Too many failed login attempts. Please try again later." };
    } else {
      await pool.query(`UPDATE users SET failed_login_attempts = $1 WHERE id = $2`, [newAttempts, user.id]);
      return { error: "INVALID_CREDENTIALS", message: "Invalid email or password." };
    }
  }

  const role = resolvePrimaryRole(
    rows.map((r) => r.role as string | null | undefined).filter(Boolean) as string[]
  );

  const needsVerification =
    role === "owner" &&
    user.email_verified !== true;

  if (needsVerification) {
    return { error: "EMAIL_NOT_VERIFIED", email: user.email };
  }

  // Clear failed attempts and lockout on success
  await pool.query(
    `UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1`,
    [user.id]
  );

  await recordLoginHistory(user.id, "Email", ipAddress);

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: role as "admin" | "staff" | "owner",
  };
}

export async function createStaffAccount(adminUserId: string, opts: {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const pool = getPool();
  const { hashPassword, validatePasswordPolicy } = await import("./auth.js");
  const email = opts.email.toLowerCase().trim();

  const passVal = validatePasswordPolicy(opts.password);
  if (!passVal.valid) throw new Error(passVal.error || "Password does not meet requirements.");

  const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [email]);
  if (existing.rows.length) {
    throw new Error("An account with this email address already exists.");
  }

  const passwordHash = await hashPassword(opts.password);
  const firstName = opts.firstName.trim();
  const middleName = opts.middleName?.trim() || null;
  const lastName = opts.lastName.trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, first_name, middle_name, last_name, full_name, phone, email_verified, account_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'Active')
       RETURNING id, email, full_name`,
      [email, passwordHash, firstName, middleName, lastName, fullName, opts.phone || null]
    );
    const user = rows[0] as { id: string; email: string; full_name: string };

    await client.query(`INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3)`, [
      user.id,
      fullName,
      email,
    ]);

    await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'staff'::app_role)`, [user.id]);

    await client.query("COMMIT");
    return { id: user.id, email: user.email, fullName, role: "staff" as const };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function toggleAccountStatus(adminUserId: string, targetUserId: string, status: "Active" | "Deactivated") {
  const pool = getPool();
  if (adminUserId === targetUserId && status === "Deactivated") {
    throw new Error("Administrators cannot deactivate their own account.");
  }
  await pool.query(`UPDATE users SET account_status = $1 WHERE id = $2`, [status, targetUserId]);
  return { success: true, status };
}

export async function adminResetPassword(adminUserId: string, targetUserId: string, newPassword: string) {
  const pool = getPool();
  const { hashPassword, validatePasswordPolicy } = await import("./auth.js");

  const passVal = validatePasswordPolicy(newPassword);
  if (!passVal.valid) throw new Error(passVal.error || "Password does not meet complexity requirements.");

  // Check if target is another administrator
  const { rows: roles } = await pool.query(
    `SELECT role FROM user_roles WHERE user_id = $1 AND role = 'admin'`,
    [targetUserId]
  );
  if (roles.length && adminUserId !== targetUserId) {
    throw new Error("Administrator cannot change another Administrator's password directly.");
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query(
    `UPDATE users SET password_hash = $1, failed_login_attempts = 0, account_locked_until = NULL WHERE id = $2`,
    [passwordHash, targetUserId]
  );

  return { success: true, message: "Password reset successfully." };
}

export async function getAllUsersForAdmin() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.middle_name, u.last_name, u.full_name,
            u.phone, u.account_status, u.email_verified, u.created_at, u.last_login,
            ur.role::text AS role
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    email: String(r.email),
    firstName: (r.first_name as string | null) ?? null,
    middleName: (r.middle_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
    fullName: String(r.full_name || r.email),
    phone: (r.phone as string | null) ?? null,
    role: (r.role as "admin" | "staff" | "owner") ?? "owner",
    accountStatus: String(r.account_status || "Active"),
    emailVerified: Boolean(r.email_verified),
    createdAt: r.created_at ? new Date(r.created_at as Date).toISOString() : null,
    lastLogin: r.last_login ? new Date(r.last_login as Date).toISOString() : null,
  }));
}
