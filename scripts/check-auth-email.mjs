// Opt-in real delivery test. Sends exactly two emails to the configured test
// recipient, exercises one temporary account, and removes that account afterward.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import { connectionConfig, supabaseUrl } from "../db/supabase-config.mjs";
import { createAccountService } from "../lib/account-service.ts";
import { deliverAuthEmail } from "../lib/auth-email-delivery.ts";
import { authEmailPolicy } from "../lib/auth-email-policy.ts";

if (!process.argv.includes("--send-test-emails")) throw new Error("Requires --send-test-emails and authorization to email the test recipient.");
process.loadEnvFile(".env.local");
const email = process.env.AUTH_EMAIL_TEST_RECIPIENT?.trim().toLowerCase();
assert.ok(email && authEmailPolicy(process.env).allows(email), "Configure an allowed test recipient privately first.");
const owner = new pg.Client(connectionConfig(supabaseUrl("postgres",process.env.SUPABASE_DB_PASSWORD),"postgres"));
const pool = new pg.Pool({ ...connectionConfig(process.env.DATABASE_AUTH_URL,"learning_space_authenticator"), max: 1 });
const transaction = async run => {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await run(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
};
const mails = [];
const receipts = [];
const password = randomBytes(24).toString("base64url");
const replacement = randomBytes(24).toString("base64url");
const name = `Temporary email check ${randomBytes(8).toString("hex")}`;
let id;
let registered = false;
let stage = "database preflight";
try {
  await owner.connect();
  const existing = await owner.query("SELECT user_id FROM learning_space_auth.password_credentials WHERE login_email=$1",[email]);
  assert.equal(existing.rows.length,0,"Existing password account detected; it will not be overwritten.");
  const service = createAccountService(transaction, async mail => {
    const messageId = await deliverAuthEmail(process.env,mail);
    mails.push(mail);
    receipts.push({purpose:mail.purpose,messageId});
  });
  registered = true;
  stage = "verification delivery";
  await service.register(name,email,password);
  id = (await owner.query("SELECT user_id FROM learning_space_auth.password_credentials WHERE login_email=$1",[email])).rows[0]?.user_id;
  assert.ok(id);
  assert.equal(await service.login(email,password),null);
  assert.equal(await service.consume(mails[0].token,"verify_email",password),true);
  assert.equal((await service.login(email,password)).id,id);
  console.log("PASS verification email accepted by Resend; verification enables password sign-in.");
  stage = "recovery delivery";
  await service.requestEmail(email,"reset_password");
  assert.equal(await service.consume(mails[1].token,"reset_password",replacement),true);
  assert.equal(await service.login(email,password),null);
  assert.equal((await service.login(email,replacement)).id,id);
  assert.equal(await service.session(id,1),null);
  console.log("PASS recovery email accepted by Resend; reset replaces password and revokes old sessions.");
  await mkdir("tmp",{recursive:true});
  await writeFile("tmp/email-sender-delivery.json",JSON.stringify({checkedAt:new Date().toISOString(),recipient:email,messages:receipts,scope:"Local app; own-recipient testing only",delivery:"API accepted; confirm Delivered status separately in Resend"},null,2));
} catch (error) {
  const reason = error.message === "Email delivery unavailable" ? "Email delivery unavailable" : error.code === "ERR_ASSERTION" ? "Account assertion failed" : "Connection or service failed";
  console.error(`Email check failed at ${stage}: ${reason}. No credentials are printed.`);
  process.exitCode = 1;
} finally {
  if (registered || id) {
    // A generated name + exact owner email bounds cleanup to this temporary test.
    await owner.query("DELETE FROM learning_space.users WHERE email=$1 AND name=$2",[email,name]);
    console.log("Temporary email-test account removed; inbox links no longer grant access.");
  }
  await pool.end();
  await owner.end();
}
