import "server-only";
import type { Mail } from "./account-service";
import { authEmailPolicy } from "./auth-email-policy";
import { deliverAuthEmail } from "./auth-email-delivery";

export function emailConfigured() {
  return authEmailPolicy(process.env).configured;
}

export async function sendAuthEmail(mail: Mail) {
  await deliverAuthEmail(process.env, mail);
}
