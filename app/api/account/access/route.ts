import { z } from "zod";
import { accounts, authRateLimit, databaseAuthConfigured } from "@/lib/account-store";
import { emailConfigured } from "@/lib/auth-email";
import { emailInput, passwordInput, registrationInput, tokenInput } from "@/lib/password-security";
import { sessionAuthConfigured } from "@/lib/auth-policy";
import { authEmailPolicy } from "@/lib/auth-email-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const input = z.discriminatedUnion("action", [
  registrationInput.extend({ action: z.literal("signup") }),
  z.object({ action: z.enum(["forgot", "resend"]), email: emailInput }),
  z.object({ action: z.enum(["verify", "reset"]), token: tokenInput, password: passwordInput }),
]);
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
function reply(message: string, status = 200) { return Response.json({ message }, { status, headers }); }

export async function POST(request: Request) {
  if (!sessionAuthConfigured(process.env)) return reply("Account registration is temporarily unavailable.", 503);
  const origin = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : "";
  if (!origin || request.headers.get("origin") !== origin) return reply("Please submit this form from Learning Space.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply("Invalid request.", 415);
  if (!databaseAuthConfigured()) return reply("Account registration is temporarily unavailable.", 503);
  try {
    // Bound the actual stream, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply("Invalid request.", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return reply("Request is too large.", 413); }
      chunks.push(value);
    }
    let data;
    try { data = input.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
    catch { return reply("Invalid request.", 400); }
    if (!data.success) return reply("Check your details. Passwords must contain 15–128 characters.", 400);
    const value = data.data;
    if (!await authRateLimit("access-global", "all", 60, 1) ||
        !await authRateLimit(value.action, "email" in value ? value.email : value.token, 5)) {
      return reply("Too many attempts. Please wait 15 minutes and try again.", 429);
    }
    if (value.action === "signup" || value.action === "forgot" || value.action === "resend") {
      if (!emailConfigured()) return reply("Email delivery is being connected. Please use Google sign-in for now.", 503);
      if (!authEmailPolicy(process.env).allows(value.email)) return reply("Email signup and recovery are currently limited to the registered test account. Please use Google sign-in for now.", 503);
      if (value.action === "signup") await accounts().register(value.name, value.email, value.password);
      else await accounts().requestEmail(value.email, value.action === "forgot" ? "reset_password" : "verify_email");
      return reply("If this address is eligible, an email with the next steps will arrive shortly. Check your spam folder too.");
    }
    if (!("token" in value)) return reply("Invalid request.", 400);
    const success = await accounts().consume(value.token, value.action === "verify" ? "verify_email" : "reset_password", value.password);
    if (!success) return reply("This link is invalid, expired, or already used. For email verification, also check your signup password.", 400);
    return reply(value.action === "verify" ? "Email verified. You can now sign in." : "Password updated. Please sign in with your new password.");
  } catch {
    // Never log request bodies, tokens, passwords, database errors or provider responses.
    return reply("That could not finish. Please try again shortly.", 503);
  }
}
