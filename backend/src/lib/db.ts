import { Pool } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";

export const TABLES = [
  "profiles",
  "user_roles",
  "owners",
  "pets",
  "appointments",
  "vaccinations",
  "dewormings",
  "care_records",
  "inventory_items",
  "inventory_transactions",
  "lab_transactions",
  "lab_transaction_items",
  "messages",
] as const;

export type TableName = (typeof TABLES)[number];

export function isTableName(value: string): value is TableName {
  return (TABLES as readonly string[]).includes(value);
}

const JOIN_MAP: Record<string, { table: string; fk: string; alias: string }> = {
  pets: { table: "pets", fk: "pet_id", alias: "pets" },
  owners: { table: "owners", fk: "owner_id", alias: "owners" },
};

export function parseSelect(select: string) {
  const joins: { table: string; fk: string; alias: string; columns: string }[] = [];
  let baseColumns = select.trim();

  const embedRegex = /,?\s*(\w+)\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = embedRegex.exec(select)) !== null) {
    const [, alias, cols] = match;
    const join = JOIN_MAP[alias];
    if (join) {
      joins.push({ ...join, alias, columns: cols.trim() });
    }
    baseColumns = baseColumns.replace(match[0], "").replace(/^,\s*/, "").trim();
  }

  if (!baseColumns || baseColumns === "") baseColumns = "*";
  return { baseColumns, joins };
}

export function quoteIdent(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return name;
}

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

let pool: Pool | null = null;

/** Native pg pool for raw SQL (correct UUID/param handling). Prisma used for schema client. */
export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: url });
  }
  return pool;
}
