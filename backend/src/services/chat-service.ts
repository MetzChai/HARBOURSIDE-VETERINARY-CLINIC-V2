import type { SessionUser } from "./auth.js";
import { isClinicUser } from "./auth.js";
import { getPool } from "../lib/db.js";
import { todayPH, formatDatePH, daysFromTodayPH } from "../lib/datetime.js";
import { retrieveKnowledge, type KnowledgeEntry } from "./knowledge-service.js";

export type SupportedLanguage = "auto" | "en" | "tl" | "ceb";

export function detectLanguage(text: string): "en" | "tl" | "ceb" {
  const q = text.toLowerCase();
  
  // Cebuano / Bisaya keywords
  if (/\b(asa|dapit|inyong|unsa|kanus-a|pila|pwede|nahimutang|bisan|giunsa|bayad|iro|iring|suka|nagsuka|sa|ang|mga)\b/i.test(q)) {
    if (/\b(asa|dapit|unsa|kanus-a|pila|nahimutang|inyong|giunsa|nagsuka|iro|iring)\b/i.test(q)) {
      return "ceb";
    }
  }

  // Tagalog / Filipino keywords
  if (/\b(saan|po|ano|kailan|magkano|paano|nasaan|matatagpuan|ninyo|nagsusuka|bakuna|presyo|alaga|aso|pusa)\b/i.test(q)) {
    if (/\b(saan|po|ano|kailan|magkano|paano|nasaan|matatagpuan|ninyo|nagsusuka)\b/i.test(q)) {
      return "tl";
    }
  }

  return "en";
}

function getLanguageInstruction(lang: "en" | "tl" | "ceb"): string {
  if (lang === "ceb") {
    return `CRITICAL LANGUAGE INSTRUCTION:
- The user is speaking Cebuano / Bisaya. Respond completely in natural Cebuano / Bisaya.
- Do NOT translate proper names, clinic names ("Harbourside Veterinary Services"), addresses ("Unit 7 G/F Villa Teresa Subdivision, Gabi, Cordova, Cebu"), phone numbers ("09212296819" / "09364158860"), email addresses ("harvetservices@gmail.com"), or veterinarian names ("Dr. Alfredo B. Badiola Jr.") incorrectly.`;
  }
  if (lang === "tl") {
    return `CRITICAL LANGUAGE INSTRUCTION:
- The user is speaking Tagalog / Filipino. Respond completely in polite Tagalog / Filipino (using 'po'/'opo' where appropriate).
- Do NOT translate proper names, clinic names ("Harbourside Veterinary Services"), addresses ("Unit 7 G/F Villa Teresa Subdivision, Gabi, Cordova, Cebu"), phone numbers ("09212296819" / "09364158860"), email addresses ("harvetservices@gmail.com"), or veterinarian names ("Dr. Alfredo B. Badiola Jr.") incorrectly.`;
  }
  return `CRITICAL LANGUAGE INSTRUCTION: Respond in clear, warm, and professional English.`;
}

