import { Router } from "express";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  isClinicUser,
} from "../services/auth.js";
import {
  loginUser,
  ensureUserProfile,
  registerUser,
  loginOrRegisterGoogleUser,
  getUserProfile,
  updateUserProfile,
  verifyEmailToken,
  resendEmailVerification,
  forgotPasswordRequest,
  resetPasswordWithToken,
} from "../services/data.js";
import {
  createOAuthState,
  exchangeGoogleCode,
  getGoogleRedirectUri,
  verifyGoogleIdToken,
  verifyOAuthState,
} from "../services/google.js";
import { nowPHIso } from "../lib/datetime.js";

const router = Router();

function frontendUrl(path: string) {
  const base = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function getIpAddress(req: any): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const ipAddress = getIpAddress(req);
    const result = await loginUser(email, password, ipAddress);

    if ("error" in result) {
      if (result.error === "ACCOUNT_LOCKED") {
        res.status(429).json({
          error: "Too many failed login attempts. Please try again later.",
          code: "ACCOUNT_LOCKED",
        });
        return;
      }

      if (result.error === "ACCOUNT_DEACTIVATED") {
        res.status(403).json({
          error: result.message || "Account is deactivated. Please contact an administrator.",
          code: "ACCOUNT_DEACTIVATED",
        });
        return;
      }

      if (result.error === "EMAIL_NOT_VERIFIED") {
        res.status(403).json({
          error: "Please check your Gmail to verify your account before logging in.",
          code: "EMAIL_NOT_VERIFIED",
          email: result.email,
        });
        return;
      }

      if (result.error === "GOOGLE_ONLY") {
        res.status(403).json({
          error: "This account uses Google sign-in. Click Continue with Google below.",
          code: "GOOGLE_ONLY",
          email: result.email,
        });
        return;
      }

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
      message: "Welcome back!",
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
    const { firstName, middleName, lastName, email, password, confirmPassword, phone, address } = req.body ?? {};

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      res.status(400).json({ error: "First Name, Last Name, Email, Password, and Confirm Password are required." });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: "Password and Confirm Password do not match." });
      return;
    }

    const user = await registerUser({
      firstName,
      middleName,
      lastName,
      email,
      password,
      phone,
      address,
    });

    res.json({
      needsVerification: true,
      user: { id: user.id, email: user.email, fullName: user.fullName },
      message: "Please check your Gmail to verify your account.",
    });
  } catch (e: any) {
    console.error("signup error:", e);
    const msg = e instanceof Error ? e.message : "Registration failed.";
    res.status(400).json({ error: msg });
  }
});

router.all("/verify-email", async (req, res) => {
  try {
    const token = String(req.query?.token || req.body?.token || "");
    if (!token) {
      res.status(400).json({ error: "Verification token is required." });
      return;
    }

    const result = await verifyEmailToken(token);
    if (!result.success) {
      res.status(400).json({ error: result.message, code: result.error, email: result.email });
      return;
    }

    res.json({ message: "Your email has been verified successfully.", email: result.email });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to verify email." });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }
    const result = await resendEmailVerification(String(email));
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }
    res.json({ message: "Please check your Gmail to verify your account." });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to resend verification email." });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      res.status(400).json({ error: "Email address is required." });
      return;
    }

    const result = await forgotPasswordRequest(String(email));
    res.json({ message: result.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to process request." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body ?? {};
    if (!token || !newPassword) {
      res.status(400).json({ error: "Token and new password are required." });
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      res.status(400).json({ error: "New password and Confirm password must match." });
      return;
    }

    const result = await resetPasswordWithToken(String(token), String(newPassword));
    res.json({ message: result.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to reset password." });
  }
});

function profileFromSession(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return {
    id: session.id,
    email: session.email,
    firstName: null,
    middleName: null,
    lastName: null,
    fullName: session.fullName,
    role: session.role,
    authMethod: "password" as const,
    createdAt: nowPHIso(),
    lastLogin: null,
    accountStatus: "Active",
    contact: null,
    address: null,
    ownerName: session.fullName,
    avatarUrl: null,
    emailVerified: true,
    loginHistory: [],
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
      firstName: body.firstName,
      middleName: body.middleName,
      lastName: body.lastName,
      fullName: body.fullName,
      contact: body.contact,
      address: body.address,
      avatarUrl: body.avatarUrl,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    if (profile) {
      const token = await createSessionToken({
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
      });
      setSessionCookie(res, token);
    }
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

    const ipAddress = getIpAddress(req);
    const result = await loginOrRegisterGoogleUser(googleUser, ipAddress);
    if ("error" in result) {
      if (result.error === "ACCOUNT_DEACTIVATED") {
        res.redirect(frontendUrl("/login?error=account_deactivated"));
        return;
      }
      res.redirect(frontendUrl("/login?error=google_gmail_only"));
      return;
    }

    const token = await createSessionToken(result.user);
    setSessionCookie(res, token);

    const dest = isClinicUser(result.user.role) ? "/admin" : "/user";
    res.redirect(frontendUrl(dest));
  } catch (e) {
    console.error("Google callback error:", e);
    res.redirect(frontendUrl("/login?error=google_auth_failed"));
  }
});

export default router;
