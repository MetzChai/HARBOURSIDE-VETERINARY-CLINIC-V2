import { Pool } from "@neondatabase/serverless";
import { loadEnv } from "./load-env.mjs";
import { bindPoolTimezone, resolveDatabaseUrl } from "./db-timezone.mjs";

loadEnv();

const REQUIRED_COLUMNS = [
  { table: "inventory_items", column: "unit_price" },
  { table: "inventory_transactions", column: "unit_price" },
  { table: "inventory_transactions", column: "total_amount" },
  { table: "inventory_transactions", column: "inventory_batch_id" },
];

async function main() {
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  bindPoolTimezone(pool);

  try {
    const { rows } = await pool.query(
      `SELECT table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'inventory_items' AND column_name = 'unit_price')
           OR (table_name = 'inventory_transactions' AND column_name IN ('unit_price', 'total_amount', 'inventory_batch_id'))
           OR (table_name = 'inventory_batches' AND column_name = 'id')
         )
       ORDER BY table_name, column_name`
    );

    console.log("Column verification:");
    for (const req of REQUIRED_COLUMNS) {
      const found = rows.find((r) => r.table_name === req.table && r.column_name === req.column);
      if (found) {
        console.log(
          `  OK  ${req.table}.${req.column} (${found.data_type}${found.numeric_precision ? `(${found.numeric_precision},${found.numeric_scale})` : ""}, nullable=${found.is_nullable})`
        );
      } else {
        console.log(`  MISSING  ${req.table}.${req.column}`);
      }
    }

    const { rows: batchCheck } = await pool.query(`SELECT to_regclass('public.inventory_batches') AS exists`);
    console.log(`\ninventory_batches table: ${batchCheck[0]?.exists ? "exists" : "MISSING"}`);

    const missing = REQUIRED_COLUMNS.filter(
      (req) => !rows.find((r) => r.table_name === req.table && r.column_name === req.column)
    );
    if (missing.length || !batchCheck[0]?.exists) {
      process.exit(1);
    }

    console.log("\nAll required inventory pricing columns verified.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
