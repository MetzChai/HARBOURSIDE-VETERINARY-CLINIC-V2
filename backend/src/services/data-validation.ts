import { isValidCalendarDate, validateBirthDate, todayPH, toDateOnly } from "../lib/datetime.js";

// Helper: check if value is present and not whitespace-only
export function isProvided(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  return true;
}

export function isNonEmptyString(val: unknown): boolean {
  return typeof val === "string" && val.trim().length > 0;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(val: unknown): boolean {
  return typeof val === "string" && UUID_REGEX.test(val.trim());
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(val: string): boolean {
  return EMAIL_REGEX.test(val.trim());
}

async function assertRecordExists(
  clientOrPool: any,
  table: string,
  id: string,
  entityLabel: string
): Promise<void> {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid ${entityLabel} ID format.`);
  }
  const { rows } = await clientOrPool.query(`SELECT id FROM ${table} WHERE id = $1`, [id]);
  if (!rows || rows.length === 0) {
    throw new Error(`Referenced ${entityLabel} does not exist.`);
  }
}

/**
 * Validates entity fields before insert or update.
 * Throws an Error with a user-friendly, field-specific message on failure.
 */
export async function validateEntityData(
  table: string,
  data: Record<string, unknown>,
  isUpdate: boolean,
  clientOrPool: any
): Promise<void> {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid payload: data object is required.");
  }

  // 1. OWNERS
  if (table === "owners") {
    if (!isUpdate) {
      const hasName = isNonEmptyString(data.name);
      const hasFirstLast = isNonEmptyString(data.first_name) && isNonEmptyString(data.last_name);
      if (!hasName && !hasFirstLast) {
        throw new Error("Owner name is required.");
      }
    } else {
      if ("name" in data && !isNonEmptyString(data.name)) {
        throw new Error("Owner name cannot be empty.");
      }
      if ("first_name" in data && !isNonEmptyString(data.first_name)) {
        throw new Error("First name cannot be empty.");
      }
      if ("last_name" in data && !isNonEmptyString(data.last_name)) {
        throw new Error("Last name cannot be empty.");
      }
    }

    if (data.birth_date !== undefined && data.birth_date !== null && data.birth_date !== "") {
      const { valid, error } = validateBirthDate(data.birth_date);
      if (!valid) throw new Error(error || "Please enter a valid birth date.");
    }

    if (data.email !== undefined && data.email !== null && data.email !== "") {
      const emailStr = String(data.email).trim();
      if (!isValidEmail(emailStr)) {
        throw new Error("Please enter a valid email address.");
      }
    }

    if (data.contact !== undefined && data.contact !== null && data.contact !== "") {
      if (typeof data.contact === "string" && !data.contact.trim()) {
        throw new Error("Contact number cannot be whitespace only.");
      }
    }

    if (data.account_status !== undefined && data.account_status !== null) {
      const st = String(data.account_status);
      if (!["Active", "Deactivated"].includes(st)) {
        throw new Error("Account status must be Active or Deactivated.");
      }
    }
  }

  // 2. PETS
  if (table === "pets") {
    if (!isUpdate) {
      if (!isNonEmptyString(data.name)) {
        throw new Error("Pet name is required.");
      }
      if (!data.owner_id || !isNonEmptyString(data.owner_id)) {
        throw new Error("Owner is required.");
      }
      await assertRecordExists(clientOrPool, "owners", String(data.owner_id), "owner");

      if (!isNonEmptyString(data.species)) {
        throw new Error("Pet species is required.");
      }
    } else {
      if ("name" in data && !isNonEmptyString(data.name)) {
        throw new Error("Pet name cannot be empty.");
      }
      if ("species" in data && !isNonEmptyString(data.species)) {
        throw new Error("Pet species cannot be empty.");
      }
      if ("owner_id" in data && data.owner_id) {
        await assertRecordExists(clientOrPool, "owners", String(data.owner_id), "owner");
      }
    }

    if (data.dob !== undefined && data.dob !== null && data.dob !== "") {
      const { valid, error } = validateBirthDate(data.dob);
      if (!valid) throw new Error(error || "Please enter a valid birth date.");
    }

    if (data.status === "deceased") {
      if (data.deceased_date !== undefined && data.deceased_date !== null && data.deceased_date !== "") {
        const dStr = toDateOnly(data.deceased_date);
        if (!isValidCalendarDate(dStr)) {
          throw new Error("Please enter a valid deceased date.");
        }
        if (dStr > todayPH()) {
          throw new Error("Deceased date cannot be in the future.");
        }
        if (data.dob && toDateOnly(data.dob) > dStr) {
          throw new Error("Deceased date cannot be earlier than birth date.");
        }
      }
      if ("cause_of_death" in data && !isNonEmptyString(data.cause_of_death)) {
        throw new Error("Cause of death is required when pet is deceased.");
      }
    }
  }

  // 3. APPOINTMENTS
  if (table === "appointments") {
    if (!isUpdate) {
      if (!data.pet_id || !isNonEmptyString(data.pet_id)) {
        throw new Error("Pet is required.");
      }
      await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");

      if (data.owner_id && isNonEmptyString(data.owner_id)) {
        await assertRecordExists(clientOrPool, "owners", String(data.owner_id), "owner");
      }

      if (!data.date || !isNonEmptyString(data.date)) {
        throw new Error("Please select a valid appointment date.");
      }
      const dStr = toDateOnly(data.date);
      if (!isValidCalendarDate(dStr)) {
        throw new Error("Please select a valid appointment date.");
      }

      if (!isNonEmptyString(data.time)) {
        throw new Error("Appointment time is required.");
      }

      if (!isNonEmptyString(data.reason)) {
        throw new Error("Appointment reason is required.");
      }
    } else {
      if ("pet_id" in data && data.pet_id) {
        await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");
      }
      if ("owner_id" in data && data.owner_id) {
        await assertRecordExists(clientOrPool, "owners", String(data.owner_id), "owner");
      }
      if ("date" in data && data.date) {
        const dStr = toDateOnly(data.date);
        if (!isValidCalendarDate(dStr)) {
          throw new Error("Please select a valid appointment date.");
        }
      }
      if ("time" in data && !isNonEmptyString(data.time)) {
        throw new Error("Appointment time cannot be empty.");
      }
      if ("reason" in data && !isNonEmptyString(data.reason)) {
        throw new Error("Appointment reason cannot be empty.");
      }
    }
  }

  // 4. CARE_RECORDS
  if (table === "care_records") {
    if (!isUpdate) {
      if (!data.pet_id || !isNonEmptyString(data.pet_id)) {
        throw new Error("Pet is required.");
      }
      await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");

      if (!data.date) {
        throw new Error("Care record date is required.");
      }
      const dStr = toDateOnly(data.date);
      if (!isValidCalendarDate(dStr)) {
        throw new Error("Please enter a valid care record date.");
      }
      if (dStr > todayPH()) {
        throw new Error("Care record date cannot be in the future.");
      }

      const recType = String(data.record_type || data.recordType || "checkup");
      if (recType === "vaccination" && !isNonEmptyString(data.vaccine_used)) {
        throw new Error("Vaccine product name is required for vaccination records.");
      }
      if (recType === "deworming" && !isNonEmptyString(data.dewormer_used)) {
        throw new Error("Dewormer product name is required for deworming records.");
      }
    } else {
      if ("pet_id" in data && data.pet_id) {
        await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");
      }
      if ("date" in data && data.date) {
        const dStr = toDateOnly(data.date);
        if (!isValidCalendarDate(dStr)) {
          throw new Error("Please enter a valid care record date.");
        }
        if (dStr > todayPH()) {
          throw new Error("Care record date cannot be in the future.");
        }
      }
      if ("vaccine_used" in data && data.record_type === "vaccination" && !isNonEmptyString(data.vaccine_used)) {
        throw new Error("Vaccine product name is required.");
      }
      if ("dewormer_used" in data && data.record_type === "deworming" && !isNonEmptyString(data.dewormer_used)) {
        throw new Error("Dewormer product name is required.");
      }
    }
  }

  // 5. VACCINATIONS
  if (table === "vaccinations") {
    if (!isUpdate) {
      if (!data.pet_id || !isNonEmptyString(data.pet_id)) {
        throw new Error("Pet is required.");
      }
      await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");

      if (!isNonEmptyString(data.vaccine_type)) {
        throw new Error("Vaccine type is required.");
      }
    } else {
      if ("pet_id" in data && data.pet_id) {
        await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");
      }
      if ("vaccine_type" in data && !isNonEmptyString(data.vaccine_type)) {
        throw new Error("Vaccine type cannot be empty.");
      }
    }

    if (data.date_given !== undefined && data.date_given !== null && data.date_given !== "") {
      const dStr = toDateOnly(data.date_given);
      if (!isValidCalendarDate(dStr)) {
        throw new Error("Please enter a valid vaccination date.");
      }
      if (dStr > todayPH()) {
        throw new Error("Vaccination date cannot be in the future.");
      }
    }

    if (data.next_due !== undefined && data.next_due !== null && data.next_due !== "") {
      const nStr = toDateOnly(data.next_due);
      if (!isValidCalendarDate(nStr)) {
        throw new Error("Please enter a valid next due date.");
      }
    }
  }

  // 6. DEWORMINGS
  if (table === "dewormings") {
    if (!isUpdate) {
      if (!data.pet_id || !isNonEmptyString(data.pet_id)) {
        throw new Error("Pet is required.");
      }
      await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");

      if (!isNonEmptyString(data.product)) {
        throw new Error("Deworming product is required.");
      }
    } else {
      if ("pet_id" in data && data.pet_id) {
        await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");
      }
      if ("product" in data && !isNonEmptyString(data.product)) {
        throw new Error("Deworming product cannot be empty.");
      }
    }

    if (data.date_given !== undefined && data.date_given !== null && data.date_given !== "") {
      const dStr = toDateOnly(data.date_given);
      if (!isValidCalendarDate(dStr)) {
        throw new Error("Please enter a valid deworming date.");
      }
      if (dStr > todayPH()) {
        throw new Error("Deworming date cannot be in the future.");
      }
    }

    if (data.next_due !== undefined && data.next_due !== null && data.next_due !== "") {
      const nStr = toDateOnly(data.next_due);
      if (!isValidCalendarDate(nStr)) {
        throw new Error("Please enter a valid next due date.");
      }
    }
  }

  // 7. INVENTORY_ITEMS
  if (table === "inventory_items") {
    if (!isUpdate) {
      if (!isNonEmptyString(data.name)) {
        throw new Error("Item name is required.");
      }
      if (!isNonEmptyString(data.category)) {
        throw new Error("Category is required.");
      }
      if (!isNonEmptyString(data.unit)) {
        throw new Error("Unit is required.");
      }
    } else {
      if ("name" in data && !isNonEmptyString(data.name)) {
        throw new Error("Item name cannot be empty.");
      }
      if ("category" in data && !isNonEmptyString(data.category)) {
        throw new Error("Category cannot be empty.");
      }
      if ("unit" in data && !isNonEmptyString(data.unit)) {
        throw new Error("Unit cannot be empty.");
      }
    }

    if (data.unit_price !== undefined && data.unit_price !== null) {
      const p = Number(data.unit_price);
      if (isNaN(p) || p < 0) {
        throw new Error("Unit price must be 0 or greater.");
      }
    }

    if (data.reorder_level !== undefined && data.reorder_level !== null) {
      const r = Number(data.reorder_level);
      if (isNaN(r) || r < 0) {
        throw new Error("Reorder level must be 0 or greater.");
      }
    }

    if (data.expiration_date !== undefined && data.expiration_date !== null && data.expiration_date !== "") {
      const dStr = toDateOnly(data.expiration_date);
      if (!isValidCalendarDate(dStr)) {
        throw new Error("Please enter a valid expiration date.");
      }
    }
  }

  // 8. INVENTORY_BATCHES
  if (table === "inventory_batches") {
    if (!isUpdate) {
      const itemId = data.inventory_item_id ?? data.inventoryItemId;
      if (!itemId || !isNonEmptyString(itemId)) {
        throw new Error("Inventory item is required.");
      }
      await assertRecordExists(clientOrPool, "inventory_items", String(itemId), "inventory item");

      if (!isNonEmptyString(data.batch_no ?? data.batchNo)) {
        throw new Error("Batch number is required.");
      }
    }

    const initQty = data.initial_quantity ?? data.initialQuantity ?? data.quantity;
    if (initQty !== undefined && initQty !== null) {
      const q = Number(initQty);
      if (isNaN(q) || q < 0) {
        throw new Error("Batch quantity must be 0 or greater.");
      }
    }

    const remQty = data.remaining_quantity ?? data.remainingQuantity;
    if (remQty !== undefined && remQty !== null) {
      const q = Number(remQty);
      if (isNaN(q) || q < 0) {
        throw new Error("Remaining quantity must be 0 or greater.");
      }
    }

    const expDate = data.expiration_date ?? data.expirationDate;
    if (expDate !== undefined && expDate !== null && expDate !== "") {
      const dStr = toDateOnly(expDate);
      if (!isValidCalendarDate(dStr)) {
        throw new Error("Please enter a valid expiration date.");
      }
    }
  }

  // 9. INVENTORY_TRANSACTIONS
  if (table === "inventory_transactions") {
    if (!isUpdate) {
      const itemId = data.item_id ?? data.itemId;
      if (!itemId || !isNonEmptyString(itemId)) {
        throw new Error("Inventory item is required.");
      }
      await assertRecordExists(clientOrPool, "inventory_items", String(itemId), "inventory item");

      const txnType = String(data.type ?? "");
      if (!["in", "out"].includes(txnType)) {
        throw new Error("Transaction type must be 'in' or 'out'.");
      }

      const qty = Number(data.quantity ?? 0);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Transaction quantity must be greater than 0.");
      }
    }
  }

  // 10. LAB_TRANSACTIONS
  if (table === "lab_transactions") {
    if (!isUpdate) {
      if (data.pet_id && isNonEmptyString(data.pet_id)) {
        await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");
      }
      if (data.owner_id && isNonEmptyString(data.owner_id)) {
        await assertRecordExists(clientOrPool, "owners", String(data.owner_id), "owner");
      }
    }
    if (data.subtotal !== undefined && data.subtotal !== null) {
      const s = Number(data.subtotal);
      if (isNaN(s) || s < 0) throw new Error("Subtotal must be 0 or greater.");
    }
    if (data.total_amount !== undefined && data.total_amount !== null) {
      const t = Number(data.total_amount);
      if (isNaN(t) || t < 0) throw new Error("Total amount must be 0 or greater.");
    }
  }

  // 11. LAB_TRANSACTION_ITEMS
  if (table === "lab_transaction_items") {
    if (!isUpdate) {
      const txnId = data.transaction_id ?? data.transactionId;
      if (!txnId || !isNonEmptyString(txnId)) {
        throw new Error("Lab transaction is required.");
      }
      await assertRecordExists(clientOrPool, "lab_transactions", String(txnId), "lab transaction");

      if (!isNonEmptyString(data.description)) {
        throw new Error("Item description is required.");
      }

      const q = Number(data.quantity ?? 1);
      if (isNaN(q) || q <= 0) {
        throw new Error("Item quantity must be greater than 0.");
      }
    }
  }

  // 12. CARE_ATTACHMENTS
  if (table === "care_attachments") {
    if (!isUpdate) {
      if (!data.pet_id || !isNonEmptyString(data.pet_id)) {
        throw new Error("Pet is required.");
      }
      await assertRecordExists(clientOrPool, "pets", String(data.pet_id), "pet");

      if (!isNonEmptyString(data.file_url)) {
        throw new Error("File URL is required.");
      }
      if (!isNonEmptyString(data.file_name)) {
        throw new Error("File name is required.");
      }
      if (!isNonEmptyString(data.file_type)) {
        throw new Error("File type is required.");
      }
    }
  }

  // 13. MESSAGES
  if (table === "messages") {
    if (!isUpdate) {
      if (!isNonEmptyString(data.body)) {
        throw new Error("Message body is required.");
      }
      const replyId = data.in_reply_to_id ?? data.referenced_message_id;
      if (replyId && isNonEmptyString(replyId)) {
        await assertRecordExists(clientOrPool, "messages", String(replyId), "original message");
        const { rows } = await clientOrPool.query(
          `SELECT owner_id FROM messages WHERE id = $1`,
          [String(replyId)]
        );
        if (rows.length > 0 && rows[0].owner_id) {
          if (data.owner_id && String(data.owner_id) !== String(rows[0].owner_id)) {
            throw new Error("Reply recipient cannot be changed from the original message's owner.");
          }
        }
      }
    }
  }
}
