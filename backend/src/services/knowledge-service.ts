import { getPool } from "../lib/db.js";

export type KnowledgeEntry = {
  id?: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
  source: string;
  isActive?: boolean;
};

export const INITIAL_KNOWLEDGE: KnowledgeEntry[] = [
  {
    category: "clinic_information",
    title: "Clinic Identity & Names",
    content: "Harbourside Veterinary Services is the official client business name. Software System Name: Harbourside Veterinary Clinic Pet Care Management System with AI Chatbot Integration.",
    keywords: ["name", "clinic", "business", "system", "harbourside", "services", "client"],
    source: "official_clinic_information",
  },
  {
    category: "location",
    title: "Clinic Location",
    content: "Harbourside Veterinary Services is located at Unit 7 G/F Villa Teresa Subdivision, Gabi, Cordova, Cebu.",
    keywords: ["location", "address", "where", "clinic", "cordova", "cebu", "subdivision", "gabi", "find", "place", "asa", "dapit", "saan", "located"],
    source: "official_clinic_information",
  },
  {
    category: "contact_information",
    title: "Clinic Contact Details",
    content: "You can contact Harbourside Veterinary Services via email at harvetservices@gmail.com or by phone at 09212296819 or 09364158860.",
    keywords: ["contact", "email", "phone", "number", "call", "reach", "telephone", "mobile", "hotline"],
    source: "official_clinic_information",
  },
  {
    category: "operating_hours",
    title: "Clinic Operating Hours",
    content: "Harbourside Veterinary Services operating hours: Monday through Saturday from 9:00 AM to 5:00 PM (Philippine Time). The clinic is CLOSED on Sundays.",
    keywords: ["hours", "open", "close", "operating", "schedule", "sunday", "saturday", "time", "when", "oras", "oras sa clinic", "bukas"],
    source: "official_clinic_information",
  },
  {
    category: "clinic_information",
    title: "Clinic Tagline",
    content: 'The official tagline of Harbourside Veterinary Services is: "Your VET for a healthy PET!"',
    keywords: ["tagline", "slogan", "motto", "vet", "pet"],
    source: "official_clinic_information",
  },
  {
    category: "veterinary_services",
    title: "Veterinarian Doctor",
    content: "The official veterinarian at Harbourside Veterinary Services is Dr. Alfredo B. Badiola Jr., DVM.",
    keywords: ["vet", "doctor", "badiola", "physician", "veterinarian", "who"],
    source: "official_clinic_information",
  },
  {
    category: "veterinary_services",
    title: "Veterinary Services Offered",
    content: "Harbourside Veterinary Services provides Check-up / Consultation, Vaccination, Treatment, Deworming, and Grooming services.",
    keywords: ["services", "offer", "checkup", "consultation", "vaccination", "treatment", "deworming", "grooming", "care", "serbisyo"],
    source: "official_clinic_information",
  },
  {
    category: "appointment_procedures",
    title: "Appointment Booking Workflow",
    content: "Pet owners can request appointments online through the Pet Owner Portal (Monday–Saturday 9:00 AM – 5:00 PM). Clinic staff review and manage requests. Statuses include: Requested, Scheduled, Completed, Missed, and Cancelled. No Sunday appointments.",
    keywords: ["appointment", "book", "schedule", "request", "visit", "status", "cancel", "reschedule", "how to book", "magpa-appointment"],
    source: "official_clinic_information",
  },
  {
    category: "vaccination",
    title: "Pet Vaccination Guidance",
    content: "Harbourside Veterinary Services offers core and routine pet vaccinations to protect against preventable diseases. Pet owners can view vaccination due dates in their Pet Owner Portal. Consult Dr. Alfredo B. Badiola Jr. for recommended booster schedules.",
    keywords: ["vaccine", "vaccination", "shot", "booster", "rabies", "distemper", "parvo", "immunization", "bakuna"],
    source: "official_clinic_information",
  },
  {
    category: "deworming",
    title: "Pet Deworming Care",
    content: "Deworming protects pets against internal parasites. Harbourside Veterinary Services provides scheduled deworming treatments. Past dates and next due dates are tracked in the Pet Owner Portal.",
    keywords: ["deworm", "deworming", "parasite", "worm", "treatment"],
    source: "official_clinic_information",
  },
  {
    category: "checkup",
    title: "General Consultation & Physical Examination",
    content: "Routine physical check-ups assess your pet's overall health, weight, vital signs, coat condition, and nutrition. Bring your pet to Harbourside Veterinary Services Monday through Saturday 9:00 AM – 5:00 PM for professional examination.",
    keywords: ["checkup", "consultation", "exam", "examination", "wellness", "physical", "konsulta"],
    source: "official_clinic_information",
  },
  {
    category: "grooming",
    title: "Pet Grooming Services & Tips",
    content: "Harbourside Veterinary Services offers grooming services. General care tips: brush coat 2–3x weekly, bathe dogs every 4–6 weeks, trim nails regularly, and clean ears gently.",
    keywords: ["grooming", "bath", "brush", "nail", "ear", "hygiene", "coat"],
    source: "official_clinic_information",
  },
  {
    category: "faq",
    title: "Pricing Policy & Fee Availability",
    content: "Exact pricing for specific consultations, vaccinations, treatments, grooming, deworming, or medications varies based on pet size, weight, and specific medical needs. Specific fees and prices are NOT available online. Please contact Harbourside Veterinary Services at 09212296819 or 09364158860, or email harvetservices@gmail.com for current pricing.",
    keywords: ["price", "cost", "fee", "rate", "how much", "charge", "payment", "expensive", "bayad", "presyo", "magkano", "pila"],
    source: "official_clinic_information",
  },
  {
    category: "pet_owner_portal",
    title: "Self-Service Pet Owner Portal",
    content: "Pet owners can log in to the Pet Owner Portal to view registered pets, inspect medical & care history, check upcoming appointments, track vaccination due dates, and communicate with clinic staff.",
    keywords: ["portal", "account", "login", "records", "history", "profile", "view"],
    source: "official_clinic_information",
  },
  {
    category: "general_pet_care",
    title: "Emergency & Veterinary Safety Policy",
    content: "PawBot provides general educational guidance only and does NOT provide a medical diagnosis or prescriptions. For urgent symptoms like severe vomiting, bleeding, difficulty breathing, lethargy, or poisoning, bring your pet immediately to Harbourside Veterinary Services or an emergency veterinary clinic.",
    keywords: ["emergency", "urgent", "sick", "vomiting", "bleeding", "poison", "dying", "fever", "lethargy", "help", "suka", "symptoms", "nagsusuka", "nagsuka"],
    source: "official_clinic_information",
  },
];

