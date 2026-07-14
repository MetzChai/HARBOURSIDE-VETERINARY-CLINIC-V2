import type { SessionUser } from "./auth.js";
import { getPool } from "../lib/db.js";
import { todayPH, formatDatePH, daysFromTodayPH } from "../lib/datetime.js";

export type ChatContext = {
  role: "admin" | "owner";
  userName: string;
  pets: { name: string; species: string | null; breed: string | null }[];
  appointments: {
    pet_name: string | null;
    date: string;
    time: string;
    status: string;
    reason: string | null;
  }[];
  vaccinations: {
    pet_name: string;
    vaccine_type: string;
    next_due: string | null;
    date_given: string | null;
  }[];
  requestedCount?: number;
  lowStock?: { name: string; quantity: number }[];
};

export async function getChatContext(user: SessionUser): Promise<ChatContext> {
  const pool = getPool();
  const userName = user.fullName ?? user.email;
  const today = todayPH();

  if (user.role === "admin") {
    const { rows: appointments } = await pool.query(
      `SELECT a.date, a.time, a.status, a.reason, p.name AS pet_name
       FROM appointments a
       LEFT JOIN pets p ON p.id = a.pet_id
       WHERE a.date >= $1::date AND a.status NOT IN ('Cancelled')
       ORDER BY a.date, a.time
       LIMIT 15`,
      [today]
    );

    const { rows: requested } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM appointments WHERE status = 'Requested'`
    );

    const { rows: lowStock } = await pool.query(
      `SELECT name, quantity FROM inventory_items WHERE quantity <= 5 ORDER BY quantity ASC LIMIT 8`
    );

    const { rows: vaccinations } = await pool.query(
      `SELECT v.vaccine_type, v.next_due, v.date_given, p.name AS pet_name
       FROM vaccinations v
       JOIN pets p ON p.id = v.pet_id
       WHERE v.next_due IS NOT NULL AND v.next_due <= ($1::date + interval '30 days')
       ORDER BY v.next_due
       LIMIT 10`,
      [today]
    );

    return {
      role: "admin",
      userName,
      pets: [],
      appointments: appointments as ChatContext["appointments"],
      vaccinations: vaccinations as ChatContext["vaccinations"],
      requestedCount: requested[0]?.count ?? 0,
      lowStock: lowStock as ChatContext["lowStock"],
    };
  }

  const { rows: ownerRows } = await pool.query(`SELECT id FROM owners WHERE user_id = $1`, [user.id]);
  const ownerIds = ownerRows.map((r: { id: string }) => r.id);

  if (!ownerIds.length) {
    return { role: "owner", userName, pets: [], appointments: [], vaccinations: [] };
  }

  const { rows: pets } = await pool.query(
    `SELECT name, species, breed FROM pets WHERE owner_id = ANY($1::uuid[]) AND status = 'available' ORDER BY name`,
    [ownerIds]
  );

  const { rows: appointments } = await pool.query(
    `SELECT a.date, a.time, a.status, a.reason, p.name AS pet_name
     FROM appointments a
     LEFT JOIN pets p ON p.id = a.pet_id
     WHERE a.owner_id = ANY($1::uuid[]) AND a.date >= $2::date AND a.status NOT IN ('Cancelled')
     ORDER BY a.date, a.time
     LIMIT 10`,
    [ownerIds, today]
  );

  const { rows: vaccinations } = await pool.query(
    `SELECT v.vaccine_type, v.next_due, v.date_given, p.name AS pet_name
     FROM vaccinations v
     JOIN pets p ON p.id = v.pet_id
     WHERE p.owner_id = ANY($1::uuid[])
     ORDER BY v.next_due NULLS LAST
     LIMIT 10`,
    [ownerIds]
  );

  return {
    role: "owner",
    userName,
    pets: pets as ChatContext["pets"],
    appointments: appointments as ChatContext["appointments"],
    vaccinations: vaccinations as ChatContext["vaccinations"],
  };
}

export function buildContextPrompt(ctx: ChatContext): string {
  const lines: string[] = [`User: ${ctx.userName} (${ctx.role})`];

  if (ctx.pets.length) {
    lines.push(
      "Registered pets:",
      ...ctx.pets.map((p) => `- ${p.name}${p.species ? ` (${p.species}${p.breed ? `, ${p.breed}` : ""})` : ""}`)
    );
  }

  if (ctx.appointments.length) {
    lines.push(
      "Upcoming appointments:",
      ...ctx.appointments.map(
        (a) =>
          `- ${a.pet_name ?? "Pet"}: ${formatDatePH(a.date)} at ${a.time} — ${a.status}${a.reason ? ` (${a.reason})` : ""}`
      )
    );
  } else {
    lines.push("Upcoming appointments: none scheduled.");
  }

  const dueVax = ctx.vaccinations.filter((v) => v.next_due && (daysFromTodayPH(v.next_due) ?? 99) <= 30);
  if (dueVax.length) {
    lines.push(
      "Vaccinations due soon:",
      ...dueVax.map((v) => {
        const days = daysFromTodayPH(v.next_due);
        const when =
          days === 0 ? "today" : days !== null && days < 0 ? `${Math.abs(days)} day(s) overdue` : `in ${days} day(s)`;
        return `- ${v.pet_name}: ${v.vaccine_type} due ${formatDatePH(v.next_due)} (${when})`;
      })
    );
  } else if (ctx.vaccinations.length) {
    lines.push("Vaccinations: all up to date within the next 30 days.");
  }

  if (ctx.role === "admin") {
    lines.push(`Pending appointment requests: ${ctx.requestedCount ?? 0}`);
    if (ctx.lowStock?.length) {
      lines.push("Low stock:", ...ctx.lowStock.map((i) => `- ${i.name}: ${i.quantity} left`));
    }
  }

  return lines.join("\n");
}

const CLINIC_INFO = `Harbourside Veterinary Clinic
Hours: Mon–Sat 8AM–6PM (Philippine Time), closed Sunday
Vets: Dr. Rivera (general), Dr. Tan (surgery & dental)
Emergency hotline: 0917-VET-HELP
Location: Harbourside area — call for directions`;

export function generateLocalChatReply(message: string, ctx: ChatContext): string {
  const q = message.toLowerCase().trim();

  if (/hello|hi|hey|good (morning|afternoon|evening)/.test(q)) {
    return `Hello ${ctx.userName.split(" ")[0]}! 🐾 I'm PawBot. I can help with your pets' appointments, vaccinations, and general care tips. What would you like to know?`;
  }

  if (/hour|open|close|when.*open|schedule.*clinic|contact|phone|hotline|address|location/.test(q)) {
    return CLINIC_INFO;
  }

  if (/appointment|schedule|visit|booking|book|next.*(appt|visit)|when.*(see|visit)/.test(q)) {
    if (!ctx.appointments.length) {
      return ctx.role === "owner"
        ? "You don't have any upcoming appointments. You can request one from **Appointments** in your portal, or call the clinic to book a walk-in."
        : "No upcoming appointments on the schedule. Check **Schedule** to book visits.";
    }
    const list = ctx.appointments
      .slice(0, 5)
      .map(
        (a) =>
          `• **${a.pet_name ?? "Pet"}** — ${formatDatePH(a.date)} at ${a.time} (${a.status})${a.reason ? `: ${a.reason}` : ""}`
      )
      .join("\n");
    return `Here ${ctx.appointments.length === 1 ? "is your next appointment" : "are your upcoming appointments"}:\n\n${list}`;
  }

  if (/vaccin|shot|due|booster|immuniz/.test(q)) {
    const due = ctx.vaccinations.filter((v) => v.next_due && (daysFromTodayPH(v.next_due) ?? 99) <= 30);
    if (!due.length) {
      return ctx.vaccinations.length
        ? "All your pets' vaccinations look up to date for the next 30 days. ✅"
        : "I don't see vaccination records yet. Ask the clinic to update your pet's vaccine history, or check **Care History** if you're staff.";
    }
    const list = due
      .map((v) => {
        const days = daysFromTodayPH(v.next_due);
        const status = days !== null && days < 0 ? "⚠️ overdue" : days === 0 ? "📅 due today" : "📅 due soon";
        return `• **${v.pet_name}** — ${v.vaccine_type}: ${formatDatePH(v.next_due)} ${status}`;
      })
      .join("\n");
    return `Vaccination reminders:\n\n${list}\n\nVisit the clinic or request an appointment for boosters.`;
  }

  if (/groom|brush|bath|clean|hygiene/.test(q)) {
    return "Grooming tips 🛁:\n• Brush coat 2–3× weekly to reduce shedding\n• Bathe dogs every 4–6 weeks (more often can dry skin)\n• Trim nails when you hear clicking on the floor\n• Clean ears gently — ask your vet if you notice odor or redness";
  }

  if (/food|diet|feed|nutrition|eat/.test(q)) {
    return "Nutrition tips 🍽️:\n• Feed age-appropriate portions (puppy/kitten vs adult)\n• Fresh water always available\n• Avoid chocolate, grapes, onions, and cooked bones\n• Ask Dr. Rivera or Dr. Tan for a diet plan suited to your pet's breed and weight";
  }

  if (/emergency|urgent|sick|vomit|bleed|help/.test(q)) {
    return `If this is an emergency, please call the clinic hotline **0917-VET-HELP** right away or bring your pet in during clinic hours (Mon–Sat 8AM–6PM PH time).\n\n${CLINIC_INFO}`;
  }

  if (ctx.role === "admin" && /request|pending|approve/.test(q)) {
    return `There ${ctx.requestedCount === 1 ? "is" : "are"} **${ctx.requestedCount ?? 0}** pending appointment request(s). Open **Schedule** to review and approve them.`;
  }

  if (ctx.role === "admin" && /stock|inventory|low/.test(q)) {
    if (!ctx.lowStock?.length) return "Inventory levels look healthy — no critical low-stock items right now.";
    return `Low stock items:\n${ctx.lowStock.map((i) => `• ${i.name}: ${i.quantity} left`).join("\n")}\n\nCheck **Inventory** to restock.`;
  }

  if (/pet|dog|cat|who.*(my|registered)/.test(q)) {
    if (!ctx.pets.length) {
      return "I don't see registered pets on your account yet. Contact the clinic to add your pet's profile.";
    }
    return `Your registered pets:\n${ctx.pets.map((p) => `• **${p.name}**${p.species ? ` (${p.species})` : ""}`).join("\n")}`;
  }

  return `I'm PawBot, your clinic assistant! I can help with:\n• Upcoming **appointments**\n• **Vaccination** due dates\n• **Pet care** tips (grooming, nutrition)\n• **Clinic hours** and contact info\n\nTry: "When is my next appointment?" or "What vaccines are due?"\n\n${CLINIC_INFO}`;
}

const GEMINI_MODELS = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-pro"];

function buildGeminiPayload(
  messages: { role: string; content: string }[],
  contextBlock: string
) {
  const systemPrompt = `You are PawBot, the friendly AI assistant for Harbourside Veterinary Clinic in the Philippines (Asia/Manila timezone).

Use the user's live clinic data below when answering about appointments, pets, or vaccines. If data is missing, say so and suggest using the portal or calling the clinic.

${CLINIC_INFO}

--- User's current data ---
${contextBlock}
--- End data ---

Keep replies concise, warm, and practical. Use markdown sparingly (bold for pet names). If unsure, suggest calling the clinic.`;

  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  return { systemPrompt, contents };
}

/** Returns Gemini text, or null if unavailable (quota, auth, etc.). */
export async function generateGeminiReply(
  apiKey: string,
  messages: { role: string; content: string }[],
  contextBlock: string
): Promise<string | null> {
  const { systemPrompt, contents } = buildGeminiPayload(messages, contextBlock);

  for (const model of GEMINI_MODELS) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => `HTTP ${response.status}`);
      console.error(`Gemini ${model} error:`, response.status, err.slice(0, 200));
      if ([400, 404, 429, 503].includes(response.status)) continue;
      continue;
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return text;
  }

  return null;
}