export type ChatContext = {
  role: "admin" | "staff" | "owner";
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

  if (isClinicUser(user.role)) {
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
      role: user.role === "staff" ? "staff" : "admin",
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

  if (isClinicUser(ctx.role)) {
    lines.push(`Pending appointment requests: ${ctx.requestedCount ?? 0}`);
    if (ctx.lowStock?.length) {
      lines.push("Low stock:", ...ctx.lowStock.map((i) => `- ${i.name}: ${i.quantity} left`));
    }
  }

  return lines.join("\n");
}

export function generateLocalChatReply(
  message: string,
  ctx: ChatContext,
  langPref: SupportedLanguage = "auto",
  retrievedKnowledge: KnowledgeEntry[] = []
): string {
  const q = message.toLowerCase().trim();
  const targetLang = langPref !== "auto" ? langPref : detectLanguage(message);

  // Price queries anti-hallucination check
  if (/(price|cost|fee|how much|bayad|presyo|magkano|pila)/.test(q)) {
    if (targetLang === "ceb") {
      return "Ang eksaktong presyo magdepende sa timbang ug kondisyon sa imong pet. Dili pa available sa online ang presyo. Palihug kontaka ang Harbourside Veterinary Services sa 09212296819 o 09364158860, o email sa harvetservices@gmail.com.";
    }
    if (targetLang === "tl") {
      return "Ang eksaktong presyo ay nakadepende sa timbang at kalagayan ng inyong alaga. Hindi po available online ang eksaktong presyo. Mangyaring makipag-ugnayan sa Harbourside Veterinary Services sa 09212296819 o 09364158860, o mag-email sa harvetservices@gmail.com.";
    }
    return "Specific pricing depends on your pet's size, weight, and condition. Exact prices are not currently available online. Please contact Harbourside Veterinary Services at 09212296819 or 09364158860, or email harvetservices@gmail.com for current pricing.";
  }

  // Name of clinic query
  if (/(what.*(name.*clinic|clinic.*name)|name.*of.*clinic|what.*clinic|unsa.*ngalan|ano.*pangalan)/.test(q)) {
    if (targetLang === "ceb") return "Ang ngalan sa clinic kay Harbourside Veterinary Services.";
    if (targetLang === "tl") return "Ang pangalan ng clinic ay Harbourside Veterinary Services.";
    return "The clinic is Harbourside Veterinary Services.";
  }

  // System query
  if (/(what.*system|system.*is.*this|what.*app|what.*application|unsa.*sistema|ano.*sistema)/.test(q)) {
    if (targetLang === "ceb") return "Kini ang Harbourside Veterinary Clinic Pet Care Management System with AI Chatbot Integration.";
    if (targetLang === "tl") return "Ito ang Harbourside Veterinary Clinic Pet Care Management System with AI Chatbot Integration.";
    return "This is the Harbourside Veterinary Clinic Pet Care Management System with AI Chatbot Integration.";
  }

  // Location queries
  if (/(where.*(clinic|located)|location|address|where.*find|asa.*dapit|asa.*clinic|saan.*located|saan.*clinic)/.test(q)) {
    if (targetLang === "ceb") return "Ang Harbourside Veterinary Services nahimutang sa Unit 7 G/F Villa Teresa Subdivision, Gabi, Cordova, Cebu.";
    if (targetLang === "tl") return "Ang Harbourside Veterinary Services ay matatagpuan sa Unit 7 G/F Villa Teresa Subdivision, Gabi, Cordova, Cebu.";
    return "Harbourside Veterinary Services is located at Unit 7 G/F Villa Teresa Subdivision, Gabi, Cordova, Cebu.";
  }

  // Email queries
  if (/(what.*email|email.*address|clinic.*email|your.*email)/.test(q)) {
    if (targetLang === "ceb") return "Mahimo nimong kontakon ang Harbourside Veterinary Services pinaagi sa harvetservices@gmail.com.";
    if (targetLang === "tl") return "Maaari nyo pong ma-contact ang Harbourside Veterinary Services sa harvetservices@gmail.com.";
    return "You can contact Harbourside Veterinary Services through harvetservices@gmail.com.";
  }

  // Phone queries
  if (/(what.*phone|phone.*number|contact.*number|cell.*number|mobile|telephone|call)/.test(q)) {
    if (targetLang === "ceb") return "Mahimo nimong kontakon ang Harbourside Veterinary Services sa 09212296819 o 09364158860.";
    if (targetLang === "tl") return "Maaari nyo pong ma-contact ang Harbourside Veterinary Services sa 09212296819 o 09364158860.";
    return "You can contact Harbourside Veterinary Services at 09212296819 or 09364158860.";
  }

  // How to contact queries
  if (/(how.*contact|contact.*clinic|reach.*clinic|contact.*info|contact.*detail)/.test(q)) {
    if (targetLang === "ceb") return "Mahimo nimong kontakon ang Harbourside Veterinary Services pinaagi sa email sa harvetservices@gmail.com o sa telepono sa 09212296819 o 09364158860.";
    if (targetLang === "tl") return "Maaari po kayong makipag-ugnayan sa Harbourside Veterinary Services sa email na harvetservices@gmail.com o sa telepono sa 09212296819 o 09364158860.";
    return "You can contact Harbourside Veterinary Services through email at harvetservices@gmail.com or by phone at 09212296819 or 09364158860.";
  }

  // Sunday queries
  if (/sunday|open.*sunday|sunday.*open/.test(q)) {
    if (targetLang === "ceb") return "Ang Harbourside Veterinary Services kay sirado sa Domingo. Ang operating hours kay Lunes hangtod Sabado, 9:00 AM hangtod 5:00 PM.";
    if (targetLang === "tl") return "Ang Harbourside Veterinary Services ay sarado kapag Linggo. Ang operating hours ay Lunes hanggang Sabado, 9:00 AM hanggang 5:00 PM.";
    return "Harbourside Veterinary Services is closed on Sundays. Operating hours are Monday to Saturday, 9:00 AM to 5:00 PM.";
  }

  // Operating hours queries
  if (/(hour|open|close|when.*open|operating.*hour|schedule.*clinic|oras|bukas)/.test(q)) {
    if (targetLang === "ceb") return "Ang operating hours sa Harbourside Veterinary Services kay Lunes hangtod Sabado, 9:00 AM hangtod 5:00 PM. Sirado ang clinic sa Domingo.";
    if (targetLang === "tl") return "Ang operating hours ng Harbourside Veterinary Services ay Lunes hanggang Sabado, 9:00 AM hanggang 5:00 PM. Sarado po ang clinic kapag Linggo.";
    return "Harbourside Veterinary Services is open Monday through Saturday from 9:00 AM to 5:00 PM. The clinic is closed on Sundays.";
  }

  // Emergency / vomiting query
  if (/(emergency|urgent|sick|symptom|vomit|bleed|letharg|fever|help|suka|nagsuka|nagsusuka)/.test(q)) {
    if (targetLang === "ceb") return "Kung ang imong pet adunay sintomas sama sa pag-suka o kawala sa gana, palihug dad-a ang imong pet sa Harbourside Veterinary Services sa operating hours (Lunes hangtod Sabado, 9:00 AM hangtod 5:00 PM) para sa propesyonal nga pag-usisa ni Dr. Alfredo B. Badiola Jr.\n\nPahinumdom: Ang PawBot naghatag ra ug general educational guidance ug dili makahatag ug medical diagnosis.";
    if (targetLang === "tl") return "Kung ang inyong alaga ay may sintomas tulad ng pagsusuka o panghihina, mangyaring dalhin po ang inyong alaga sa Harbourside Veterinary Services sa operating hours (Lunes hanggang Sabado, 9:00 AM hanggang 5:00 PM) para sa pagsusuri ni Dr. Alfredo B. Badiola Jr.\n\nPaalala: Ang PawBot ay nagbibigay ng general educational guidance lamang at hindi nagbibigay ng medical diagnosis.";
    return "If your pet is showing concerning symptoms or feeling sick, please bring your pet to Harbourside Veterinary Services during operating hours (Monday to Saturday, 9:00 AM to 5:00 PM) for examination by Dr. Alfredo B. Badiola Jr.\n\nPlease note that PawBot provides general educational guidance only and cannot provide a medical diagnosis. If your pet is in an emergency condition, seek veterinary care as soon as possible.";
  }

  // Greetings
  if (/hello|hi|hey|good (morning|afternoon|evening)|kumusta|maayong/.test(q)) {
    if (targetLang === "ceb") return `Maayong adlaw! Welcome sa Harbourside Veterinary Services. Ako si PawBot, ang imong virtual assistant. Unsaon nako pagtabang nimo karon?`;
    if (targetLang === "tl") return `Maligayang pagdating sa Harbourside Veterinary Services. Ako si PawBot, ang inyong virtual assistant. Paano ko po kayo matutulungan ngayong araw?`;
    return `Welcome to Harbourside Veterinary Services. I'm PawBot, your virtual assistant. How may I assist you today?`;
  }

  // Appointment query
  if (/(appointment|schedule|visit|booking|book|next.*(appt|visit)|when.*(see|visit|appointment)|my.*appointment)/.test(q)) {
    if (!ctx.appointments.length) {
      if (targetLang === "ceb") return "Wala kay umaabot nga appointment. Mahimo kang makahangyo ug appointment pinaagi sa Appointments section sa imong portal. Ang clinic open Lunes hangtod Sabado, 9:00 AM hangtod 5:00 PM.";
      if (targetLang === "tl") return "Wala ka pong nakatakdang appointment. Maaari ka pong mag-request ng appointment sa Appointments section ng inyong portal. Ang clinic ay bukas Lunes hanggang Sabado, 9:00 AM hanggang 5:00 PM.";
      return ctx.role === "owner"
        ? "You do not have any upcoming appointments scheduled. You can request an appointment through the Appointments section in your portal. The clinic is open Monday to Saturday from 9:00 AM to 5:00 PM."
        : "There are no upcoming appointments currently scheduled. You can review and manage appointments in the Schedule section.";
    }
    const list = ctx.appointments
      .slice(0, 5)
      .map(
        (a) =>
          `• Pet: ${a.pet_name ?? "Pet"} — ${formatDatePH(a.date)} at ${a.time} (${a.status})${a.reason ? ` — ${a.reason}` : ""}`
      )
      .join("\n");
    if (targetLang === "ceb") return `Aniay imong umaabot nga appointment:\n\n${list}\n\nAng clinic open Lunes hangtod Sabado, 9:00 AM hangtod 5:00 PM.`;
    if (targetLang === "tl") return `Ito po ang inyong nakatakdang appointment:\n\n${list}\n\nAng clinic ay bukas Lunes hanggang Sabado, 9:00 AM hanggang 5:00 PM.`;
    return `Here is your upcoming appointment schedule:\n\n${list}\n\nThe clinic is open Monday to Saturday from 9:00 AM to 5:00 PM.`;
  }

  // Vaccination query
  if (/(vaccin|shot|due|booster|immuniz|bakuna)/.test(q)) {
    const due = ctx.vaccinations.filter((v) => v.next_due && (daysFromTodayPH(v.next_due) ?? 99) <= 30);
    if (!due.length) {
      if (targetLang === "ceb") return ctx.vaccinations.length ? "Ang tanang bakuna sa imong pet up to date para sa sunod 30 ka adlaw." : "Wala koy nakit-an nga rekord sa bakuna. Palihug pakig-connect sa staff o doctor.";
      if (targetLang === "tl") return ctx.vaccinations.length ? "Ang lahat po ng bakuna ng inyong alaga ay up to date sa susunod na 30 araw." : "Wala pa pong nakatalang rekord ng bakuna. Mangyaring magtanong sa staff o kay Dr. Alfredo B. Badiola Jr.";
      return ctx.vaccinations.length
        ? "All vaccination records for your pets are up to date for the next 30 days."
        : "I do not see any vaccination records logged yet. Please consult Dr. Alfredo B. Badiola Jr. or clinic staff to review your pet's records.";
    }
    const list = due
      .map((v) => {
        const days = daysFromTodayPH(v.next_due);
        const status = days !== null && days < 0 ? "overdue" : days === 0 ? "due today" : "due soon";
        return `• Pet: ${v.pet_name} — ${v.vaccine_type}: ${formatDatePH(v.next_due)} (${status})`;
      })
      .join("\n");
    return `Here is the current vaccination status:\n\n${list}\n\nYou may request an appointment for vaccination boosters during clinic hours (Monday to Saturday, 9:00 AM to 5:00 PM).`;
  }

  // Pet list query
  if (/(pet|dog|cat|my pet|registered pet|iro|iring|aso|pusa)/.test(q)) {
    if (!ctx.pets.length) {
      if (targetLang === "ceb") return "Wala koy nakit-an nga nakarehistro nga pet sa imong account. Palihug kontaka ang clinic staff.";
      if (targetLang === "tl") return "Wala po akong nakitang nakarehistrong alaga sa inyong account. Mangyaring kontakin ang clinic staff.";
      return "I do not see any registered pets on your account yet. You can contact the clinic staff to add your pet's profile.";
    }
    const list = ctx.pets.map((p) => `• ${p.name}${p.species ? ` (${p.species})` : ""}`).join("\n");
    if (targetLang === "ceb") return `Ang imong mga nakarehistro nga pet:\n${list}`;
    if (targetLang === "tl") return `Ang inyong mga nakarehistrong alaga:\n${list}`;
    return `Here are your registered pets:\n${list}`;
  }

  // Medical Record query
  if (/(record|medical.*record|history|view.*record)/.test(q)) {
    return `You can view your pet's medical records, vaccination history, deworming history, and care timeline directly in the Pet Profile section of your portal.`;
  }

  // General fallback using retrieved knowledge if available
  if (retrievedKnowledge.length > 0) {
    const kSummary = retrievedKnowledge.map((k) => `• ${k.title}: ${k.content}`).join("\n\n");
    if (targetLang === "ceb") return `Aniay impormasyon gikan sa Harbourside Veterinary Services:\n\n${kSummary}`;
    if (targetLang === "tl") return `Ito po ang impormasyon mula sa Harbourside Veterinary Services:\n\n${kSummary}`;
    return `Here is relevant information from Harbourside Veterinary Services:\n\n${kSummary}`;
  }

  if (targetLang === "ceb") {
    return `Welcome sa Harbourside Veterinary Services. Ako si PawBot, ang imong virtual assistant. Makatabang ako sa clinic hours, contact details, appointments, ug bakuna. Unsaon nako pagtabang nimo karon?`;
  }
  if (targetLang === "tl") {
    return `Maligayang pagdating sa Harbourside Veterinary Services. Ako si PawBot, ang inyong virtual assistant. Makakatulong po ako sa clinic hours, contact details, appointments, at bakuna. Paano ko po kayo matutulungan ngayong araw?`;
  }

  return `Welcome to Harbourside Veterinary Services. I'm PawBot, your virtual assistant. I can assist with general pet care information, appointments, clinic details, and vaccination records. How may I assist you today?`;
}

// Standard generateContent model id. Override with GEMINI_MODEL if needed.
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
const GEMINI_MODELS = Array.from(
  new Set([DEFAULT_GEMINI_MODEL, "gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-pro"])
).filter(Boolean);

function buildGeminiPayload(
  messages: { role: string; content: string }[],
  contextBlock: string,
  retrievedKnowledge: KnowledgeEntry[],
  targetLanguage: "en" | "tl" | "ceb",
  userRole: "admin" | "staff" | "owner" = "owner"
) {
  const knowledgeBlock = retrievedKnowledge.length
    ? retrievedKnowledge.map((k) => `[Category: ${k.category} | Title: ${k.title}]\n${k.content}`).join("\n\n")
    : "No specific knowledge base entries retrieved.";

  const langInstruction = getLanguageInstruction(targetLanguage);

  let roleInstruction = "";
  if (userRole === "admin") {
    roleInstruction = `ROLE GUIDANCE (ADMIN PAWBOT):
- Provide clear, professional guidance on clinic & system workflows, appointment management, inventory control, laboratory transactions, and administrative features.
- Adapt tone to be professional, direct, and system-oriented. Strictly adhere to standard Admin RBAC permissions.`;
  } else if (userRole === "staff") {
    roleInstruction = `ROLE GUIDANCE (STAFF PAWBOT):
- Provide clear, concise operational guidance on clinic workflows, appointment scheduling, care record logging, FEFO inventory management, and laboratory workflows.
- Strictly adhere to RBAC: do not reveal private pet-owner information unless authorized by Staff permissions.`;
  } else {
    roleInstruction = `ROLE GUIDANCE (PET OWNER PAWBOT):
- Provide accessible, warm, and professional pet-care guidance, clinic location & contact details, appointment guidance, basic vaccination/deworming information, and system navigation.
- Strictly adhere to RBAC: only discuss the user's own permitted pets and appointments. Never reveal another user's private data.`;
  }

  const systemPrompt = `You are PawBot, the formal, professional, natural, and conversational virtual assistant for Harbourside Veterinary Services in the Philippines (Asia/Manila timezone).

${langInstruction}

${roleInstruction}

CRITICAL RESPONSE STYLE & FORMATTING RULES:
- Write in a formal, professional, natural, and conversational tone.
- Speak naturally like a professional veterinary virtual assistant.
- DO NOT use markdown bold formatting (DO NOT use **asterisks** around ordinary words or labels).
- DO NOT use markdown section headings (DO NOT use ### or ## headers).
- DO NOT use horizontal line dividers (DO NOT use --- or ___).
- DO NOT use excessive bullet points or numbered lists. Use a simple bullet list only when it genuinely improves readability.
- Write in clean, well-structured paragraphs (typically 1 to 4 short paragraphs per response).
- Answer the user's actual question directly without repetitive preamble, intro fluff, or awkward greeting loops.
- Include clinic contact information (address, phone numbers, email, hours) ONLY when relevant to the user's inquiry. Do not force contact info into every answer.

CLIENT / BUSINESS NAME: Harbourside Veterinary Services
SOFTWARE / SYSTEM NAME: Harbourside Veterinary Clinic Pet Care Management System with AI Chatbot Integration
Clinic Tagline: Your VET for a healthy PET!
Veterinarian: Dr. Alfredo B. Badiola Jr.
Location / Address: Unit 7 G/F Villa Teresa Subdivision, Gabi, Cordova, Cebu
Email: harvetservices@gmail.com
Phone Numbers: 09212296819 or 09364158860
Operating Hours: Monday through Saturday: 9:00 AM to 5:00 PM. Sunday: CLOSED.

CRITICAL NAME DISTINCTIONS:
- When introducing the business or welcoming the user: "Welcome to Harbourside Veterinary Services. I'm PawBot, your virtual assistant. How may I assist you today?"
- When asked "What is the name of the clinic?": "The clinic is Harbourside Veterinary Services."
- When asked "What system is this?": "This is the Harbourside Veterinary Clinic Pet Care Management System with AI Chatbot Integration."

RETRIEVED CLINIC KNOWLEDGE BASE (PRIMARY SOURCE FOR CLINIC QUESTIONS):
${knowledgeBlock}

GROUNDING & ANTI-HALLUCINATION RULES:
- Base clinic-specific answers directly on the RETRIEVED CLINIC KNOWLEDGE BASE above.
- Never invent clinic prices, fees, schedules, veterinarians, services, promotions, or policies.
- NO HALLUCINATED PRICES: If specific prices or fees are requested and NOT present in the retrieved knowledge, state naturally that specific pricing depends on the pet's size, weight, and condition, and is not available online. Recommend contacting Harbourside Veterinary Services at 09212296819 or 09364158860, or emailing harvetservices@gmail.com for current pricing.

VETERINARY SAFETY & MEDICAL RULES:
- Provide general educational information only. Do NOT diagnose pets or prescribe medication/dosages.
- Use natural expressions like: "This can have several possible causes, and a veterinarian would need to examine your pet to determine the cause."
- For emergencies or severe symptoms (e.g. difficulty breathing, seizures, severe weakness, bleeding, poisoning), advise: "If your pet is experiencing an emergency condition, seek veterinary care as soon as possible."
- Recommend consulting Dr. Alfredo B. Badiola Jr. or visiting Harbourside Veterinary Services for medical concerns.

--- User's live clinic data ---
${contextBlock}
--- End data ---

Respond naturally and professionally in clean text without markdown asterisks or headers.`;

  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  return { systemPrompt, contents };
}

/** Returns Gemini text, or null if unavailable (quota, auth, etc.). */
export type GeminiReplyResult = {
  text: string | null;
  is503Error?: boolean;
};

/** Returns Gemini text or 503 status indicator for graceful fallback. */
export async function generateGeminiReply(
  apiKey: string,
  messages: { role: string; content: string }[],
  contextBlock: string,
  langPref: SupportedLanguage = "auto",
  retrievedKnowledge: KnowledgeEntry[] = [],
  userRole: "admin" | "staff" | "owner" = "owner"
): Promise<GeminiReplyResult> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const targetLanguage = langPref !== "auto" ? langPref : detectLanguage(lastUserMsg);

  const { systemPrompt, contents } = buildGeminiPayload(
    messages,
    contextBlock,
    retrievedKnowledge,
    targetLanguage,
    userRole
  );

  let is503Error = false;
  const startTime = Date.now();
  const MAX_TOTAL_MS = 7000; // 7s overall cap to prevent Next.js proxy socket hang up / ECONNRESET

  for (const model of GEMINI_MODELS) {
    if (Date.now() - startTime > MAX_TOTAL_MS) {
      console.warn(`[Gemini Warning] Total Gemini request time exceeded ${MAX_TOTAL_MS}ms. Falling back.`);
      break;
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const maxRetries = 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (Date.now() - startTime > MAX_TOTAL_MS) break;

      try {
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(4500),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => `HTTP ${response.status}`);
          if (response.status === 503) {
            is503Error = true;
            console.warn(
              `[Gemini Warning] Model ${model} status 503: High demand temporary error. Attempt ${attempt + 1}/${maxRetries + 1}.`
            );
            if (attempt < maxRetries && Date.now() - startTime < MAX_TOTAL_MS - 1000) {
              await new Promise((resolve) => setTimeout(resolve, 300));
              continue;
            }
            break;
          }

          if (response.status === 404) {
            console.warn(`[Gemini Warning] Model ${model} returned 404 (not found or deprecated). Skipping model.`);
            break;
          }

          console.error(`[Gemini Error] Model ${model} status ${response.status}:`, errText.slice(0, 200));
          break;
        }

        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return { text };
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          console.warn(`[Gemini Warning] Model ${model} request timed out (4.5s cap).`);
        } else {
          console.error(`[Gemini Fetch Error] Model ${model}:`, e instanceof Error ? e.message : String(e));
        }
        if (attempt < maxRetries && Date.now() - startTime < MAX_TOTAL_MS - 1000) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }
  }

  return { text: null, is503Error };
}


