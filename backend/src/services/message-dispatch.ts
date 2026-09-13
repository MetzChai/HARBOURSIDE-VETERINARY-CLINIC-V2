import { getPool } from "../lib/db.js";
import { sendClinicNoticeEmail } from "./email.js";

export type ClinicMessagePayload = {
  owner_id?: string | null;
  pet_id?: string | null;
  phone?: string | null;
  email?: string | null;
  subject?: string | null;
  body: string;
  channel?: string | null;
  message_type?: string | null;
  status?: string | null;
  sent_by?: string | null;
  scheduled_at?: string | null;
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function channelIncludesEmail(channel: string) {
  const ch = (channel || "").toUpperCase();
  return ch === "ALL" || ch.includes("EMAIL");
}

export function channelIncludesSms(channel: string) {
  const ch = (channel || "").toUpperCase();
  return ch === "ALL" || ch.includes("SMS");
}

export function isOwnerOriginated(payload: Record<string, unknown>) {
  return String(payload.sent_by ?? "").toLowerCase() === "owner";
}

export function normalizeMessagePayload(row: Record<string, unknown>): Record<string, unknown> {
  const ownerId = isUuid(row.owner_id) ? row.owner_id : null;
  const petId = isUuid(row.pet_id) ? row.pet_id : null;
  const body = String(row.body ?? "").trim();
  const channel = String(row.channel ?? "IN_APP").trim() || "IN_APP";
  const scheduledAt = row.scheduled_at ? String(row.scheduled_at) : null;
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const isFuture =
    scheduledDate && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now() + 15_000;

  return {
    owner_id: ownerId,
    pet_id: petId,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    subject: row.subject ? String(row.subject) : null,
    body,
    channel,
    message_type: String(row.message_type ?? "Custom Message"),
    status: isFuture ? "PENDING" : String(row.status ?? "SENT"),
    sent_by: row.sent_by ? String(row.sent_by) : null,
    scheduled_at: scheduledAt,
    sent_at: isFuture ? null : row.sent_at || new Date().toISOString(),
  };
}

let messagesSchemaReady = false;

export async function ensureMessagesSchema() {
  if (messagesSchemaReady) return;
  const pool = getPool();
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS pet_id uuid REFERENCES pets(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'Custom Message'`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_by text`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS scheduled_at timestamptz`);
  await pool.query(`ALTER TABLE messages ALTER COLUMN sent_at DROP NOT NULL`);
  messagesSchemaReady = true;
}

async function resolveRecipient(payload: Record<string, unknown>) {
  const pool = getPool();
  let email = payload.email ? String(payload.email) : "";
  let phone = payload.phone ? String(payload.phone) : "";
  let ownerName = "Valued Pet Owner";

  if (isUuid(payload.owner_id)) {
    const { rows } = await pool.query(
      `SELECT name, email, contact FROM owners WHERE id = $1`,
      [payload.owner_id]
    );
    if (rows[0]) {
      ownerName = String(rows[0].name || ownerName);
      email = email || String(rows[0].email || "");
      phone = phone || String(rows[0].contact || "");
    }
  }

  return { email: email.trim(), phone: phone.trim(), ownerName };
}

async function listBroadcastRecipients() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT name, email, contact FROM owners WHERE email IS NOT NULL AND TRIM(email) <> ''`
  );
  return rows as { name: string | null; email: string | null; contact: string | null }[];
}

export async function deliverClinicMessage(payload: Record<string, unknown>) {
  if (isOwnerOriginated(payload)) return;
  if (String(payload.status ?? "").toUpperCase() === "PENDING") return;

  const channel = String(payload.channel ?? "IN_APP");
  const subject = String(payload.subject || payload.message_type || "Harbourside Veterinary Clinic");
  const body = String(payload.body ?? "");
  const wantsEmail = channelIncludesEmail(channel);
  const wantsSms = channelIncludesSms(channel);

  if (wantsSms) {
    const { phone } = await resolveRecipient(payload);
    if (phone) {
      console.log(`[SMS SIMULATION] To: ${phone}\nSubject: ${subject}\n${body}\n`);
    } else if (!payload.owner_id) {
      const recipients = await listBroadcastRecipients();
      for (const r of recipients) {
        if (r.contact) console.log(`[SMS SIMULATION] To: ${r.contact}\nSubject: ${subject}\n${body}\n`);
      }
    } else {
      console.log(`[SMS SIMULATION] Skipped — no phone on file for owner ${payload.owner_id}`);
    }
  }

  if (!wantsEmail) return;

  if (payload.owner_id) {
    const { email, ownerName } = await resolveRecipient(payload);
    if (email) {
      await sendClinicNoticeEmail(email, ownerName, subject, body);
    } else {
      console.log(`[EMAIL] Skipped — no email on file for owner ${payload.owner_id}`);
    }
    return;
  }

  const recipients = await listBroadcastRecipients();
  for (const r of recipients) {
    if (r.email) {
      await sendClinicNoticeEmail(r.email, r.name || "Valued Pet Owner", subject, body);
    }
  }
}

export async function notifyOwnerOnAppointmentChange(opts: {
  appointmentId: string;
  previousStatus?: string | null;
  nextStatus?: string | null;
  dateChanged?: boolean;
  sentBy: string;
}) {
  const next = (opts.nextStatus || "").trim();
  if (!next) return;
  if (!["Scheduled", "Cancelled", "Completed"].includes(next)) return;
  if (next === opts.previousStatus && !(opts.dateChanged && next === "Scheduled")) return;

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT a.date, a.time, a.reason, a.status, a.owner_id, a.pet_id,
            o.name AS owner_name, o.email, o.contact,
            p.name AS pet_name
     FROM appointments a
     LEFT JOIN owners o ON o.id = a.owner_id
     LEFT JOIN pets p ON p.id = a.pet_id
     WHERE a.id = $1`,
    [opts.appointmentId]
  );
  if (!rows.length) return;

  const apt = rows[0] as {
    date: string;
    time: string;
    reason: string | null;
    owner_id: string | null;
    pet_id: string | null;
    owner_name: string | null;
    email: string | null;
    contact: string | null;
    pet_name: string | null;
  };

  if (!apt.owner_id) return;

  const ownerName = apt.owner_name || "Valued Pet Owner";
  const petName = apt.pet_name || "your pet";
  const when = `${apt.date} at ${apt.time}`;

  let messageType = "Custom Message";
  let subject = "Appointment update — Harbourside Veterinary Clinic";
  let body = `Dear ${ownerName},\n\nThere is an update to ${petName}'s appointment (${when}).\n\nHarbourside Veterinary Clinic`;

  if (next === "Scheduled") {
    messageType = opts.previousStatus === "Requested" && !opts.dateChanged ? "Appointment Approved" : "Appointment Rescheduled";
    subject =
      messageType === "Appointment Approved"
        ? `Appointment Approved for ${petName}`
        : `Appointment Updated for ${petName}`;
    body = `Dear ${ownerName},\n\nYour appointment for ${petName} is confirmed for ${when}${apt.reason ? ` (${apt.reason})` : ""}.\n\nPlease arrive 10 minutes early.\n\nHarbourside Veterinary Clinic`;
  } else if (next === "Cancelled") {
    messageType = "Appointment Cancelled";
    subject = `Appointment Cancellation for ${petName}`;
    body = `Dear ${ownerName},\n\nYour appointment for ${petName} on ${when} has been cancelled.\n\nPlease contact the clinic or book a new slot in the portal if you still need a visit.\n\nHarbourside Veterinary Clinic`;
  } else if (next === "Completed") {
    messageType = "Custom Message";
    subject = `Visit completed for ${petName}`;
    body = `Dear ${ownerName},\n\n${petName}'s visit on ${when} has been marked completed. You can review records and transactions in your portal.\n\nHarbourside Veterinary Clinic`;
  }

  const payload = {
    owner_id: apt.owner_id,
    pet_id: apt.pet_id,
    phone: apt.contact,
    email: apt.email,
    subject,
    body,
    channel: "ALL",
    message_type: messageType,
    status: "SENT",
    sent_by: opts.sentBy,
  };

  await pool.query(
    `INSERT INTO messages (owner_id, pet_id, phone, email, subject, body, channel, message_type, status, sent_by, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
    [
      payload.owner_id,
      payload.pet_id,
      payload.phone,
      payload.email,
      payload.subject,
      payload.body,
      payload.channel,
      payload.message_type,
      payload.status,
      payload.sent_by,
    ]
  );

  await deliverClinicMessage(payload);
}

export async function processPendingScheduledMessages() {
  await ensureMessagesSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM messages
     WHERE UPPER(status) = 'PENDING'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= now()
     ORDER BY scheduled_at ASC
     LIMIT 50`
  );

  for (const row of rows) {
    const payload = row as Record<string, unknown>;
    await pool.query(`UPDATE messages SET status = 'SENT', sent_at = now() WHERE id = $1`, [payload.id]);
    payload.status = "SENT";
    try {
      await deliverClinicMessage(payload);
    } catch (err) {
      console.error("[messages] Scheduled delivery failed:", err);
    }
  }
}
