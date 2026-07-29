import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { canManageStaff } from "../services/auth.js";
import {
  createStaffAccount,
  deleteOwnerAccount,
  deleteStaffAccount,
  listClinicAccounts,
  listOwnerAccounts,
} from "../services/staff.js";

const router = Router();

function requireAdmin(req: AuthedRequest, res: import("express").Response): boolean {
  if (!req.user || !canManageStaff(req.user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const accounts = await listClinicAccounts();
    res.json({ accounts });
  } catch (e) {
    console.error("list staff error:", e);
    res.status(500).json({ error: "Failed to load staff accounts" });
  }
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const email = String(req.body?.email ?? "").trim();
    const fullName = String(req.body?.fullName ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!email || !fullName || !password) {
      res.status(400).json({ error: "Email, full name, and password are required." });
      return;
    }

    const account = await createStaffAccount({ email, fullName, password });
    res.status(201).json({ account });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create staff account";
    res.status(400).json({ error: message });
  }
});

router.get("/owners", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const accounts = await listOwnerAccounts();
    res.json({ accounts });
  } catch (e) {
    console.error("list owner accounts error:", e);
    res.status(500).json({ error: "Failed to load pet owner accounts" });
  }
});

router.delete("/owners/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await deleteOwnerAccount(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete pet owner account";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await deleteStaffAccount(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete staff account";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

export default router;
