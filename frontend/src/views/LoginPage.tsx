"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import { authClient } from "@/lib/db-client";
import { isClinicUser, type AppRole } from "@/lib/roles";
import { useAuth } from "@/hooks/useAuth";
import { AuthShell } from "@/components/AuthShell";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("error");
    const messages: Record<string, string> = {
      google_not_configured: "Google login is not configured on the server.",
      google_auth_failed: "Google sign-in failed. Please try again.",
      google_no_email: "Your Google account has no email address.",
      google_email_unverified: "Please verify your Gmail address with Google first.",
      google_gmail_only: "New Google sign-ups require a verified @gmail.com account.",
      google_state_invalid: "Sign-in session expired. Please try Google again.",
      account_deactivated: "Account is deactivated. Please contact an administrator.",
    };
    if (authError && messages[authError]) setError(messages[authError]);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both email address and password.");
      return;
    }

    setLoading(true);
    const { data, error: signInError } = await authClient.signInWithPassword({ email, password });
    
    if (signInError || !data?.user) {
      if (signInError?.code === "ACCOUNT_LOCKED") {
        setError("Too many failed login attempts. Please try again later.");
        setLoading(false);
        return;
      }
      if (signInError?.code === "ACCOUNT_DEACTIVATED") {
        setError("Account is deactivated. Please contact an administrator.");
        setLoading(false);
        return;
      }
      if (signInError?.code === "EMAIL_NOT_VERIFIED") {
        setError("Please check your Gmail to verify your account before logging in.");
        setLoading(false);
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      if (signInError?.code === "GOOGLE_ONLY") {
        setError("This account uses Google sign-in. Click Continue with Google below.");
        setLoading(false);
        return;
      }
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    toast.success("Welcome back!");
    const loginRole = (data.role ?? "owner") as AppRole;
    await refreshSession();
    router.push(isClinicUser(loginRole) ? "/admin" : "/user");
  };

  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to your Harbourside account">
      <Card className="border-border/60 shadow-md">
        <CardContent className="p-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="form-label">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="form-label">
                  Password
                </Label>
                <Link href="/forgot-password" className="text-xs auth-link">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="pl-10 pr-10 h-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
              />
              <Label htmlFor="remember" className="text-xs font-normal text-muted-foreground cursor-pointer">
                Remember Me
              </Label>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center font-medium">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <GoogleSignInButton disabled={loading} />

            <div className="pt-2 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="auth-link font-semibold underline underline-offset-4">
                Register
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
