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
import {
  getAllUsersForAdmin,
  toggleAccountStatus,
  adminResetPassword,
  createStaffAccount as createStaffFull,
} from "../services/data.js";

const router = Router();

function requireAdmin(req: AuthedRequest, res: import("express").Response): boolean {
  if (!req.user || !canManageStaff(req.user.role)) {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return false;
  }
  return true;
}

router.get("/users", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const users = await getAllUsersForAdmin();
    res.json({ users });
  } catch (e) {
    console.error("list all users error:", e);
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.patch("/users/:id/status", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { status } = req.body ?? {};
    if (status !== "Active" && status !== "Deactivated") {
      res.status(400).json({ error: "Status must be 'Active' or 'Deactivated'." });
      return;
    }
    const result = await toggleAccountStatus(req.user!.id, req.params.id, status);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to update account status." });
  }
});

router.post("/users/:id/reset-password", requireAuth, async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { newPassword } = req.body ?? {};
    if (!newPassword) {
      res.status(400).json({ error: "New password is required." });
      return;
    }
    const result = await adminResetPassword(req.user!.id, req.params.id, newPassword);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to reset password." });
  }
});

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
    const { firstName, middleName, lastName, email, password, phone } = req.body ?? {};
    const fullName = req.body?.fullName || [firstName, middleName, lastName].filter(Boolean).join(" ");

    if (!email || !password || (!fullName && (!firstName || !lastName))) {
      res.status(400).json({ error: "Email, Password, and Name are required." });
      return;
    }

    if (firstName && lastName) {
      const account = await createStaffFull(req.user!.id, {
        firstName,
        middleName,
        lastName,
        email,
        password,
        phone,
      });
      res.status(201).json({ account });
    } else {
      const account = await createStaffAccount({ email, fullName, password });
      res.status(201).json({ account });
    }
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
