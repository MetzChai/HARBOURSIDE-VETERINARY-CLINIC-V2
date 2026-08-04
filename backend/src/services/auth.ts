import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Response, Request } from "express";

export type AppRole = "admin" | "staff" | "owner";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
}

export const COOKIE_NAME = "harbourside_session";

export function isClinicUser(role: AppRole): boolean {
  return role === "admin" || role === "staff";
}

export function isAdmin(role: AppRole): boolean {
  return role === "admin";
}

export function canManageStaff(role: AppRole): boolean {
  return role === "admin";
}

export function canViewReports(role: AppRole): boolean {
  return role === "admin";
}

export function canManageInventoryItems(role: AppRole): boolean {
  return role === "admin";
}

export function resolvePrimaryRole(roles: string[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  return "owner";
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function validatePasswordPolicy(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number." };
  }
  if (!/[!@#$%^&*(),.?":{}|<>_\-\\\/\[\]]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character." };
  }
  return { valid: true };
}

function getSecret() {
  const secret = process.env.AUTH_SECRET || "harbourside_default_secure_auth_secret_key_2026";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.id || !payload.email || !payload.role) return null;
    return {
      id: String(payload.id),
      email: String(payload.email),
      fullName: payload.fullName ? String(payload.fullName) : null,
      role: payload.role as AppRole,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function getSession(req: Request): Promise<SessionUser | null> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}
