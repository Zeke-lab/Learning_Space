import { z } from "zod";

export function authEmailPolicy(env: Record<string, string | undefined>) {
  const from = env.AUTH_EMAIL_FROM?.trim() ?? "";
  const address = from.match(/<([^<>]+)>$/)?.[1] ?? from;
  const senderValid = !/[\r\n]/.test(from) && z.email().safeParse(address).success;
  const sharedSender = address.toLowerCase().endsWith("@resend.dev");
  const recipient = env.AUTH_EMAIL_TEST_RECIPIENT?.trim().toLowerCase() ?? "";
  const recipientValid = !recipient || z.email().safeParse(recipient).success;
  const configured = Boolean(env.RESEND_API_KEY?.trim() && senderValid && recipientValid && (!sharedSender || recipient));
  return {
    configured,
    testMode: sharedSender || Boolean(recipient),
    allows(email: string) { return configured && (!recipient || email.trim().toLowerCase() === recipient); },
  };
}