let isSeeded = false;

export async function ensureKnowledgeBaseSeeded(): Promise<void> {
  if (isSeeded) return;
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM clinic_knowledge`);
    if (rows[0]?.count === 0) {
      for (const k of INITIAL_KNOWLEDGE) {
        await pool.query(
          `INSERT INTO clinic_knowledge (category, title, content, keywords, source, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [k.category, k.title, k.content, k.keywords, k.source]
        );
      }
      console.log("[KNOWLEDGE BASE] Seeded initial clinic knowledge entries.");
    }
    isSeeded = true;
  } catch (e) {
    console.error("[KNOWLEDGE BASE] Failed to seed/check clinic_knowledge table:", e);
  }
}

export async function retrieveKnowledge(userQuery: string, limit = 4): Promise<KnowledgeEntry[]> {
  await ensureKnowledgeBaseSeeded();
  const qTokens = userQuery.toLowerCase().split(/\W+/).filter(Boolean);

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT category, title, content, keywords, source
       FROM clinic_knowledge
       WHERE is_active = true`
    );

    if (!rows.length) return INITIAL_KNOWLEDGE.slice(0, limit);

    const scored = rows.map((r: any) => {
      let score = 0;
      const keywords = (r.keywords || []) as string[];
      const titleLower = r.title.toLowerCase();
      const contentLower = r.content.toLowerCase();
      const catLower = r.category.toLowerCase();

      for (const token of qTokens) {
        if (token.length < 2) continue;
        if (keywords.some((k) => k.toLowerCase().includes(token))) score += 5;
        if (titleLower.includes(token)) score += 4;
        if (catLower.includes(token)) score += 3;
        if (contentLower.includes(token)) score += 2;
      }

      return { entry: r as KnowledgeEntry, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter((s) => s.score > 0).map((s) => s.entry);

    if (top.length > 0) {
      return top.slice(0, limit);
    }
  } catch (e) {
    console.error("[KNOWLEDGE BASE] DB retrieval error, falling back to in-memory score:", e);
  }

  // Fallback in-memory matching
  const scoredFallback = INITIAL_KNOWLEDGE.map((r) => {
    let score = 0;
    const titleLower = r.title.toLowerCase();
    const contentLower = r.content.toLowerCase();
    for (const token of qTokens) {
      if (token.length < 2) continue;
      if (r.keywords.some((k) => k.toLowerCase().includes(token))) score += 5;
      if (titleLower.includes(token)) score += 4;
      if (contentLower.includes(token)) score += 2;
    }
    return { entry: r, score };
  });

  scoredFallback.sort((a, b) => b.score - a.score);
  return scoredFallback.map((s) => s.entry).slice(0, limit);
}
