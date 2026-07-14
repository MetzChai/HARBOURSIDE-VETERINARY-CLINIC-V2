import { Router } from "express";
import { getAppointmentAvailability } from "../services/data.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/availability", requireAuth, async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date is required (YYYY-MM-DD)." });
    return;
  }
  try {
    const availability = await getAppointmentAvailability(date);
    res.json(availability);
  } catch (e) {
    console.error("availability error:", e);
    res.status(500).json({ error: "Failed to load availability" });
  }
});

export default router;
