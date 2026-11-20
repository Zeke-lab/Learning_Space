import { z } from "zod";

const googleIdentitySchema = z.object({
  sub: z.string().min(1).max(255).regex(/^[A-Za-z0-9_-]+$/),
  email: z.string().email(),
  email_verified: z.literal(true),
});

export function verifiedGoogleIdentity(provider: string | undefined, profile: unknown) {
  if (provider !== "google") return null;
  const parsed = googleIdentitySchema.safeParse(profile);
  return parsed.success ? { id: `google:${parsed.data.sub}`, email: parsed.data.email } : null;
}

export function safeAuthRedirect(url: string, baseUrl: string) {
  try {
    const base = new URL(baseUrl);
    const target = new URL(url, base);
    if (target.origin === base.origin && !target.username && !target.password) return target.href;
  } catch {
    // Malformed or off-site callback URLs return to the configured origin.
  }
  return baseUrl;
}

export function sessionAuthConfigured(env: Record<string, string | undefined>) {
  if ((env.NEXTAUTH_SECRET?.length ?? 0) < 32 || !env.NEXTAUTH_URL) return false;
  try {
    const url = new URL(env.NEXTAUTH_URL);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return (url.protocol === "https:" || (local && url.protocol === "http:")) &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function googleAuthConfigured(env: Record<string, string | undefined>) {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim() && sessionAuthConfigured(env));
}

export function isGoogleUserId(value: unknown): value is string {
  return typeof value === "string" && /^google:[A-Za-z0-9_-]{1,255}$/.test(value);
}

export function signInErrorMessage(error: string | undefined) {
  if (!error) return null;
  if (error === "AccessDenied") return "Google could not verify this account. Please use a verified Google account.";
  if (error === "Configuration") return "Google sign-in is temporarily unavailable. Please try again later.";
  return "Sign-in did not finish. Please try again.";
}
