// Explicit, opt-in integration check. Creates synthetic .invalid accounts and
// removes only those exact UUID/email pairs in finally. Sends no external email.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { connectionConfig, supabaseUrl } from "../db/supabase-config.mjs";
import { createAccountService } from "../lib/account-service.ts";
import { digestToken } from "../lib/password-security.ts";

if (!process.argv.includes("--allow-hosted-test")) throw new Error("Requires --allow-hosted-test; read this file before running.");
process.loadEnvFile(".env.local");
const admin = new pg.Client(connectionConfig(supabaseUrl("postgres", process.env.SUPABASE_DB_PASSWORD), "postgres"));
const pool = new pg.Pool({ ...connectionConfig(process.env.DATABASE_AUTH_URL, "learning_space_authenticator"), max: 2 });
const tag = randomBytes(10).toString("hex");
const emails = [`auth-smoke-${tag}-alice@example.invalid`, `auth-smoke-${tag}-bob@example.invalid`];
const password = randomBytes(24).toString("base64url");
const replacement = randomBytes(24).toString("base64url");
const base = "http://127.0.0.1:3036";
const mails = [];
const records = [];
let server;
let count = 0;
function pass(label) { count++; console.log(`PASS ${label}`); }
const transaction = async run => {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await run(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
};
const service = createAccountService(transaction, async mail => { mails.push(mail); });

async function access(body, origin = base) {
  const response = await fetch(`${base}/api/account/access`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { response, data: await response.json() };
}
async function csrf() {
  const response = await fetch(`${base}/api/auth/csrf`);
  const cookies = response.headers.getSetCookie().map(item => item.split(";")[0]).join("; ");
  return { cookies, token: (await response.json()).csrfToken };
}
async function login(email, value) {
  const protection = await csrf();
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: protection.cookies },
    body: new URLSearchParams({ csrfToken: protection.token, email, password: value, json: "true", callbackUrl: `${base}/account` }),
  });
  const cookies = response.headers.getSetCookie();
  return { response, cookies, session: cookies.filter(item => /^next-auth\.session-token(?:\.\d+)?=/.test(item)).map(item => item.split(";")[0]).join("; ") };
}
try {
  await admin.connect();
  for (const [index, email] of emails.entries()) {
    await service.register(`Auth smoke ${index}`, email, password);
    const record = (await admin.query("SELECT user_id FROM learning_space_auth.password_credentials WHERE login_email=$1", [email])).rows[0];
    assert.ok(record);
    records.push({ id: record.user_id, email });
  }
  pass("restricted hosted connection creates permanent accounts and captures test email in memory");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3036"], {
    env: { ...process.env, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base, RESEND_API_KEY: "", AUTH_EMAIL_FROM: "" },
    stdio: ["ignore", "ignore", "ignore"],
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Integration server exited");
    try { if ((await fetch(`${base}/api/account`, { signal: AbortSignal.timeout(1000) })).status === 401) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready);
  assert.equal((await access({ action: "signup", name: "Test", email: emails[0], password }, "https://attacker.invalid")).response.status, 403);
  assert.equal((await access({ action: "signup", name: "Test", email: emails[0], password })).response.status, 503);
  pass("cross-origin requests are rejected and missing sender fails safely before signup writes");
  assert.equal((await login(emails[0], password)).session, "");
  pass("unverified account cannot obtain a login session");
  for (const mail of mails) {
    const attempts = await Promise.all([access({ action: "verify", token: mail.token, password }), access({ action: "verify", token: mail.token, password })]);
    assert.deepEqual(attempts.map(item => item.response.status).sort(), [200,400]);
    assert.equal((await access({ action: "verify", token: mail.token, password })).response.status, 400);
  }
  pass("real verification endpoint allows only one concurrent completion and rejects reuse");
  const sessions = [];
  for (const [index, email] of emails.entries()) {
    const signedIn = await login(email, password);
    assert.ok(signedIn.session);
    assert.ok(signedIn.cookies.some(cookie => /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie)));
    const response = await fetch(`${base}/api/account`, { headers: { Cookie: signedIn.session } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.id, records[index].id);
    assert.equal(body.user.email, email);
    assert.deepEqual(Object.keys(body.user).sort(), ["email", "id", "name"]);
    assert.match(response.headers.get("cache-control"), /no-store/);
    sessions.push(signedIn.session);
  }
  pass("two credentials logins receive separate UUID profiles and protected cookies over HTTP");
  assert.equal((await login(emails[0], replacement)).session, "");
  pass("wrong password cannot obtain a session");
  await service.requestEmail(emails[0], "reset_password");
  const recovery = mails.at(-1);
  await fetch(`${base}/reset-password`);
  assert.equal((await admin.query("SELECT consumed_at FROM learning_space_auth.email_challenges WHERE token_digest=$1", [digestToken(recovery.token)])).rows[0].consumed_at, null);
  assert.equal((await access({ action: "reset", token: recovery.token, password: replacement })).response.status, 200);
  assert.equal((await access({ action: "reset", token: recovery.token, password })).response.status, 400);
  assert.equal((await fetch(`${base}/api/account`, { headers: { Cookie: sessions[0] } })).status, 401);
  assert.equal((await fetch(`${base}/api/account`, { headers: { Cookie: sessions[1] } })).status, 200);
  assert.equal((await login(emails[0], password)).session, "");
  assert.ok((await login(emails[0], replacement)).session);
  pass("GET does not consume recovery links; POST replaces password and revokes only that account's sessions");
  const protection = await csrf();
  const signout = await fetch(`${base}/api/auth/signout`, {
    method: "POST", headers: { Cookie: `${sessions[1]}; ${protection.cookies}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: protection.token, callbackUrl: base, json: "true" }),
  });
  assert.ok(signout.headers.getSetCookie().some(cookie => /^next-auth\.session-token=;/.test(cookie)));
  pass("CSRF-protected signout clears the credentials session cookie");
  console.log(`${count} hosted account HTTP checks passed. External inbox delivery and Google consent are not tested by this script.`);
} catch {
  console.error("Hosted account test failed. Inspect assertions locally; no credentials or request bodies are printed.");
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) { server.kill(); await once(server, "exit"); }
  // UUID + exact generated .invalid email must both match. Never target existing user accounts.
  for (const record of records) {
    await admin.query("DELETE FROM learning_space.users WHERE id=$1 AND email=$2", [record.id,record.email]);
  }
  // Rate-limit entries expire automatically; never delete shared global counters.
  await pool.end();
  await admin.end();
  console.log("Temporary hosted test accounts removed.");
}
