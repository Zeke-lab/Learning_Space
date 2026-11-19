import "server-only";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { googleAuthConfigured, isGoogleUserId, safeAuthRedirect, verifiedGoogleIdentity } from "./auth-policy";

export function getAuthOptions(): NextAuthOptions | null {
  if (!googleAuthConfigured(process.env)) return null;
  return {
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
    useSecureCookies: new URL(process.env.NEXTAUTH_URL!).protocol === "https:",
    providers: [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
      checks: ["pkce", "state", "nonce"],
      allowDangerousEmailAccountLinking: false,
    })],
    pages: { signIn: "/signin", error: "/signin" },
    callbacks: {
      signIn({ account, profile }) {
        return verifiedGoogleIdentity(account?.provider, profile) !== null;
      },
      jwt({ token, account, profile, user }) {
        if (account) {
          const identity = verifiedGoogleIdentity(account.provider, profile);
          if (!identity) throw new Error("Unverified Google identity");
          // Keep provider access/refresh/ID tokens out of the app session.
          return { sub: identity.id, email: identity.email, name: user.name ?? null };
        }
        // Ignore client-supplied session update fields; the subject is immutable.
        return token;
      },
      session({ session, token }) {
        if (!isGoogleUserId(token.sub)) throw new Error("Invalid account session");
        return {
          expires: session.expires,
          user: {
            id: token.sub,
            name: typeof token.name === "string" ? token.name : null,
            email: typeof token.email === "string" ? token.email : null,
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
