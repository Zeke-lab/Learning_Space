import assert from "node:assert/strict";
import test from "node:test";
import { googleAuthConfigured, isGoogleUserId, safeAuthRedirect, sessionAuthConfigured, signInErrorMessage, verifiedGoogleIdentity } from "../lib/auth-policy.ts";
import { workspaceStorageKey } from "../lib/workspace-storage.ts";

test("requires a verified Google identity and stable subject, not just an email", () => {
  const profile = { sub: "123456", email: "learner@example.com", email_verified: true };
  assert.deepEqual(verifiedGoogleIdentity("google", profile), { id: "google:123456", email: profile.email });
  for (const invalid of [{ ...profile, email_verified: false }, { ...profile, email_verified: "true" }, { ...profile, sub: "" }, { ...profile, email: "invalid" }, { email: profile.email, email_verified: true }, null]) {
    assert.equal(verifiedGoogleIdentity("google", invalid), null);
  }
  assert.equal(verifiedGoogleIdentity("other-provider", profile), null);
});

test("user identity is independent of a Google account email change", () => {
  const before = verifiedGoogleIdentity("google", { sub: "123", email: "old@example.com", email_verified: true });
  const after = verifiedGoogleIdentity("google", { sub: "123", email: "new@example.com", email_verified: true });
  assert.equal(before.id, after.id);
  assert.equal(isGoogleUserId(after.id), true);
  for (const invalid of ["", "123", "google:", "google:../../guest", null]) assert.equal(isGoogleUserId(invalid), false);
});

test("only permits redirects back to the configured origin", () => {
  const base = "https://learning-space-delta.vercel.app";
  assert.equal(safeAuthRedirect("/account", base), `${base}/account`);
  assert.equal(safeAuthRedirect(`${base}/?saved=1`, base), `${base}/?saved=1`);
  for (const target of ["https://evil.example/", "//evil.example/", "\\\\evil.example/", "javascript:alert(1)", "data:text/html,hello", "https://attacker@learning-space-delta.vercel.app/", "https://learning-space-delta.vercel.app.evil.example/"]) {
    assert.equal(safeAuthRedirect(target, base), base);
  }
});

test("configuration requires all credentials, a strong secret, and a safe origin", () => {
  const env = { GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "client-secret", NEXTAUTH_SECRET: "x".repeat(32), NEXTAUTH_URL: "https://learning-space-delta.vercel.app" };
  assert.equal(googleAuthConfigured(env), true);
  assert.equal(googleAuthConfigured({ ...env, NEXTAUTH_URL: "http://localhost:3000" }), true);
  for (const key of Object.keys(env)) assert.equal(googleAuthConfigured({ ...env, [key]: "" }), false);
  for (const origin of ["http://example.com", "https://user:password@example.com", "javascript:bad", "https://example.com/path", "https://example.com?query=1"]) {
    assert.equal(googleAuthConfigured({ ...env, NEXTAUTH_URL: origin }), false);
  }
  assert.equal(googleAuthConfigured({ ...env, NEXTAUTH_SECRET: "short" }), false);
  assert.equal(sessionAuthConfigured({ NEXTAUTH_SECRET: env.NEXTAUTH_SECRET, NEXTAUTH_URL: env.NEXTAUTH_URL }), true);
  assert.equal(sessionAuthConfigured({ NEXTAUTH_SECRET: "short", NEXTAUTH_URL: env.NEXTAUTH_URL }), false);
});

test("guest and individual account workspaces never share storage keys", () => {
  assert.equal(workspaceStorageKey(), "ai-book-studio-session");
  assert.notEqual(workspaceStorageKey("google:alice"), workspaceStorageKey("google:bob"));
  assert.notEqual(workspaceStorageKey("google:alice"), workspaceStorageKey());
  assert.equal(workspaceStorageKey("google:alice"), workspaceStorageKey("google:alice"));
});

test("auth errors never echo arbitrary provider details into the UI", () => {
  assert.equal(signInErrorMessage(undefined), null);
  assert.match(signInErrorMessage("AccessDenied"), /verified Google account/);
  assert.doesNotMatch(signInErrorMessage("secret-token-or-script"), /secret-token-or-script/);
});
