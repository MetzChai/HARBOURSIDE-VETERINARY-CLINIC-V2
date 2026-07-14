import type { SessionUser } from "./auth.js";
import { getPool, isTableName, parseSelect, quoteIdent, type TableName } from "../lib/db.js";
import { APPOINTMENT_SLOTS, isSlotBlockingStatus, normalizeCareType } from "../lib/appointment-slots.js";
import { toDateOnly, nowPHIso } from "../lib/datetime.js";

type Filter = { column: string; value: unknown };

const WALK_IN_OWNER_ID = "00000000-0000-0000-0000-0000000000aa";

type CareSyncResult = { recorded: boolean; skipReason?: string };

const ADMIN_ONLY_TABLES: TableName[] = [
  "inventory_items",
  "inventory_transactions",
  "messages",
];

async function getOwnerIds(userId: string): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query("SELECT id FROM owners WHERE user_id = $1", [userId]);
  return rows.map((r: { id: string }) => r.id);
}

async function getPetIds(userId: string): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.id FROM pets p JOIN owners o ON p.owner_id = o.id WHERE o.user_id = $1`,
    [userId]
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

  if (ADMIN_ONLY_TABLES.includes(table)) {
    throw new Error("Forbidden");
  }

  if (action !== "select" && user.role === "owner") {
    if (table === "appointments" && action === "insert") return;
    if (table === "owners" && action === "update") return;
    throw new Error("Forbidden");
  }
}

export async function buildOwnerScope(
  user: SessionUser,
  table: TableName
): Promise<{ clause: string; params: unknown[] } | null> {
  if (user.role === "admin") return null;

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

  const petIds = await getPetIds(user.id);
  if (!petIds.includes(petId)) {
    throw new Error("You can only request appointments for your own pets.");
  }

  const pool = getPool();
  const { rows: petRows } = await pool.query(`SELECT owner_id FROM pets WHERE id = $1`, [petId]);
  const ownerId = petRows[0]?.owner_id as string | undefined;
  if (!ownerId) throw new Error("Pet not found.");

  await assertAppointmentSlotAvailable(date, time);

  return {
    pet_id: petId,
    owner_id: ownerId,
    date,
    time,
    reason,
    vet: null,
    type: "request",
    status: "Requested",
    care_type: normalizeCareType(row.care_type),
    notes: null,
  };
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

  for (const row of rows) {
    let payload = row;
    if (table === "appointments" && opts.user.role === "owner") {
      payload = await sanitizeOwnerAppointmentInsert(opts.user, row);
    }

    const keys = Object.keys(payload).map(quoteIdent);
    const values = Object.values(payload);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const query = `INSERT INTO ${quoteIdent(table)} (${keys.join(", ")}) VALUES (${placeholders})${
      opts.returning ? " RETURNING *" : ""
    }`;
    const { rows: inserted } = await pool.query(query, values);
    if (opts.returning && inserted.length) results.push(inserted[0] as Record<string, unknown>);
  }

  if (opts.returning) {
    return Array.isArray(opts.data) ? results : results[0] ?? null;
  }
  return null;
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
  const keys = Object.keys(opts.data).map(quoteIdent);
  let values = Object.values(opts.data);

  if (table === "appointments" && opts.user.role === "admin") {
    const idFilter = opts.filters.find((f) => f.column === "id");
    const appointmentId = idFilter?.value ? String(idFilter.value) : undefined;

    if (opts.data.status === "Scheduled" && appointmentId) {
      const { rows } = await pool.query(`SELECT date, time FROM appointments WHERE id = $1`, [appointmentId]);
      const current = rows[0] as { date?: string; time?: string } | undefined;
      const date = String(opts.data.date ?? current?.date ?? "");
      const time = String(opts.data.time ?? current?.time ?? "");
      if (date && time) {
        await assertAppointmentSlotAvailable(date, time, appointmentId);
      }
    }
  }

  let shouldSyncCare = false;
  let appointmentIdForSync: string | undefined;
  if (table === "appointments" && opts.data.status === "Completed") {
    const idFilter = opts.filters.find((f) => f.column === "id");
    appointmentIdForSync = idFilter?.value ? String(idFilter.value) : undefined;
    if (appointmentIdForSync) {
      const { rows } = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [appointmentIdForSync]);
      const previousStatus = rows[0]?.status as string | undefined;
      shouldSyncCare = previousStatus !== "Completed";
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

  if (shouldSyncCare && appointmentIdForSync) {
    const result = await syncCareRecordFromCompletedAppointment(appointmentIdForSync);
    return { careRecorded: result.recorded, careSkipReason: result.skipReason };
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

  const careType = normalizeCareType(apt.care_type);
  const reason = apt.reason?.trim() || (careType === "vaccine" ? "Vaccination" : "Routine visit");
  const autoNote = "Auto-recorded from completed appointment.";
  const recordDate = toDateOnly(apt.date);

  if (careType === "vaccine") {
    const existing = await pool.query(`SELECT id FROM vaccinations WHERE appointment_id = $1`, [appointmentId]);
    if (existing.rows.length) return { recorded: true };

    try {
      await pool.query(
        `INSERT INTO vaccinations (pet_id, appointment_id, vaccine_type, date_given, vet, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [petId, appointmentId, reason, recordDate, apt.vet, autoNote]
      );
      return { recorded: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("appointment_id")) throw err;

      const marker = `appointment:${appointmentId}`;
      const dup = await pool.query(`SELECT id FROM vaccinations WHERE notes LIKE $1`, [`%${marker}%`]);
      if (dup.rows.length) return { recorded: true };

      await pool.query(
        `INSERT INTO vaccinations (pet_id, vaccine_type, date_given, vet, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [petId, reason, recordDate, apt.vet, `${autoNote} ${marker}`]
      );
      return { recorded: true };
    }
  }

  try {
    const existing = await pool.query(`SELECT id FROM care_records WHERE appointment_id = $1`, [appointmentId]);
    if (existing.rows.length) return { recorded: true };

    if (careType === "treatment") {
      await pool.query(
        `INSERT INTO care_records (pet_id, appointment_id, record_type, date, vet, treatment, notes)
         VALUES ($1, $2, 'treatment', $3, $4, $5, $6)`,
        [petId, appointmentId, recordDate, apt.vet, reason, autoNote]
      );
    } else {
      await pool.query(
        `INSERT INTO care_records (pet_id, appointment_id, record_type, date, vet, diagnosis, outcome, notes)
         VALUES ($1, $2, 'checkup', $3, $4, $5, $6, $7)`,
        [petId, appointmentId, recordDate, apt.vet, reason, "Completed", autoNote]
      );
    }
    return { recorded: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("appointment_id")) throw err;

    const marker = `appointment:${appointmentId}`;
    const dup = await pool.query(`SELECT id FROM care_records WHERE notes LIKE $1`, [`%${marker}%`]);
    if (dup.rows.length) return { recorded: true };

    if (careType === "treatment") {
      await pool.query(
        `INSERT INTO care_records (pet_id, record_type, date, vet, treatment, notes)
         VALUES ($1, 'treatment', $2, $3, $4, $5)`,
        [petId, recordDate, apt.vet, reason, `${autoNote} ${marker}`]
      );
    } else {
      await pool.query(
        `INSERT INTO care_records (pet_id, record_type, date, vet, diagnosis, outcome, notes)
         VALUES ($1, 'checkup', $2, $3, $4, $5, $6)`,
        [petId, recordDate, apt.vet, reason, "Completed", `${autoNote} ${marker}`]
      );
    }
    return { recorded: true };
  }
}

export async function registerUser(opts: {
  email: string;
  password: string;
  fullName: string;
  contact?: string;
}) {
  const pool = getPool();
  const { hashPassword } = await import("./auth.js");
  const passwordHash = await hashPassword(opts.password);
  const email = opts.email.toLowerCase().trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let user: { id: string; email: string; full_name: string };
    try {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, email_verified, must_verify_gmail)
         VALUES ($1, $2, $3, false, true)
         RETURNING id, email, full_name`,
        [email, passwordHash, opts.fullName]
      );
      user = rows[0] as { id: string; email: string; full_name: string };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("must_verify_gmail") && !msg.includes("email_verified")) {
        throw err;
      }
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name`,
        [email, passwordHash, opts.fullName]
      );
      user = rows[0] as { id: string; email: string; full_name: string };
    }

    await client.query(`INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3)`, [
      user.id,
      opts.fullName,
      email,
    ]);

    await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'owner'::app_role)`, [user.id]);

    await client.query(`INSERT INTO owners (user_id, name, email, contact) VALUES ($1, $2, $3, $4)`, [
      user.id,
      opts.fullName,
      email,
      opts.contact ?? null,
    ]);

    await client.query("COMMIT");

    return { id: user.id, email: user.email, fullName: user.full_name, role: "owner" as const };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function setUserVerifiedWithAvatar(userId: string, picture?: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE users SET email_verified = true, must_verify_gmail = false WHERE id = $1`,
    [userId]
  );
  if (picture) {
    await pool.query(`UPDATE profiles SET avatar_url = $1 WHERE id = $2`, [picture, userId]);
  }
}

export async function loginOrRegisterGoogleUser(googleUser: {
  googleId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  picture?: string;
}): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getUserSession>>> }
  | { error: "NOT_GMAIL" }
> {
  const pool = getPool();
  const { isGmailAddress } = await import("./google.js");
  const email = googleUser.email.toLowerCase();

  const { rows: byGoogle } = await pool.query(
    `SELECT u.id, u.email, u.full_name
     FROM users u
     WHERE u.google_id = $1`,
    [googleUser.googleId]
  );

  if (byGoogle.length) {
    const id = byGoogle[0].id as string;
    await setUserVerifiedWithAvatar(id, googleUser.picture);
    return { user: await getUserSession(id) };
  }

  const { rows: byEmail } = await pool.query(
    `SELECT u.id, u.email, u.full_name
     FROM users u
     WHERE LOWER(u.email) = $1`,
    [email]
  );

  if (byEmail.length) {
    const id = byEmail[0].id as string;
    await pool.query(`UPDATE users SET google_id = $1, full_name = COALESCE(full_name, $2) WHERE id = $3`, [
      googleUser.googleId,
      googleUser.fullName,
      id,
    ]);
    await setUserVerifiedWithAvatar(id, googleUser.picture);
    return { user: await getUserSession(id) };
  }

  if (!isGmailAddress(email)) {
    return { error: "NOT_GMAIL" as const };
  }

  const { rows: users } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, google_id, email_verified)
     VALUES ($1, NULL, $2, $3, true)
     RETURNING id, email, full_name`,
    [email, googleUser.fullName, googleUser.googleId]
  );
  const user = users[0] as { id: string; email: string; full_name: string };

  await pool.query(`INSERT INTO profiles (id, full_name, email, avatar_url) VALUES ($1, $2, $3, $4)`, [
    user.id,
    googleUser.fullName,
    email,
    googleUser.picture ?? null,
  ]);
  await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'owner'::app_role)`, [user.id]);
  await pool.query(`INSERT INTO owners (user_id, name, email) VALUES ($1, $2, $3)`, [
    user.id,
    googleUser.fullName,
    email,
  ]);

  return { user: await getUserSession(user.id) };
}

async function getUserSession(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name,
            CASE WHEN EXISTS (
              SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'admin'
            ) THEN 'admin' ELSE 'owner' END AS role
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
    role: u.role as "admin" | "owner",
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
      `SELECT id, email, full_name, google_id, email_verified, created_at FROM users WHERE id = $1`,
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
  const role = roleRows.some((r: { role: string }) => r.role === "admin") ? "admin" : "owner";

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

  let avatarUrl: string | null = null;
  try {
    const { rows: profileRows } = await pool.query(`SELECT avatar_url FROM profiles WHERE id = $1`, [userId]);
    avatarUrl = (profileRows[0]?.avatar_url as string | null) ?? null;
  } catch {
    avatarUrl = null;
  }

  return {
    id: String(u.id),
    email,
    fullName,
    role: role as "admin" | "owner",
    authMethod: u.google_id ? ("google" as const) : ("password" as const),
    createdAt: String(u.created_at ?? nowPHIso()),
    contact: owner?.contact ?? null,
    address: owner?.address ?? null,
    ownerName: owner?.name ?? null,
    avatarUrl,
    emailVerified: Boolean(u.email_verified ?? true),
  };
}

export async function updateUserProfile(
  userId: string,
  opts: {
    fullName?: string;
    contact?: string;
    address?: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  }
) {
  const pool = getPool();
  const { verifyPassword, hashPassword } = await import("./auth.js");

  if (opts.newPassword) {
    if (opts.newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
    const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    const hash = rows[0]?.password_hash as string | null;
    if (!hash) throw new Error("Google accounts cannot set a password here. Use Google sign-in.");
    if (!opts.currentPassword || !(await verifyPassword(opts.currentPassword, hash))) {
      throw new Error("Current password is incorrect.");
    }
    const newHash = await hashPassword(opts.newPassword);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);
  }

  if (opts.fullName?.trim()) {
    await pool.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [opts.fullName.trim(), userId]);
    await pool.query(`UPDATE profiles SET full_name = $1 WHERE id = $2`, [opts.fullName.trim(), userId]);
    const { rows: roles } = await pool.query(
      `SELECT role FROM user_roles WHERE user_id = $1 AND role = 'owner'`,
      [userId]
    );
    if (roles.length) {
      await pool.query(`UPDATE owners SET name = $1 WHERE user_id = $2`, [opts.fullName.trim(), userId]);
    }
  }

  const { rows: roleCheck } = await pool.query(
    `SELECT role FROM user_roles WHERE user_id = $1 AND role = 'owner'`,
    [userId]
  );
  if (roleCheck.length) {
    if (opts.contact !== undefined) {
      await pool.query(`UPDATE owners SET contact = $1 WHERE user_id = $2`, [opts.contact || null, userId]);
    }
    if (opts.address !== undefined) {
      await pool.query(`UPDATE owners SET address = $1 WHERE user_id = $2`, [opts.address || null, userId]);
    }
  }

  if (opts.avatarUrl !== undefined) {
    const { rows: userRows } = await pool.query(`SELECT email, full_name FROM users WHERE id = $1`, [userId]);
    if (userRows.length) {
      const u = userRows[0] as { email: string; full_name: string | null };
      await ensureUserProfile(userId, u.email, u.full_name);
    }
    await pool.query(`UPDATE profiles SET avatar_url = $1 WHERE id = $2`, [opts.avatarUrl || null, userId]);
  }

  return getUserProfile(userId);
}

export type LoginUserResult =
  | { id: string; email: string; fullName: string; role: "admin" | "owner" }
  | { error: "EMAIL_NOT_VERIFIED"; email: string }
  | { error: "GOOGLE_ONLY"; email: string };

export async function loginUser(email: string, password: string): Promise<LoginUserResult | null> {
  const pool = getPool();
  const { verifyPassword } = await import("./auth.js");
  const normalized = email.toLowerCase().trim();

  let rows: Record<string, unknown>[];
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.password_hash, u.google_id,
              u.email_verified, u.must_verify_gmail, ur.role
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE LOWER(u.email) = $1
       ORDER BY ur.role ASC`,
      [normalized]
    );
    rows = result.rows as Record<string, unknown>[];
  } catch {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.password_hash, u.google_id, ur.role
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE LOWER(u.email) = $1
       ORDER BY ur.role ASC`,
      [normalized]
    );
    rows = result.rows as Record<string, unknown>[];
  }

  if (!rows.length) return null;
  const user = rows[0] as {
    id: string;
    email: string;
    full_name: string;
    password_hash: string | null;
    google_id?: string | null;
    email_verified?: boolean;
    must_verify_gmail?: boolean;
    role: "admin" | "owner" | null;
  };

  if (!user.password_hash) {
    if (user.google_id) {
      return { error: "GOOGLE_ONLY", email: user.email };
    }
    return null;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const role = rows.some((r) => r.role === "admin") ? "admin" : (user.role ?? "owner");

  const needsVerification =
    role === "owner" &&
    user.must_verify_gmail === true &&
    user.email_verified !== true;

  if (needsVerification) {
    return { error: "EMAIL_NOT_VERIFIED", email: user.email };
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: role as "admin" | "owner",
  };
}
