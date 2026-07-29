import { getPool } from "../lib/db.js";
import { hashPassword, type AppRole } from "./auth.js";
import { ensureUserProfile } from "./data.js";

export type ClinicAccount = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  createdAt: string;
};

export async function listClinicAccounts(): Promise<ClinicAccount[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, ur.role::text AS role, u.created_at
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     WHERE ur.role IN ('admin', 'staff')
     ORDER BY ur.role ASC, u.full_name ASC NULLS LAST, u.email ASC`
  );
  return rows.map((r: { id: string; email: string; full_name: string | null; role: string; created_at: Date }) => ({
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: r.role as AppRole,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function createStaffAccount(opts: {
  email: string;
  fullName: string;
  password: string;
}): Promise<ClinicAccount> {
  const pool = getPool();
  const normalized = opts.email.toLowerCase().trim();

  if (opts.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [normalized]);
  if (existing.rows.length) {
    throw new Error("A user with this email already exists.");
  }

  const passwordHash = await hashPassword(opts.password);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, email_verified)
     VALUES ($1, $2, $3, true)
     RETURNING id, email, full_name, created_at`,
    [normalized, passwordHash, opts.fullName.trim()]
  );
  const user = rows[0] as { id: string; email: string; full_name: string; created_at: Date };

  await ensureUserProfile(user.id, user.email, user.full_name);
  await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'staff'::app_role)`, [user.id]);

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: "staff",
    createdAt: user.created_at.toISOString(),
  };
}

export type OwnerAccount = {
  id: string;
  email: string;
  fullName: string | null;
  role: "owner";
  authMethod: "google" | "password";
  createdAt: string;
};

export async function listOwnerAccounts(): Promise<OwnerAccount[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.google_id, u.created_at
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'owner'
     ORDER BY u.full_name ASC NULLS LAST, u.email ASC`
  );
  return rows.map(
    (r: { id: string; email: string; full_name: string | null; google_id: string | null; created_at: Date }) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      role: "owner" as const,
      authMethod: r.google_id ? ("google" as const) : ("password" as const),
      createdAt: r.created_at.toISOString(),
    })
  );
}

export async function deleteOwnerAccount(userId: string): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ur.role::text AS role
     FROM user_roles ur
     WHERE ur.user_id = $1 AND ur.role = 'owner'`,
    [userId]
  );

  if (!rows.length) {
    throw new Error("Pet owner account not found.");
  }

  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

export async function deleteStaffAccount(userId: string, requestingAdminId: string): Promise<void> {
  if (userId === requestingAdminId) {
    throw new Error("You cannot delete your own account.");
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ur.role::text AS role
     FROM user_roles ur
     WHERE ur.user_id = $1 AND ur.role IN ('admin', 'staff')`,
    [userId]
  );

  if (!rows.length) {
    throw new Error("Staff account not found.");
  }

  const role = (rows[0] as { role: string }).role;
  if (role === "admin") {
    throw new Error("Admin accounts cannot be deleted from this page.");
  }

  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}
