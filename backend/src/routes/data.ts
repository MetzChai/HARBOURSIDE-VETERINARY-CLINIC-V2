import { Router } from "express";
import { queryInsert, querySelect, queryUpdate } from "../services/data.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { action, table } = req.body ?? {};

    if (action === "select") {
      const data = await querySelect({
        user: req.user!,
        table,
        select: req.body.select,
        filters: req.body.filters,
        order: req.body.order,
        single: req.body.single,
        maybeSingle: req.body.maybeSingle,
      });
      res.json({ data });
      return;
    }

    if (action === "insert") {
      const data = await queryInsert({
        user: req.user!,
        table,
        data: req.body.data,
        returning: req.body.returning,
      });
      if (req.body.single && Array.isArray(data)) {
        res.json({ data: data[0] ?? null });
        return;
      }
      res.json({ data });
      return;
    }

    if (action === "update") {
      const meta = await queryUpdate({
        user: req.user!,
        table,
        data: req.body.data,
        filters: req.body.filters ?? [],
      });
      res.json({ data: null, meta });
      return;
    }

    res.status(400).json({ error: "Invalid action" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    const status = message === "Forbidden" ? 403 : message === "Unauthorized" ? 401 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
