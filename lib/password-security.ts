import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

export const emailInput = z.string().trim().toLowerCase().email().max(320);
export const passwordInput = z.string().min(15, "Use at least 15 characters.").max(128, "Use at most 128 characters.");
export const tokenInput = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const registrationInput = z.object({
  name: z.string().trim().min(1).max(120), email: emailInput, password: passwordInput,
});
export const passwordOptions = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };
export function hashPassword(password: string) { return hash(password, passwordOptions); }
export async function checkPassword(encoded: string, password: string) {
  try { return await verify(encoded, password); } catch { return false; }
}
export function digestToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newChallenge() {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: digestToken(token) };
}
