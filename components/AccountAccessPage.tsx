import Link from "next/link";
import EmailAccountForm, { type AccountMode } from "./EmailAccountForm";
import { databaseAuthConfigured } from "@/lib/account-store";
import { emailConfigured } from "@/lib/auth-email";

const copy = {
  signup: ["Create your account", "Start with your name, email, and a password. We’ll email a link to verify your address."],
  forgot: ["Forgot your password?", "Enter your account email and we’ll send instructions to reset your password."],
  resend: ["Verify your email", "Enter your signup email to request a fresh verification link."],
  verify: ["Confirm your email", "Enter the password you chose when signing up to finish verifying your account."],
  reset: ["Choose a new password", "After saving, sign in again on each device with your new password."],
};
export default function AccountAccessPage({ mode }: { mode: Exclude<AccountMode, "signin"> }) {
  const [title, description] = copy[mode];
  return <main className="mx-auto w-full max-w-lg px-6 py-16 sm:py-24">
    <Link href="/" className="text-sm font-semibold text-[var(--accent)]">← Back to Book Studio</Link>
    <p className="eyebrow mt-12">Your learning space</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight">{title}</h1>
    <p className="mt-5 mb-8 leading-7 text-[var(--muted)]">{description}</p>
    <EmailAccountForm mode={mode} enabled={databaseAuthConfigured() && ((mode === "verify" || mode === "reset") || emailConfigured())} />
  </main>;
}
