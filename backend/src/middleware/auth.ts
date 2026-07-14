import type { NextFunction, Request, Response } from "express";
import { getSession, type SessionUser } from "../services/auth.js";

export type AuthedRequest = Request & { user?: SessionUser };

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await getSession(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = user;
  next();
}

export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  req.user = (await getSession(req)) ?? undefined;
  next();
}
