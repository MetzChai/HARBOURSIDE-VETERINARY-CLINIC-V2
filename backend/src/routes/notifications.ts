import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../lib/db.js";

const router = Router();

/**
 * GET /api/notifications
 * Returns per-user notification read states for the authenticated user.
 */
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT notification_id, read_at FROM user_notifications WHERE user_id = $1`,
      [userId]
    );

    const readMap: Record<string, string> = {};
    const readIds: string[] = [];
    for (const r of rows) {
      if (r.read_at) {
        readMap[r.notification_id] = new Date(r.read_at).toISOString();
        readIds.push(r.notification_id);
      }
    }

    res.json({ readIds, readMap });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notification read states" });
  }
});

/**
 * POST /api/notifications/:id/read
 * Marks a single notification as read for the authenticated user ONLY.
 */
router.post("/:id/read", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const notificationId = String(req.params.id);

    if (!notificationId) {
      res.status(400).json({ error: "Notification ID is required" });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO user_notifications (user_id, notification_id, read_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, notification_id)
       DO UPDATE SET read_at = now()
       RETURNING notification_id, read_at`,
      [userId, notificationId]
    );

    res.json({
      success: true,
      notificationId: rows[0].notification_id,
      readAt: rows[0].read_at,
    });
  } catch (err) {
    console.error("POST /api/notifications/:id/read error:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

/**
 * POST /api/notifications/read-all
 * Marks multiple notification IDs as read for the authenticated user ONLY.
 */
router.post("/read-all", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const ids = (req.body?.ids ?? []) as string[];

    if (!Array.isArray(ids) || ids.length === 0) {
      res.json({ success: true, count: 0 });
      return;
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO user_notifications (user_id, notification_id, read_at)
       SELECT $1, unnest($2::text[]), now()
       ON CONFLICT (user_id, notification_id)
       DO UPDATE SET read_at = now()`,
      [userId, ids]
    );

    res.json({ success: true, count: ids.length });
  } catch (err) {
    console.error("POST /api/notifications/read-all error:", err);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

export default router;
