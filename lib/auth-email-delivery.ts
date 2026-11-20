// Node/server transport. The application imports this through auth-email.ts.
import type { Mail } from "./account-service.ts";
import { authEmailPolicy } from "./auth-email-policy.ts";
import { sessionAuthConfigured } from "./auth-policy.ts";

export async function deliverAuthEmail(env: Record<string, string | undefined>, mail: Mail) {
  if (!authEmailPolicy(env).allows(mail.email) || !sessionAuthConfigured(env)) throw new Error("Email delivery unavailable");
  const verification = mail.purpose === "verify_email";
  const link = new URL(verification ? "/verify-email" : "/reset-password", env.NEXTAUTH_URL);
  // The secret fragment is not sent in HTTP requests or Referer headers.
  link.hash = new URLSearchParams({ token: mail.token }).toString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `auth/${mail.id}` },
    body: JSON.stringify({ from: env.AUTH_EMAIL_FROM, to: [mail.email],
      subject: verification ? "Verify your Learning Space email" : "Reset your Learning Space password",
      text: `${verification ? "Verify your email" : "Choose a new password"}:\n\n${link.href}\n\nThis link expires in ${verification ? "60" : "20"} minutes and works once. ${verification ? "Enter the password you chose when signing up." : "Resetting your password signs out existing sessions."}\n\nIf you did not request this, ignore this email.` }),
  });
  if (!response.ok) throw new Error("Email delivery unavailable");
  const result = await response.json();
  if (typeof result.id !== "string") throw new Error("Email delivery unavailable");
  return result.id as string;
}
