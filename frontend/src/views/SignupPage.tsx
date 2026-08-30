"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  Check,
} from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { toast } from "sonner";

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
};

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const passwordChecks = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[!@#$%^&*(),.?":{}|<>_\-\\\/\[\]]/.test(form.password),
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    if (!form.firstName.trim()) {
      errors.firstName = "First Name is required.";
    }

    if (!form.lastName.trim()) {
      errors.lastName = "Last Name is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim()) {
      errors.email = "Email Address is required.";
    } else if (!emailRegex.test(form.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    const phPhoneRegex = /^(09|\+639)\d{9}$/;
    if (!form.phone.trim()) {
      errors.phone = "Contact Number is required.";
    } else if (!phPhoneRegex.test(form.phone.replace(/\s+/g, ""))) {
      errors.phone = "Please enter a valid Philippine mobile number (e.g. 09171234567).";
    }

    if (!form.password) {
      errors.password = "Password is required.";
    } else if (!Object.values(passwordChecks).every(Boolean)) {
      errors.password = "Password does not meet the security requirements.";
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (!acceptTerms) {
      errors.terms = "Please accept the Terms of Service.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error && data.error.toLowerCase().includes("already exists")) {
          setFieldErrors({ email: "This email is already registered." });
        } else {
          setFieldErrors({ general: data.error || "Registration failed." });
        }
        setLoading(false);
        return;
      }

      setRegisteredEmail(form.email.trim());
      setIsSuccess(true);
      toast.success("Please check your email to verify your account.");
    } catch {
      setFieldErrors({ general: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!registeredEmail) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Verification email has been resent to " + registeredEmail);
      } else {
        toast.error(data.error || "Failed to resend verification email.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title={isSuccess ? "Registration Successful" : "Create Your Account"}
      subtitle={isSuccess ? "One last step before signing in" : "Join Harbourside Veterinary Clinic Pet Record System"}
    >
      <div className="mb-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>

      <Card className="border-border/60 shadow-md">
        <CardContent className="p-6">
          {isSuccess ? (
            /* Registration Success Screen */
            <div className="py-6 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-brand-green-light flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-brand-green" />
              </div>

              <div className="space-y-2">
                <h2 className="font-heading text-2xl font-bold text-brand-navy">
                  Registration Successful
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  We&apos;ve sent a verification email to{" "}
                  <strong className="text-foreground">{registeredEmail}</strong>. Please verify your account before signing in.
                </p>
              </div>

              <div className="p-4 bg-brand-teal-light rounded-lg text-xs text-brand-navy border border-brand-teal/20 text-left space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Info className="w-4 h-4 text-brand-teal shrink-0" /> Important Notice:
                </p>
                <p className="pl-5">
                  The verification link will expire after <strong>24 hours</strong>. If you do not see the email in your inbox, please check your spam or junk folder.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <Button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={resending}
                  variant="outline"
                  className="w-full h-11 text-sm font-semibold"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Resend Verification Email
                </Button>

                <Button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full h-11 text-sm font-semibold"
                >
                  Back to Login
                </Button>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSignup} className="space-y-4" noValidate>
              {fieldErrors.general && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg text-center font-medium">
                  {fieldErrors.general}
                </div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      placeholder="Juan"
                      value={form.firstName}
                      onChange={(e) => {
                        setForm({ ...form, firstName: e.target.value });
                        if (fieldErrors.firstName) setFieldErrors({ ...fieldErrors, firstName: undefined });
                      }}
                      className={`pl-10 h-10 ${fieldErrors.firstName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.firstName && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.firstName}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="middleName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Middle Name <span className="text-xs text-muted-foreground font-normal"></span>
                  </Label>
                  <Input
                    id="middleName"
                    placeholder="Santos"
                    value={form.middleName}
                    onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Dela Cruz"
                    value={form.lastName}
                    onChange={(e) => {
                      setForm({ ...form, lastName: e.target.value });
                      if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: undefined });
                    }}
                    className={`h-10 ${fieldErrors.lastName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email & Contact Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                      }}
                      className={`pl-10 h-10 ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact Number <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      placeholder="Example: 09171234567"
                      value={form.phone}
                      onChange={(e) => {
                        setForm({ ...form, phone: e.target.value });
                        if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
                      }}
                      className={`pl-10 h-10 ${fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Multi-line Address Textarea */}
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Address <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea
                    id="address"
                    placeholder="Enter your complete address (e.g. Street, Barangay, City, Province)"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="pl-10 min-h-[70px] resize-y"
                    rows={2}
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      onChange={(e) => {
                        setForm({ ...form, password: e.target.value });
                        if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                      }}
                      className={`pl-10 pr-10 h-10 ${fieldErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Confirm Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={form.confirmPassword}
                      onChange={(e) => {
                        setForm({ ...form, confirmPassword: e.target.value });
                        if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                      }}
                      className={`pl-10 h-10 ${fieldErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Password Requirements Live Checklist */}
              <div className="p-3 bg-muted/60 rounded-lg text-xs space-y-1.5 border border-border/60">
                <p className="font-semibold text-brand-navy">Password Requirements</p>
                <div className="space-y-1 text-muted-foreground">
                  <div className={`flex items-center gap-1.5 ${passwordChecks.length ? "text-brand-green font-medium" : ""}`}>
                    {passwordChecks.length ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <span className="w-3.5 text-center text-muted-foreground">•</span>}
                    Minimum of 8 characters
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordChecks.uppercase ? "text-brand-green font-medium" : ""}`}>
                    {passwordChecks.uppercase ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <span className="w-3.5 text-center text-muted-foreground">•</span>}
                    At least one uppercase letter
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordChecks.lowercase ? "text-brand-green font-medium" : ""}`}>
                    {passwordChecks.lowercase ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <span className="w-3.5 text-center text-muted-foreground">•</span>}
                    At least one lowercase letter
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordChecks.number ? "text-brand-green font-medium" : ""}`}>
                    {passwordChecks.number ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <span className="w-3.5 text-center text-muted-foreground">•</span>}
                    At least one number
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordChecks.special ? "text-brand-green font-medium" : ""}`}>
                    {passwordChecks.special ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <span className="w-3.5 text-center text-muted-foreground">•</span>}
                    At least one special character
                  </div>
                </div>
              </div>

              {/* Email Verification Informational Notice */}
              <div className="p-3 bg-brand-teal-light/80 rounded-lg text-xs text-brand-navy border border-brand-teal/20 flex items-start gap-2">
                <Info className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                <span>
                  After registration, a verification email will be sent to your email address. You must verify your account before signing in.
                </span>
              </div>

              {/* Terms and Privacy Policy */}
              <div className="space-y-1 pt-1">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => {
                      setAcceptTerms(Boolean(checked));
                      if (fieldErrors.terms) setFieldErrors({ ...fieldErrors, terms: undefined });
                    }}
                    className="mt-0.5"
                  />
                  <Label htmlFor="terms" className="text-xs text-muted-foreground leading-normal cursor-pointer">
                    I have read and agree to the{" "}
                    <span className="text-brand-teal font-medium underline hover:text-brand-navy">
                      Terms of Service
                    </span>{" "}
                    and{" "}
                    <span className="text-brand-teal font-medium underline hover:text-brand-navy">
                      Privacy Policy
                    </span>
                    .
                  </Label>
                </div>
                {fieldErrors.terms && (
                  <p className="text-xs text-destructive font-medium pl-6">{fieldErrors.terms}</p>
                )}
              </div>

              {/* Submit Register Button */}
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Register Account"
                )}
              </Button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <GoogleSignInButton disabled={loading} />

              <div className="text-center text-sm text-muted-foreground pt-1">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="auth-link font-semibold underline underline-offset-4"
                >
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
