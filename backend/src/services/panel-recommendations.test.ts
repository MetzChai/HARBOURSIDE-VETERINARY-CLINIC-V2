import test from "node:test";
import assert from "node:assert/strict";
import { isValidCalendarDate, validateBirthDate, todayPH, toDateOnly } from "../lib/datetime.js";
import { validateEntityData, isNonEmptyString, isValidUUID, isValidEmail } from "./data-validation.js";
import { createSessionToken } from "./auth.js";
import { decodeJwt, jwtVerify } from "jose";

test("Calendar and Birth Date Validation", async (t) => {
  await t.test("rejects impossible dates", () => {
    assert.equal(isValidCalendarDate("2026-02-30"), false, "Feb 30 must be invalid");
    assert.equal(isValidCalendarDate("2026-02-29"), false, "Feb 29 on non-leap year must be invalid");
    assert.equal(isValidCalendarDate("2024-02-29"), true, "Feb 29 on leap year must be valid");
    assert.equal(isValidCalendarDate("2026-04-31"), false, "April 31 must be invalid");
    assert.equal(isValidCalendarDate("2026-13-01"), false, "Month 13 must be invalid");
    assert.equal(isValidCalendarDate("invalid-date"), false, "Non-date string must be invalid");
  });

  await t.test("rejects future birth dates according to Asia/Manila", () => {
    const today = todayPH();
    const [y, m, d] = today.split("-").map(Number);
    const tomorrowStr = `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const futureRes = validateBirthDate(tomorrowStr);
    assert.equal(futureRes.valid, false);
    assert.equal(futureRes.error, "Birth date cannot be in the future.");
  });

  await t.test("rejects birth dates before 1900", () => {
    const res = validateBirthDate("1850-05-10");
    assert.equal(res.valid, false);
    assert.equal(res.error, "Birth date year must be 1900 or later.");
  });

  await t.test("accepts valid past birth dates and normalizes them", () => {
    const res = validateBirthDate("2020-05-15");
    assert.equal(res.valid, true);
    assert.equal(res.normalized, "2020-05-15");
  });

  await t.test("allows empty or null birth date as optional", () => {
    const resNull = validateBirthDate(null);
    assert.equal(resNull.valid, true);
    assert.equal(resNull.normalized, null);

    const resEmpty = validateBirthDate("");
    assert.equal(resEmpty.valid, true);
    assert.equal(resEmpty.normalized, null);
  });
});

test("Required Fields and Data Validation", async (t) => {
  const mockPool = {
    query: async (sql: string, params: any[]) => {
      // Mock existing records
      if (params && params[0] === "00000000-0000-0000-0000-000000000001") {
        return { rows: [{ id: params[0], owner_id: "00000000-0000-0000-0000-000000000001" }] };
      }
      return { rows: [] };
    },
  };

  await t.test("Owner validation rejects empty or whitespace-only name", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData("owners", { name: "   " }, false, mockPool);
      },
      { message: "Owner name is required." }
    );
  });

  await t.test("Owner validation rejects invalid email format", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData("owners", { name: "Maria Santos", email: "not-an-email" }, false, mockPool);
      },
      { message: "Please enter a valid email address." }
    );
  });

  await t.test("Pet validation rejects whitespace-only name", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData(
          "pets",
          { name: "   ", owner_id: "00000000-0000-0000-0000-000000000001", species: "Dog" },
          false,
          mockPool
        );
      },
      { message: "Pet name is required." }
    );
  });

  await t.test("Pet validation rejects missing or invalid owner reference", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData("pets", { name: "Buddy", species: "Dog" }, false, mockPool);
      },
      { message: "Owner is required." }
    );

    await assert.rejects(
      async () => {
        await validateEntityData(
          "pets",
          { name: "Buddy", owner_id: "00000000-0000-0000-0000-999999999999", species: "Dog" },
          false,
          mockPool
        );
      },
      { message: "Referenced owner does not exist." }
    );
  });

  await t.test("Appointment validation rejects whitespace-only reason or invalid date", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData(
          "appointments",
          {
            pet_id: "00000000-0000-0000-0000-000000000001",
            date: "2026-02-30",
            time: "10:00",
            reason: "Checkup",
          },
          false,
          mockPool
        );
      },
      { message: "Please select a valid appointment date." }
    );

    await assert.rejects(
      async () => {
        await validateEntityData(
          "appointments",
          {
            pet_id: "00000000-0000-0000-0000-000000000001",
            date: "2026-10-25",
            time: "10:00",
            reason: "   ",
          },
          false,
          mockPool
        );
      },
      { message: "Appointment reason is required." }
    );
  });

  await t.test("Care record validation rejects future date and missing vaccine on vaccination", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData(
          "care_records",
          {
            pet_id: "00000000-0000-0000-0000-000000000001",
            date: "2030-01-01",
            record_type: "checkup",
          },
          false,
          mockPool
        );
      },
      { message: "Care record date cannot be in the future." }
    );

    await assert.rejects(
      async () => {
        await validateEntityData(
          "care_records",
          {
            pet_id: "00000000-0000-0000-0000-000000000001",
            date: todayPH(),
            record_type: "vaccination",
            vaccine_used: "   ",
          },
          false,
          mockPool
        );
      },
      { message: "Vaccine product name is required for vaccination records." }
    );
  });

  await t.test("Inventory validation rejects negative numbers and empty unit", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData(
          "inventory_items",
          {
            name: "Syringe",
            category: "supply",
            unit: "piece",
            unit_price: -50,
          },
          false,
          mockPool
        );
      },
      { message: "Unit price must be 0 or greater." }
    );

    await assert.rejects(
      async () => {
        await validateEntityData(
          "inventory_items",
          {
            name: "Syringe",
            category: "supply",
            unit: "   ",
          },
          false,
          mockPool
        );
      },
      { message: "Unit is required." }
    );
  });

  await t.test("Message validation rejects empty body", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData("messages", { body: "   " }, false, mockPool);
      },
      { message: "Message body is required." }
    );
  });

  await t.test("Message reply rejects mismatched owner_id", async () => {
    await assert.rejects(
      async () => {
        await validateEntityData(
          "messages",
          {
            body: "Reply content",
            in_reply_to_id: "00000000-0000-0000-0000-000000000001",
            owner_id: "00000000-0000-0000-0000-000000000002",
          },
          false,
          mockPool
        );
      },
      { message: "Reply recipient cannot be changed from the original message's owner." }
    );
  });
});

test("Remember Me and Session Expiration Math", async (t) => {
  if (!process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = "super_secret_test_key_for_unit_tests_that_is_at_least_32_chars_long!";
  }

  const mockUser = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@harbourside.ph",
    role: "admin" as const,
    fullName: "Admin User",
  };

  await t.test("creates 24-hour token when rememberMe is false", async () => {
    const token = await createSessionToken(mockUser, { rememberMe: false });
    const payload = decodeJwt(token);

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = Number(payload.exp);
    const diffSec = expSec - nowSec;

    // Standard 24 hours is 86,400 seconds (allowing +/- 60 seconds tolerance for test execution)
    assert.ok(diffSec > 86000 && diffSec <= 86460, `Expected ~86400s, got ${diffSec}s`);
  });

  await t.test("creates 30-day token when rememberMe is true", async () => {
    const token = await createSessionToken(mockUser, { rememberMe: true });
    const payload = decodeJwt(token);

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = Number(payload.exp);
    const diffSec = expSec - nowSec;

    // Standard 30 days is 30 * 86,400 = 2,592,000 seconds
    assert.ok(diffSec > 2590000 && diffSec <= 2592060, `Expected ~2592000s, got ${diffSec}s`);
  });
});
