import Link from "next/link";
import { redirect } from "next/navigation";
import AuthButtons from "@/components/AuthButtons";
import { getAppSession, getAuthOptions } from "@/lib/auth";
import { googleAuthConfigured, signInErrorMessage } from "@/lib/auth-policy";
import EmailAccountForm from "@/components/EmailAccountForm";
import { databaseAuthConfigured } from "@/lib/account-store";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAppSession()) redirect("/account");
  const configured = getAuthOptions() !== null;
  const error = signInErrorMessage((await searchParams).error);
  return (
    <main className="mx-auto w-full max-w-lg px-6 py-16 sm:py-24">
      <Link href="/" className="text-sm font-semibold text-[var(--accent)]">← Back to Book Studio</Link>
      <p className="eyebrow mt-12">Your learning space</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Sign in to your account</h1>
      {configured ? <>
        <p className="mt-5 mb-8 leading-7 text-[var(--muted)]">Continue with Google or sign in with your verified email and password.</p>
        {error && <p role="alert" className="mb-5 text-sm text-[var(--error)]">{error}</p>}
        {googleAuthConfigured(process.env) && <AuthButtons action="signin" />}
        <p className="my-7 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">Or use your email</p>
        <EmailAccountForm mode="signin" enabled={databaseAuthConfigured()} />
        <p className="mt-6 text-sm leading-6 text-[var(--muted)]">Books currently stay on this device. Cloud saving and syncing are not available yet. Existing guest books stay in the guest workspace.</p>
      </> : <p role="status" className="mt-5 leading-7 text-[var(--muted)]">Google sign-in is temporarily unavailable. You can continue using Book Studio on this device.</p>}
    </main>
  );
}
