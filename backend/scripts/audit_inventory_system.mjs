import { loadEnv } from './load-env.mjs';
loadEnv();
import { Pool } from '@neondatabase/serverless';
const PH_TIMEZONE = "Asia/Manila";
function toDateOnly(value) {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: PH_TIMEZONE }).format(value);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: PH_TIMEZONE }).format(parsed);
  }
  return raw.slice(0, 10);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("=== FULL SYSTEM-WIDE INVENTORY AUDIT ===");

  const { rows: items } = await pool.query(`
    SELECT * FROM inventory_items ORDER BY name ASC
  `);
  const { rows: batches } = await pool.query(`
    SELECT * FROM inventory_batches ORDER BY created_at ASC
  `);
  const { rows: txns } = await pool.query(`
    SELECT * FROM inventory_transactions ORDER BY date DESC, created_at DESC
  `);
  const { rows: careRecords } = await pool.query(`
    SELECT * FROM care_records ORDER BY date DESC, created_at DESC
  `);

  console.log(`Loaded: ${items.length} items, ${batches.length} batches, ${txns.length} transactions, ${careRecords.length} care records.`);

  // Maps
  const itemsMap = new Map(items.map(i => [i.id, i]));
  const batchesMap = new Map(batches.map(b => [b.id, b]));
  const batchesByItem = new Map();
  for (const b of batches) {
    if (!batchesByItem.has(b.inventory_item_id)) {
      batchesByItem.set(b.inventory_item_id, []);
    }
    batchesByItem.get(b.inventory_item_id).push(b);
  }

  const txnsByBatch = new Map();
  const txnsByItem = new Map();
  for (const t of txns) {
    if (t.inventory_batch_id) {
      if (!txnsByBatch.has(t.inventory_batch_id)) txnsByBatch.set(t.inventory_batch_id, []);
      txnsByBatch.get(t.inventory_batch_id).push(t);
    }
    if (t.item_id) {
      if (!txnsByItem.has(t.item_id)) txnsByItem.set(t.item_id, []);
      txnsByItem.get(t.item_id).push(t);
    }
  }

  // 1. Batches with NO Stock In movement
  const batchesMissingStockIn = [];
  // 2. Batches whose initial / remaining quantity does not reconcile with recorded movements
  const batchQuantityReconciliationIssues = [];
  // 3. Deductions dated before the batch's stock-in or availability date
  const deductionsBeforeAvailability = [];
  // 4. Date Received and Stock In date mismatches
  const dateReceivedVsStockInMismatches = [];
  // 5. Duplicate movements or deductions
  const duplicateMovements = [];
  // 6. Transactions with missing batch references or invalid relationships
  const transactionsMissingBatch = [];
  // 7. Items whose displayed quantity does not match total remaining quantities across batches
  const itemVsBatchQuantityMismatches = [];
  // 8. Historical stock records initialized/migrated without complete audit trail
  const unrecordedAuditBatches = [];

  // Check 7: Item quantity vs Batches sum
  for (const item of items) {
    const itemBatches = batchesByItem.get(item.id) || [];
    const batchRemainingSum = itemBatches.reduce((sum, b) => sum + Number(b.remaining_quantity || 0), 0);
    const itemQty = Number(item.quantity || 0);
    if (itemQty !== batchRemainingSum) {
      itemVsBatchQuantityMismatches.push({
        itemId: item.id,
        itemName: item.name,
        itemQty,
        batchRemainingSum,
        batchCount: itemBatches.length,
      });
    }
  }

  // Check 1, 2, 3, 4, 8: Per Batch Analysis
  for (const b of batches) {
    const item = itemsMap.get(b.inventory_item_id);
    const bTxns = txnsByBatch.get(b.id) || [];
    const inTxns = bTxns.filter(t => t.type === 'in');
    const outTxns = bTxns.filter(t => t.type === 'out');

    const totalInQty = inTxns.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
    const totalOutQty = outTxns.reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    const initialQty = Number(b.initial_quantity || 0);
    const remainingQty = Number(b.remaining_quantity || 0);
    const receivedDate = toDateOnly(b.received_date);

    // 1. No stock-in
    if (inTxns.length === 0) {
      batchesMissingStockIn.push({
        batchId: b.id,
        batchNo: b.batch_no,
        itemId: b.inventory_item_id,
        itemName: item?.name || "Unknown",
        initialQty,
        remainingQty,
        receivedDate,
        createdAt: b.created_at,
        outTxnCount: outTxns.length,
      });
    }

    // 4. Date Received vs Stock-In movement date
    if (inTxns.length > 0) {
      for (const inTxn of inTxns) {
        const inDate = toDateOnly(inTxn.date);
        if (receivedDate && inDate && receivedDate !== inDate) {
          dateReceivedVsStockInMismatches.push({
            batchId: b.id,
            batchNo: b.batch_no,
            itemName: item?.name || "Unknown",
            receivedDate,
            inTxnDate: inDate,
            txnNo: inTxn.transaction_no,
            txnId: inTxn.id,
          });
        }
      }
    }

    // 2. Quantity reconciliation:
    // If inTxns exist: does initialQty == totalInQty? Does remainingQty == totalInQty - totalOutQty?
    if (inTxns.length > 0) {
      const expectedRemaining = totalInQty - totalOutQty;
      if (initialQty !== totalInQty || remainingQty !== expectedRemaining) {
        batchQuantityReconciliationIssues.push({
          batchId: b.id,
          batchNo: b.batch_no,
          itemName: item?.name || "Unknown",
          initialQty,
          totalInQty,
          remainingQty,
          expectedRemaining,
          totalOutQty,
        });
      }
    } else {
      // If no inTxns, but initialQty != remainingQty + totalOutQty
      if (initialQty - totalOutQty !== remainingQty) {
        batchQuantityReconciliationIssues.push({
          batchId: b.id,
          batchNo: b.batch_no,
          itemName: item?.name || "Unknown",
          initialQty,
          totalInQty: 0,
          remainingQty,
          expectedRemaining: initialQty - totalOutQty,
          totalOutQty,
        });
      }
    }

    // 3. Deductions before availability / stock-in date
    const earliestInDate = inTxns.length > 0 
      ? inTxns.map(t => toDateOnly(t.date)).sort()[0] 
      : receivedDate || toDateOnly(b.created_at);

    for (const outTxn of outTxns) {
      const outDate = toDateOnly(outTxn.date);
      if (earliestInDate && outDate && outDate < earliestInDate) {
        deductionsBeforeAvailability.push({
          batchId: b.id,
          batchNo: b.batch_no,
          itemName: item?.name || "Unknown",
          earliestInDate,
          outDate,
          txnNo: outTxn.transaction_no,
          reason: outTxn.reason,
          outQty: outTxn.quantity,
          txnId: outTxn.id,
        });
      }
    }
  }

  // Check 5: Duplicate movements or deductions
  const seenTxns = new Map();
  for (const t of txns) {
    // Key by item, batch, type, quantity, date, transaction_no
    const key = `${t.item_id}|${t.inventory_batch_id}|${t.type}|${t.quantity}|${toDateOnly(t.date)}|${t.transaction_no}`;
    if (seenTxns.has(key)) {
      duplicateMovements.push({
        txnId: t.id,
        duplicateOf: seenTxns.get(key).id,
        txnNo: t.transaction_no,
        type: t.type,
        qty: t.quantity,
        date: toDateOnly(t.date),
        notes: t.notes,
      });
    } else {
      seenTxns.set(key, t);
    }
  }

  // Also check for multiple deductions for the SAME care record
  const careDeductions = new Map();
  for (const t of txns) {
    if (t.transaction_no?.startsWith("CARE-")) {
      const prefix = t.transaction_no;
      if (!careDeductions.has(prefix)) careDeductions.set(prefix, []);
      careDeductions.get(prefix).push(t);
    }
  }
  for (const [prefix, list] of careDeductions.entries()) {
    if (list.length > 1) {
      console.log(`Care deduction multi-entry for ${prefix}: ${list.length} transactions`);
    }
  }

  // Check 6: Transactions with missing batch references
  for (const t of txns) {
    if (!t.inventory_batch_id) {
      transactionsMissingBatch.push({
        txnId: t.id,
        txnNo: t.transaction_no,
        itemId: t.item_id,
        itemName: itemsMap.get(t.item_id)?.name || "Unknown",
        type: t.type,
        qty: t.quantity,
        date: toDateOnly(t.date),
        reason: t.reason,
        notes: t.notes,
      });
    } else if (!batchesMap.has(t.inventory_batch_id)) {
      transactionsMissingBatch.push({
        txnId: t.id,
        txnNo: t.transaction_no,
        type: t.type,
        qty: t.quantity,
        reason: "Invalid batch ID (batch does not exist)",
      });
    }
  }

  console.log("\n=================== AUDIT RESULTS ===================");
  console.log(`1. Batches missing Stock In movement: ${batchesMissingStockIn.length}`);
  console.log(`2. Batches with quantity reconciliation issues: ${batchQuantityReconciliationIssues.length}`);
  console.log(`3. Deductions dated before batch stock-in / availability: ${deductionsBeforeAvailability.length}`);
  console.log(`4. Date Received vs Stock In date mismatches: ${dateReceivedVsStockInMismatches.length}`);
  console.log(`5. Duplicate movements: ${duplicateMovements.length}`);
  console.log(`6. Transactions with missing or invalid batch ID: ${transactionsMissingBatch.length}`);
  console.log(`7. Items where quantity != sum(batches.remaining_quantity): ${itemVsBatchQuantityMismatches.length}`);

  console.log("\n--- DETAIL: Batches Missing Stock In Movement ---");
  console.log(JSON.stringify(batchesMissingStockIn, null, 2));

  console.log("\n--- DETAIL: Date Received vs Stock In Mismatches ---");
  console.log(JSON.stringify(dateReceivedVsStockInMismatches, null, 2));

  console.log("\n--- DETAIL: Deductions Before Availability ---");
  console.log(JSON.stringify(deductionsBeforeAvailability, null, 2));

  console.log("\n--- DETAIL: Quantity Reconciliation Issues ---");
  console.log(JSON.stringify(batchQuantityReconciliationIssues, null, 2));

  console.log("\n--- DETAIL: Transactions Missing Batch ---");
  console.log(JSON.stringify(transactionsMissingBatch, null, 2));

  console.log("\n--- DETAIL: Item vs Batch Quantity Mismatches ---");
  console.log(JSON.stringify(itemVsBatchQuantityMismatches, null, 2));
}

main().catch(console.error).finally(() => pool.end());
