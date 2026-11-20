import nodemailer from "nodemailer";

let transporter;

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function getTransporter() {
  if (transporter) return transporter;

  const user = (process.env.EMAIL_USER || "").trim();
  // Gmail shows app passwords as "abcd efgh ijkl mnop" - spaces must be removed.
  const pass = (process.env.EMAIL_PASSWORD || "").replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("Email service is not configured. Set EMAIL_USER and EMAIL_PASSWORD in backend/.env.");
  }

  const service = (process.env.EMAIL_SERVICE || "gmail").trim().toLowerCase();
  const host = (process.env.EMAIL_HOST || "").trim();

  const base = host
    ? {
        host,
        port: Number(process.env.EMAIL_PORT) || 465,
        secure: String(process.env.EMAIL_SECURE ?? "true") !== "false",
      }
    : service === "gmail"
    ? { host: "smtp.gmail.com", port: 465, secure: true }
    : { service };

  transporter = nodemailer.createTransport({
    ...base,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  return transporter;
}

/** Checks SMTP login once at server start so problems show clearly in the console. */
export async function verifyEmailTransport() {
  try {
    await getTransporter().verify();
    console.log("Email service ready: SMTP login OK for", process.env.EMAIL_USER);
    return true;
  } catch (error) {
    transporter = undefined;
    console.error(
      "EMAIL SERVICE NOT WORKING:",
      error?.message || error,
      "\n -> Check EMAIL_USER / EMAIL_PASSWORD in backend/.env. For Gmail use a 16-character App Password (2-Step Verification must be ON)."
    );
    return false;
  }
}

/**
 * Builds the link placed in the verification email.
 * It must be a normal https/http link so it is tappable in Gmail and other mail apps
 * (custom schemes such as myapp:// are not clickable in most email clients).
 */
export function buildVerificationUrl(token, baseUrl) {
  const encodedToken = encodeURIComponent(token);
  const frontend = (process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
  const backend = (process.env.BACKEND_PUBLIC_URL || "").trim().replace(/\/+$/, "").replace(/\/api$/, "");

  if (backend) return `${backend}/api/auth/verify-email?token=${encodedToken}`;
  if (frontend) return `${frontend}/verify-email?token=${encodedToken}`;
  if (baseUrl) return `${String(baseUrl).replace(/\/+$/, "")}/api/auth/verify-email?token=${encodedToken}`;
  return `myapp://verify-email?token=${encodedToken}`;
}

export async function sendVerificationEmail(email, name, token, baseUrl) {
  const verificationUrl = buildVerificationUrl(token, baseUrl);
  const safeName = escapeHtml(name || "Student");
  const safeUrl = escapeHtml(verificationUrl);
  const user = (process.env.EMAIL_USER || "").trim();

  return getTransporter().sendMail({
    from: `"Campus Hub" <${user}>`,
    to: email,
    subject: "Verify your Campus Hub account",
    text: `Hello ${name || "Student"},\n\nThanks for registering at Campus Hub. Tap the link below to verify your email:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create this account, ignore this email.\n\nCampus Hub Team`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#183B56"><h2 style="color:#1769AA">Welcome to Campus Hub</h2><p>Hello ${safeName},</p><p>Thanks for registering. Tap the button below to verify your email address and activate your account.</p><p style="text-align:center;margin:30px 0"><a href="${safeUrl}" style="background:#1769AA;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold">Tap to Verify Email</a></p><p style="font-size:12px;color:#718096">If the button does not work, copy and paste this link into your browser:<br/><a href="${safeUrl}">${safeUrl}</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p><p>Regards,<br/>Campus Hub Team</p></div>`,
  });
}
