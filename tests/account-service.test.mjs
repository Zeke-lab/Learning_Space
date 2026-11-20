import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createAccountService } from "../lib/account-service.ts";
import { createAuthLimiter } from "../lib/auth-rate-limit.ts";
import { checkPassword, digestToken, hashPassword, passwordInput, registrationInput } from "../lib/password-security.ts";

test("account lifecycle under the restricted authentication role", async t => {
  const db = new PGlite();
  const mail = [];
  const password = "A long learning phrase !@# မြန်မာ";
  const replacement = "Another unique learning phrase !@#";
  try {
    for (const file of ["001_initial.sql", "002_account_identities.sql"]) {
      await db.exec(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec(`CREATE ROLE learning_space_authenticator NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA learning_space,learning_space_auth TO learning_space_authenticator;
      GRANT SELECT,INSERT,UPDATE ON learning_space.users TO learning_space_authenticator;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA learning_space_auth TO learning_space_authenticator;`);
    await db.exec(await readFile(new URL("../db/migrations/003_auth_rate_limits.sql", import.meta.url), "utf8"));
    const transaction = async run => {
      await db.exec("BEGIN; SET LOCAL ROLE learning_space_authenticator;");
      try { const result = await run(db); await db.exec("COMMIT"); return result; }
      catch (error) { await db.exec("ROLLBACK"); throw error; }
    };
    const service = createAccountService(transaction, async item => { mail.push(item); });
    let alice, bob;
    await t.test("authentication limits persist across instances and expire without storing email", async () => {
      const first = createAuthLimiter(transaction, "test-only-limit-secret");
      const second = createAuthLimiter(transaction, "test-only-limit-secret");
      assert.equal(await first("login", "alice@example.test", 2), true);
      assert.equal(await second("login", "alice@example.test", 2), true);
      assert.equal(await first("login", "alice@example.test", 2), false);
      assert.equal(await first("login", "bob@example.test", 2), true);
      assert.equal(await first("reset", "alice@example.test", 2), true);
      assert.equal(JSON.stringify((await db.query("SELECT * FROM learning_space_auth.rate_limits")).rows).includes("alice@example.test"), false);
      await db.query("UPDATE learning_space_auth.rate_limits SET expires_at=now()-interval '1 minute'");
      assert.equal(await second("login", "alice@example.test", 2), true);
      assert.equal((await db.query("SELECT hits FROM learning_space_auth.rate_limits")).rows[0].hits, 1);
    });
    await t.test("signup normalizes inputs and stores only a salted Argon2id hash", async () => {
      const input = registrationInput.parse({ name: "  Alice မြန်မာ ", email: " ALICE@Example.test ", password });
      await service.register(input.name, input.email, input.password);
      const stored = (await db.query("SELECT * FROM learning_space_auth.password_credentials")).rows[0];
      alice = stored.user_id;
      assert.match(alice, /^[a-f0-9-]{36}$/);
      assert.match(stored.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      assert.notEqual(stored.password_hash, password);
      assert.equal(await checkPassword(stored.password_hash, password), true);
      assert.equal(await service.login(input.email, password), null);
      assert.equal(mail.length, 1);
      const challenge = (await db.query("SELECT * FROM learning_space_auth.email_challenges")).rows[0];
      assert.equal(challenge.token_digest, digestToken(mail[0].token));
      assert.equal(JSON.stringify(challenge).includes(mail[0].token), false);
    });
    await t.test("repeat signup cannot overwrite a pending password or profile", async () => {
      await service.register("Attacker", "alice@example.test", replacement);
      assert.equal(await service.consume(mail.at(-1).token, "verify_email", replacement), false);
      assert.equal((await db.query("SELECT name FROM learning_space.users WHERE id=$1", [alice])).rows[0].name, "Alice မြန်မာ");
    });
    await t.test("verification requires the signup password and is single use", async () => {
      assert.equal(await service.consume(mail[0].token, "reset_password", replacement), false);
      assert.equal(await service.consume(mail[0].token, "verify_email", "wrong password phrase"), false);
      assert.equal(await service.consume(mail[0].token, "verify_email", password), true);
      assert.equal(await service.consume(mail[0].token, "verify_email", password), false);
      assert.equal(await service.consume(mail[1].token, "verify_email", password), false);
      assert.equal((await service.login("alice@example.test", password)).id, alice);
      assert.equal(await service.login("alice@example.test", replacement), null);
      assert.equal(await service.login("unknown@example.test", password), null);
    });
    await t.test("unknown emails and verified repeat registration do not issue links", async () => {
      const count = mail.length;
      await service.requestEmail("unknown@example.test", "reset_password");
      await service.requestEmail("alice@example.test", "verify_email");
      await service.register("Changed", "alice@example.test", replacement);
      assert.equal(mail.length, count);
    });
    await t.test("Google identity is stable and never auto-linked by email", async () => {
      const google = await service.google("google_subject", "alice@example.test", "Google Alice");
      assert.notEqual(google.id, alice);
      const again = await service.google("google_subject", "changed@example.test", "New name");
      assert.equal(again.id, google.id);
      assert.equal(again.email, "changed@example.test");
      assert.equal((await db.query("SELECT count(*) FROM learning_space_auth.identities")).rows[0].count, 1);
    });
    await t.test("two accounts remain separate and database contexts do not escape transactions", async () => {
      await service.register("Bob", "bob@example.test", password);
      await service.consume(mail.at(-1).token, "verify_email", password);
      bob = (await service.login("bob@example.test", password)).id;
      assert.notEqual(bob, alice);
      assert.equal((await service.session(alice, 1)).email, "alice@example.test");
      assert.equal((await service.session(bob, 1)).email, "bob@example.test");
      await transaction(async client => assert.equal((await client.query("SELECT count(*) FROM learning_space.users")).rows[0].count, 0));
      await assert.rejects(transaction(client => client.query("SELECT * FROM learning_space.books")), /permission denied/);
    });
    await t.test("reset changes the password, consumes links, and revokes existing sessions", async () => {
      await service.requestEmail("alice@example.test", "reset_password");
      const first = mail.at(-1).token;
      await service.requestEmail("alice@example.test", "reset_password");
      const second = mail.at(-1).token;
      assert.equal(await service.consume(first, "verify_email", password), false);
      assert.equal(await service.consume(first, "reset_password", replacement), true);
      assert.equal(await service.consume(first, "reset_password", password), false);
      assert.equal(await service.consume(second, "reset_password", password), false);
      assert.equal(await service.login("alice@example.test", password), null);
      assert.equal((await service.login("alice@example.test", replacement)).sessionVersion, 2);
      assert.equal(await service.session(alice, 1), null);
      assert.equal((await service.session(alice, 2)).id, alice);
      assert.equal((await service.session(bob, 1)).id, bob);
    });
    await t.test("expired links, unverified recovery and disabled accounts are rejected", async () => {
      await service.requestEmail("alice@example.test", "reset_password");
      const expired = mail.at(-1).token;
      await db.query("UPDATE learning_space_auth.email_challenges SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE token_digest=$1", [digestToken(expired)]);
      assert.equal(await service.consume(expired, "reset_password", password), false);
      await service.register("Pending", "pending@example.test", password);
      const count = mail.length;
      await service.requestEmail("pending@example.test", "reset_password");
      assert.equal(mail.length, count);
      await db.query("UPDATE learning_space.users SET disabled_at=now() WHERE id=$1", [alice]);
      assert.equal(await service.session(alice, 2), null);
      assert.equal(await service.login("alice@example.test", replacement), null);
    });
    await t.test("failed email delivery invalidates its link without overwriting credentials", async () => {
      let failedToken;
      const failing = createAccountService(transaction, async item => { failedToken = item.token; throw new Error("provider failure"); });
      await assert.rejects(failing.requestEmail("bob@example.test", "reset_password"), /Email delivery unavailable/);
      assert.equal((await db.query("SELECT count(*) FROM learning_space_auth.email_challenges WHERE token_digest=$1", [digestToken(failedToken)])).rows[0].count, 0);
      assert.equal((await service.login("bob@example.test", password)).id, bob);
    });
  } finally { await db.close(); }
});

test("password policy allows spaces, Unicode and symbols without trimming passwords", async () => {
  assert.equal(passwordInput.safeParse("short").success, false);
  assert.equal(passwordInput.safeParse("x".repeat(129)).success, false);
  const password = "  မြန်မာ long phrase !@#  ";
  assert.equal(passwordInput.parse(password), password);
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await checkPassword(first, password.trim()), false);
});
