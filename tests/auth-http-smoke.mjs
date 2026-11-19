import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const { encode } = require("next-auth/jwt");
const secret = randomBytes(32).toString("base64url");
let assertions = 0;
function pass(label) { assertions += 1; console.log(`PASS ${label}`); }

async function withServer(port, configured, run) {
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    env: { ...process.env, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base,
      NEXTAUTH_SECRET: secret, GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: configured ? "test-only-google-secret" : "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stdout.on("data", (data) => { logs += data.toString(); });
  server.stderr.on("data", (data) => { logs += data.toString(); });
  try {
    let ready = false;
    for (let i = 0; i < 100; i += 1) {
      if (server.exitCode !== null) throw new Error(`Test server exited: ${logs.slice(-1000)}`);
      try {
        const response = await fetch(`${base}/api/account`, { signal: AbortSignal.timeout(1000) });
        if (response.status === 401) { ready = true; break; }
      } catch { /* Wait for server startup. */ }
      await delay(100);
    }
    assert.ok(ready, "Local auth test server did not become ready");
    await run(base);
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await once(server, "exit");
    }
  }
}

await withServer(3033, true, async (base) => {
  const anonymous = await fetch(`${base}/api/account`);
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get("cache-control"), /private.*no-store/);
  assert.deepEqual(Object.keys(await anonymous.json()), ["error"]);
  pass("anonymous account data is rejected without a cacheable profile");

  const page = await fetch(`${base}/account`, { redirect: "manual" });
  assert.equal(page.status, 307);
  assert.ok(page.headers.get("location").endsWith("/signin"));
  pass("account page redirects signed-out visitors");

  const providers = await (await fetch(`${base}/api/auth/providers`)).json();
  assert.deepEqual(Object.keys(providers), ["google"]);
  assert.ok(providers.google.callbackUrl.endsWith("/api/auth/callback/google"));
  assert.ok(!JSON.stringify(providers).includes("test-only-google-secret"));
  pass("only Google is offered and provider secrets are not returned");

  // Synthetic encrypted sessions test our server boundary. They do not stand
  // in for Google's real consent/token/JWKS verification or client setup.
  const aliceToken = await encode({ secret, token: { sub: "google:alice", name: "Alice", email: "alice@example.test" }, maxAge: 3600 });
  const bobToken = await encode({ secret, token: { sub: "google:bob", name: "Bob", email: "bob@example.test" }, maxAge: 3600 });
  const aliceCookie = `next-auth.session-token=${aliceToken}`;
  for (const [token, id] of [[aliceToken, "alice"], [bobToken, "bob"]]) {
    const response = await fetch(`${base}/api/account`, { headers: { cookie: `next-auth.session-token=${token}` } });
    assert.equal(response.status, 200);
    const account = await response.json();
    assert.deepEqual(account.user, { id: `google:${id}`, name: id === "alice" ? "Alice" : "Bob", email: `${id}@example.test` });
    assert.equal(account.bookStorage, "this-browser");
  }
  pass("two valid app sessions resolve to their own identity");

  const forged = await encode({ secret: "wrong-signing-key", token: { sub: "google:alice" }, maxAge: 3600 });
  for (const token of [forged, aliceToken.slice(0, -10) + "tampered"]) {
    assert.equal((await fetch(`${base}/api/account`, { headers: { cookie: `next-auth.session-token=${token}` } })).status, 401);
  }
  const expired = await encode({ secret, token: { sub: "google:alice" }, maxAge: -60 });
  assert.equal((await fetch(`${base}/api/account`, { headers: { cookie: `next-auth.session-token=${expired}` } })).status, 401);
  pass("forged, modified, and expired session cookies cannot read account data");

  const aliceSession = await fetch(`${base}/api/auth/session`, { headers: { cookie: aliceCookie } });
  const sessionData = await aliceSession.json();
  assert.deepEqual(Object.keys(sessionData).sort(), ["expires", "user"]);
  assert.deepEqual(Object.keys(sessionData.user).sort(), ["email", "id", "name"]);
  assert.ok(aliceSession.headers.getSetCookie().some((cookie) => /next-auth\.session-token=/.test(cookie) && /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie)));
  pass("public session exposes only profile fields and uses HTTP-only SameSite cookies");

  const guestHtml = await (await fetch(base)).text();
  const aliceHtml = await (await fetch(base, { headers: { cookie: aliceCookie } })).text();
  const bobHtml = await (await fetch(base, { headers: { cookie: `next-auth.session-token=${bobToken}` } })).text();
  assert.ok(guestHtml.includes('ai-book-studio-session'));
  assert.ok(!guestHtml.includes('ai-book-studio-session:user:google%3Aalice'));
  assert.ok(aliceHtml.includes('ai-book-studio-session:user:google%3Aalice'));
  assert.ok(!aliceHtml.includes('ai-book-studio-session:user:google%3Abob'));
  assert.ok(bobHtml.includes('ai-book-studio-session:user:google%3Abob'));
  assert.ok(!aliceHtml.includes(secret) && !aliceHtml.includes("test-only-google-secret"));
  pass("server selects distinct guest/Alice/Bob workspace keys without exposing secrets");

  const csrfResponse = await fetch(`${base}/api/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  assert.equal(typeof csrfToken, "string");
  const csrfCookies = csrfResponse.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  const update = await fetch(`${base}/api/auth/session`, {
    method: "POST", headers: { cookie: `${aliceCookie}; ${csrfCookies}`, "Content-Type": "application/json" },
    body: JSON.stringify({ csrfToken, data: { sub: "google:bob", email: "bob@example.test", user: { id: "google:bob", name: "Bob" } } }),
  });
  assert.equal(update.status, 200);
  assert.deepEqual((await update.json()).user, { id: "google:alice", name: "Alice", email: "alice@example.test" });
  pass("client session updates cannot change the authenticated identity");

  const noCsrf = await fetch(`${base}/api/auth/signout`, {
    method: "POST", redirect: "manual", headers: { cookie: `${aliceCookie}; ${csrfCookies}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ callbackUrl: "/", json: "true" }),
  });
  assert.ok(!noCsrf.headers.getSetCookie().some((cookie) => /^next-auth\.session-token=;/.test(cookie)));
  pass("sign-out without a CSRF token cannot clear the authenticated session");

  const signout = await fetch(`${base}/api/auth/signout`, {
    method: "POST", headers: { cookie: `${aliceCookie}; ${csrfCookies}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, callbackUrl: "https://evil.example/", json: "true" }),
  });
  assert.equal(signout.status, 200);
  assert.ok((await signout.json()).url.startsWith(base));
  assert.ok(signout.headers.getSetCookie().some((cookie) => /^next-auth\.session-token=;/.test(cookie)));
  pass("valid sign-out clears the cookie and rejects an off-site redirect");
});

await withServer(3034, false, async (base) => {
  const response = await fetch(`${base}/api/auth/providers`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Google sign-in is temporarily unavailable." });
  const signin = await fetch(`${base}/signin`);
  assert.equal(signin.status, 200);
  assert.match(await signin.text(), /Google sign-in is temporarily unavailable/);
  assert.equal((await fetch(base)).status, 200);
  pass("missing credentials fail safely while the guest studio stays available");
});

console.log(`${assertions} HTTP auth checks passed. Real Google OAuth round-trip not tested.`);
