import { randomBytes } from "crypto";
import type { Request, Response } from "express";

const STATE_COOKIE = "google_oauth_state";
const STATE_MAX_AGE = 600;

export function getGoogleRedirectUri(req: Request) {
  const origin =
    process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? `${req.protocol}://${req.get("host")}`;
  return `${origin}/api/auth/google/callback`;
}

export function createOAuthState(res: Response) {
  const state = randomBytes(32).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE * 1000,
  });
  return state;
}

export function verifyOAuthState(req: Request, res: Response, state: string | null | undefined) {
  if (!state) return false;
  const stored = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: "/" });
  if (!stored || stored !== state) return false;
  return true;
}

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  picture?: string;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_NOT_CONFIGURED");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token error:", await tokenRes.text());
    throw new Error("GOOGLE_TOKEN_FAILED");
  }

  return tokenRes.json() as Promise<GoogleTokenResponse>;
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleUser> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_NOT_CONFIGURED");

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) {
    console.error("Google id_token verify failed:", await res.text());
    throw new Error("GOOGLE_TOKEN_INVALID");
  }

  const payload = (await res.json()) as {
    sub: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    aud: string;
    iss: string;
    exp: string;
  };

  if (payload.aud !== clientId) throw new Error("GOOGLE_AUDIENCE_MISMATCH");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
    throw new Error("GOOGLE_ISSUER_INVALID");
  }
  if (Number(payload.exp) * 1000 < Date.now()) throw new Error("GOOGLE_TOKEN_EXPIRED");
  if (!payload.email) throw new Error("GOOGLE_NO_EMAIL");

  const emailVerified = payload.email_verified === true || payload.email_verified === "true";

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    fullName: payload.name ?? payload.email.split("@")[0],
    emailVerified,
    picture: payload.picture,
  };
}

export function isGmailAddress(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain === "gmail.com" || domain === "googlemail.com";
}
