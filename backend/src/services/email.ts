import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function getAppUrl() {
  const url = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export async function sendVerificationEmail(email: string, userName: string, token: string) {
  const appUrl = getAppUrl();
  const verifyLink = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f766e; text-align: center;">Harbourside Veterinary Clinic</h2>
      <h3 style="color: #1e293b;">Email Verification Required</h3>
      <p>Hello <strong>${userName || "Valued Pet Owner"}</strong>,</p>
      <p>Thank you for registering with Harbourside Veterinary Clinic. Please verify your Gmail address to activate your pet record management account.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyLink}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
      </div>

      <p style="color: #64748b; font-size: 14px;"><strong>Notice:</strong> This verification link will expire after <strong>24 hours</strong>.</p>
      <p style="color: #64748b; font-size: 14px;">If you did not create an account with Harbourside Veterinary Clinic, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Harbourside Veterinary Clinic – Pet Record Management System</p>
    </div>
  `;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Harbourside Veterinary Clinic" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
        to: email,
        subject: "Verify Your Email - Harbourside Veterinary Clinic",
        html,
      });
      console.log(`[EMAIL] Verification email sent to ${email}`);
    } catch (e) {
      console.error("[EMAIL ERROR] Failed to send verification email:", e);
    }
  } else {
    console.log(`\n========================================`);
    console.log(`[EMAIL SIMULATION] Verification Email to: ${email}`);
    console.log(`[EMAIL SIMULATION] User: ${userName}`);
    console.log(`[EMAIL SIMULATION] Link: ${verifyLink}`);
    console.log(`========================================\n`);
  }
}

export async function sendPasswordResetEmail(email: string, userName: string, token: string) {
  const appUrl = getAppUrl();
  const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f766e; text-align: center;">Harbourside Veterinary Clinic</h2>
      <h3 style="color: #1e293b;">Password Reset Request</h3>
      <p>Hello <strong>${userName || "User"}</strong>,</p>
      <p>We received a request to reset your password for your Harbourside Veterinary Clinic account.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>

      <p style="color: #64748b; font-size: 14px;"><strong>Notice:</strong> This password reset link will expire after <strong>30 minutes</strong>.</p>
      <p style="color: #64748b; font-size: 14px;">If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Harbourside Veterinary Clinic – Pet Record Management System</p>
    </div>
  `;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Harbourside Veterinary Clinic" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
        to: email,
        subject: "Reset Your Password - Harbourside Veterinary Clinic",
        html,
      });
      console.log(`[EMAIL] Password reset email sent to ${email}`);
    } catch (e) {
      console.error("[EMAIL ERROR] Failed to send password reset email:", e);
    }
  } else {
    console.log(`\n========================================`);
    console.log(`[EMAIL SIMULATION] Password Reset Email to: ${email}`);
    console.log(`[EMAIL SIMULATION] User: ${userName}`);
    console.log(`[EMAIL SIMULATION] Link: ${resetLink}`);
    console.log(`========================================\n`);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendClinicNoticeEmail(
  email: string,
  userName: string,
  subject: string,
  body: string
) {
  const portalLink = `${getAppUrl()}/user/messages`;
  const htmlBody = escapeHtml(body).replace(/\n/g, "<br />");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #7f1d1d; text-align: center;">Harbourside Veterinary Clinic</h2>
      <h3 style="color: #1e293b;">${escapeHtml(subject)}</h3>
      <p>Hello <strong>${escapeHtml(userName || "Valued Pet Owner")}</strong>,</p>
      <div style="color: #334155; line-height: 1.6;">${htmlBody}</div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${portalLink}" style="background-color: #7f1d1d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Messages</a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Harbourside Veterinary Clinic – Pet Record Management System</p>
    </div>
  `;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Harbourside Veterinary Clinic" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
        to: email,
        subject,
        html,
      });
      console.log(`[EMAIL] Clinic notice sent to ${email}`);
    } catch (e) {
      console.error("[EMAIL ERROR] Failed to send clinic notice:", e);
    }
  } else {
    console.log(`\n========================================`);
    console.log(`[EMAIL SIMULATION] Clinic notice to: ${email}`);
    console.log(`[EMAIL SIMULATION] Subject: ${subject}`);
    console.log(`[EMAIL SIMULATION] Body:\n${body}`);
    console.log(`========================================\n`);
  }
}
