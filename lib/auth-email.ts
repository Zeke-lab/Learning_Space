import "server-only";
import type { Mail } from "./account-service";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim());
}

export async function sendAuthEmail(mail: Mail) {
  if (!emailConfigured()) throw new Error("Email delivery unavailable");
  const verification = mail.purpose === "verify_email";
  // Fixed application origin, never a visitor-supplied Host or redirect URL.
  const link = new URL(verification ? "/verify-email" : "/reset-password", process.env.NEXTAUTH_URL);
  // Fragment is not sent in HTTP requests or Referer headers. GET never consumes a link.
  link.hash = new URLSearchParams({ token: mail.token }).toString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `auth/${mail.id}` },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [mail.email],
      subject: verification ? "Verify your Learning Space email" : "Reset your Learning Space password",
      text: `${verification ? "Verify your email" : "Choose a new password"}:\n\n${link.href}\n\nThis link expires in ${verification ? "60" : "20"} minutes and works once. ${verification ? "Enter the password you chose when signing up." : "Resetting your password signs out existing sessions."}\n\nIf you did not request this, ignore this email.` }),
  });
  if (!response.ok) throw new Error("Email delivery unavailable");
}
