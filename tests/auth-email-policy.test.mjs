import assert from "node:assert/strict";
import test from "node:test";
import { authEmailPolicy } from "../lib/auth-email-policy.ts";

test("shared Resend sender requires an explicit test recipient and blocks other addresses", () => {
  const env = { RESEND_API_KEY: "test-only-key", AUTH_EMAIL_FROM: "Learning Space <onboarding@resend.dev>" };
  assert.equal(authEmailPolicy(env).configured, false);
  const policy = authEmailPolicy({ ...env, AUTH_EMAIL_TEST_RECIPIENT: " OWNER@example.test " });
  assert.equal(policy.configured, true);
  assert.equal(policy.testMode, true);
  assert.equal(policy.allows("owner@EXAMPLE.test"), true);
  assert.equal(policy.allows("other@example.test"), false);
});

test("custom sender can accept public recipients only when test restriction is removed", () => {
  const env = { RESEND_API_KEY: "test-only-key", AUTH_EMAIL_FROM: "Learning Space <accounts@example.test>" };
  assert.equal(authEmailPolicy(env).testMode, false);
  assert.equal(authEmailPolicy(env).allows("learner@example.test"), true);
  assert.equal(authEmailPolicy({ ...env, AUTH_EMAIL_TEST_RECIPIENT: "owner@example.test" }).allows("learner@example.test"), false);
  for (const override of [{ RESEND_API_KEY: "" }, { AUTH_EMAIL_FROM: "invalid" }, { AUTH_EMAIL_FROM: "Sender\r\n<accounts@example.test>" }, { AUTH_EMAIL_TEST_RECIPIENT: "invalid" }]) {
    assert.equal(authEmailPolicy({ ...env, ...override }).configured, false);
  }
});
