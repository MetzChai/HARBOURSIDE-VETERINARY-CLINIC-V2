import { Router } from "express";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSession,
} from "../services/auth.js";
import {
  loginUser,
  ensureUserProfile,
  registerUser,
  loginOrRegisterGoogleUser,
  getUserProfile,
  updateUserProfile,
} from "../services/data.js";
import { getPool, prisma } from "../lib/db.js";
import {
  createOAuthState,
  exchangeGoogleCode,
  getGoogleRedirectUri,
  isGmailAddress,
  verifyGoogleIdToken,
  verifyOAuthState,
} from "../services/google.js";
import { nowPHIso } from "../lib/datetime.js";

const router = Router();

function frontendUrl(path: string) {
  const base = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const result = await loginUser(email, password);
    if (!result) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    if ("error" in result && result.error === "EMAIL_NOT_VERIFIED") {
      res.status(403).json({
        error: "Please verify your Gmail address with Google before signing in.",
        code: "EMAIL_NOT_VERIFIED",
        email: result.email,
      });
      return;
    }
    if ("error" in result && result.error === "GOOGLE_ONLY") {
      res.status(403).json({
        error: "This account uses Google sign-in. Click Continue with Google below.",
        code: "GOOGLE_ONLY",
        email: result.email,
      });
      return;
    }
    if ("error" in result) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const user = result;
    await ensureUserProfile(user.id, user.email, user.fullName);
    const token = await createSessionToken(user);
    setSessionCookie(res, token);

    res.json({
      user: { id: user.id, email: user.email, user_metadata: { full_name: user.fullName } },
      role: user.role,
    });
  } catch (e) {
    console.error("login error:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/session", async (req, res) => {
  const user = await getSession(req);
  if (!user) {
    res.json({ session: null });
    return;
  }
  res.json({
    session: {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.fullName },
      },
      access_token: "session",
    },
    role: user.role,
  });
});

router.post("/signup", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").toLowerCase().trim();
    const password = req.body?.password;
    const fullName = req.body?.fullName;
    const contact = req.body?.contact;

    if (!email || !password || !fullName) {
      res.status(400).json({ error: "All required fields must be filled." });
      return;
    }
    if (!isGmailAddress(email)) {
      res.status(400).json({ error: "Pet owner registration requires a @gmail.com address." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }

    const pool = getPool();
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [email]);
    if (existing.rows.length) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const user = await registerUser({ email, password, fullName, contact });
    res.json({
      needsVerification: true,
      user: { id: user.id, email: user.email, user_metadata: { full_name: user.fullName } },
      message: "Account created. Verify your Gmail with Google before signing in.",
    });
  } catch (e) {
    console.error("signup error:", e);
    res.status(500).json({ error: "Signup failed. Please try again or use Continue with Google." });
  }
});

function profileFromSession(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return {
    id: session.id,
    email: session.email,
    fullName: session.fullName,
    role: session.role,
    authMethod: "password" as const,
    createdAt: nowPHIso(),
    contact: null,
    address: null,
    ownerName: session.fullName,
    avatarUrl: null,
    emailVerified: true,
  };
}

router.get("/profile", async (req, res) => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const profile = await getUserProfile(session.id);
    res.json({ profile: profile ?? profileFromSession(session) });
  } catch (e) {
    console.error("profile GET error:", e);
    res.json({ profile: profileFromSession(session) });
  }
});

router.patch("/profile", async (req, res) => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const body = req.body ?? {};
    const profile = await updateUserProfile(session.id, {
      fullName: body.fullName,
      contact: body.contact,
      address: body.address,
      avatarUrl: body.avatarUrl,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    res.json({ profile: profile ?? profileFromSession(session) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update profile";
    res.status(400).json({ error: message });
  }
});

router.get("/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.redirect(frontendUrl("/login?error=google_not_configured"));
    return;
  }
  try {
    const state = createOAuthState(res);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getGoogleRedirectUri(req),
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (e) {
    console.error("Google auth start error:", e);
    res.redirect(frontendUrl("/login?error=google_auth_failed"));
  }
});

router.get("/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;
  const state = req.query.state as string | undefined;

  if (error || !code) {
    res.redirect(frontendUrl("/login?error=google_auth_failed"));
    return;
  }

  if (!verifyOAuthState(req, res, state)) {
    res.redirect(frontendUrl("/login?error=google_state_invalid"));
    return;
  }

  try {
    const redirectUri = getGoogleRedirectUri(req);
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const googleUser = await verifyGoogleIdToken(tokens.id_token);

    if (!googleUser.emailVerified) {
      res.redirect(frontendUrl("/login?error=google_email_unverified"));
      return;
    }

    const result = await loginOrRegisterGoogleUser(googleUser);
    if ("error" in result) {
      res.redirect(frontendUrl("/login?error=google_gmail_only"));
      return;
    }

    const token = await createSessionToken(result.user);
    setSessionCookie(res, token);

    const dest = result.user.role === "admin" ? "/admin" : "/user";
    res.redirect(frontendUrl(dest));
  } catch (e) {
    console.error("Google callback error:", e);
    res.redirect(frontendUrl("/login?error=google_auth_failed"));
  }
});

export default router;
