import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Response, Request } from "express";

export type AppRole = "admin" | "owner";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
}

export const COOKIE_NAME = "harbourside_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
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
