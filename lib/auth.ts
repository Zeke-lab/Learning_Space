import "server-only";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { googleAuthConfigured, isGoogleUserId, safeAuthRedirect, sessionAuthConfigured, verifiedGoogleIdentity } from "./auth-policy";
import { accounts, authRateLimit, databaseAuthConfigured } from "./account-store";
import { emailInput, passwordInput } from "./password-security";

export function getAuthOptions(): NextAuthOptions | null {
  if (!sessionAuthConfigured(process.env) || (!googleAuthConfigured(process.env) && !databaseAuthConfigured())) return null;
  return {
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
    useSecureCookies: new URL(process.env.NEXTAUTH_URL!).protocol === "https:",
    providers: [...(googleAuthConfigured(process.env) ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
      checks: ["pkce", "state", "nonce"],
      allowDangerousEmailAccountLinking: false,
    })] : []), ...(databaseAuthConfigured() ? [CredentialsProvider({
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const email = emailInput.safeParse(credentials?.email);
        const password = passwordInput.safeParse(credentials?.password);
        if (!email.success || !password.success) return null;
        if (!await authRateLimit("login-global", "all", 120, 1) || !await authRateLimit("login", email.data, 10)) return null;
        return accounts().login(email.data, password.data);
      },
    })] : [])],
    pages: { signIn: "/signin", error: "/signin" },
    callbacks: {
      signIn({ account, profile }) {
        if (account?.provider === "credentials") return databaseAuthConfigured();
        return verifiedGoogleIdentity(account?.provider, profile) !== null;
      },
      async jwt({ token, account, profile, user }) {
        if (account) {
          if (account.provider === "credentials") {
            const signedIn = user as typeof user & { sessionVersion: number };
            return { sub: signedIn.id, email: signedIn.email, name: signedIn.name, sessionVersion: signedIn.sessionVersion };
          }
          const identity = verifiedGoogleIdentity(account.provider, profile);
          if (!identity) throw new Error("Unverified Google identity");
          if (databaseAuthConfigured()) {
            const saved = await accounts().google(identity.id.slice(7), identity.email, user.name ?? null);
            if (!saved) throw new Error("Account unavailable");
            return { sub: saved.id, email: saved.email, name: saved.name, sessionVersion: saved.sessionVersion, workspaceId: identity.id };
          }
          // Keep provider access/refresh/ID tokens out of the app session.
          return { sub: identity.id, email: identity.email, name: user.name ?? null };
        }
        if (databaseAuthConfigured()) {
          // Legacy cookies must sign in again before receiving a permanent UUID.
          if (!token.sub || !/^[0-9a-f-]{36}$/.test(token.sub) || typeof token.sessionVersion !== "number") return {};
          const saved = await accounts().session(token.sub, token.sessionVersion);
          if (!saved) return {};
          return { sub: saved.id, email: saved.email, name: saved.name, sessionVersion: saved.sessionVersion, workspaceId: token.workspaceId };
        }
        // Ignore client-supplied session update fields; the subject is immutable.
        return token;
      },
      session({ session, token }) {
        if (!token.sub || !(databaseAuthConfigured() ? /^[0-9a-f-]{36}$/.test(token.sub) : isGoogleUserId(token.sub))) {
          // NextAuth serializes this as null; revoked cookies grant no account access.
          return null as unknown as typeof session;
        }
        return {
          expires: session.expires,
          user: {
            id: token.sub,
            name: typeof token.name === "string" ? token.name : null,
            email: typeof token.email === "string" ? token.email : null,
            ...(typeof token.workspaceId === "string" ? { workspaceId: token.workspaceId } : {}),
          },
        };
      },
      redirect({ url, baseUrl }) { return safeAuthRedirect(url, baseUrl); },
    },
    logger: {
      // SDK metadata can include provider responses. Log codes only.
      error(code) { console.error("Authentication error", code); },
      warn(code) { console.warn("Authentication warning", code); },
      debug() {},
    },
  };
}

export async function getAppSession() {
  const options = getAuthOptions();
  return options ? getServerSession(options) : null;
}
