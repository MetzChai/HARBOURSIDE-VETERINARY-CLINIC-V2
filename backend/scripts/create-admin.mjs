/**
 * Create admin/staff account directly in the database.
 * Usage: npm run create-admin -- email@clinic.com "Full Name" "password"
 */
import { readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { loadEnv } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv();

const [email, fullName, password] = process.argv.slice(2);
if (!email || !fullName || !password) {
  console.error("Usage: npm run create-admin -- <email> <full-name> <password>");
  process.exit(1);
}

if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const normalized = email.toLowerCase().trim();
const hash = await bcrypt.hash(password, 10);
const pool = new Pool({ connectionString: url });

try {
  const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [normalized]);
  if (existing.rows.length) {
    console.error("A user with this email already exists.");
    process.exit(1);
  }

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, email_verified) VALUES ($1, $2, $3, true) RETURNING id`,
    [normalized, hash, fullName]
  );
  const userId = rows[0].id;

  await pool.query(`INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3)`, [
    userId, fullName, normalized,
  ]);
  await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin'::app_role)`, [userId]);

  console.log("Admin account created:");
  console.log("  Email:", normalized);
  console.log("  Name:", fullName);
  console.log("  Role: admin");
  console.log("Sign in at /login with email and password.");
} finally {
  await pool.end();
}
