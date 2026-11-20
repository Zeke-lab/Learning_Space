"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export type AccountMode = "signin" | "signup" | "forgot" | "resend" | "verify" | "reset";
const labels: Record<AccountMode, string> = { signin: "Sign in with email", signup: "Create account", forgot: "Send recovery email", resend: "Resend verification email", verify: "Verify email", reset: "Save new password" };

export default function EmailAccountForm({ mode, enabled }: { mode: AccountMode; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [complete, setComplete] = useState(false);
  const token = useRef("");
  const linked = mode === "verify" || mode === "reset";
  const needsPassword = linked || mode === "signin" || mode === "signup";
  useEffect(() => {
    if (linked) {
      if (!token.current) token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [linked]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    if ((mode === "signup" || mode === "reset") && password !== data.get("confirmation")) {
      setFailed(true); setMessage("The passwords do not match."); return;
    }
    setBusy(true); setMessage(""); setFailed(false);
    try {
      if (mode === "signin") {
        const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/account" });
        if (!result?.ok || result.error) throw new Error("Check your email and password, verify your email, or wait before trying again.");
        router.push("/account");
        router.refresh();
        return;
      }
      const response = await fetch("/api/account/access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email, password, name: data.get("name"), token: token.current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "That could not finish. Please try again.");
      setMessage(result.message); setComplete(true); form.reset();
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "Connection failed. Please try again.");
    } finally { setBusy(false); }
  }

  return <>
    {!enabled && <p role="status" className="mb-6 text-sm leading-6 text-[var(--muted)]">{mode === "signin" ? "Email sign-in is being prepared. You can continue with Google." : "Email delivery is being connected. You can continue with Google from the sign-in page."}</p>}
    {!complete && <form onSubmit={submit} className="flex flex-col gap-5" aria-busy={busy}>
      {mode === "signup" && <label className="field-label" htmlFor="account-name">Name<input id="account-name" name="name" autoComplete="name" required maxLength={120} className="auth-input" /></label>}
      {!linked && <label className="field-label" htmlFor="account-email">Email<input id="account-email" name="email" type="email" autoComplete="email" required maxLength={320} className="auth-input" /></label>}
      {needsPassword && <label className="field-label" htmlFor="account-password">{mode === "reset" ? "New password" : mode === "verify" ? "Your signup password" : "Password"}
        <input id="account-password" name="password" type="password" autoComplete={mode === "signup" || mode === "reset" ? "new-password" : "current-password"} required minLength={15} maxLength={128} className="auth-input" aria-describedby="password-help" />
        <span id="password-help" className="mt-2 block text-sm font-normal normal-case tracking-normal text-[var(--muted)]">Use 15–128 characters. A long passphrase works well.</span>
      </label>}
      {(mode === "signup" || mode === "reset") && <label className="field-label" htmlFor="account-confirmation">Confirm password<input id="account-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={15} maxLength={128} className="auth-input" /></label>}
      <button className="primary-button" disabled={busy || !enabled}>{busy ? "Please wait…" : labels[mode]}</button>
    </form>}
    {message && <p role={failed ? "alert" : "status"} className={`mt-5 text-sm leading-6 ${failed ? "text-[var(--error)]" : "text-[var(--ink)]"}`}>{message}</p>}
    <nav aria-label="Account options" className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[var(--accent)]">
      {mode !== "signin" && <Link href="/signin">Back to sign in</Link>}
      {mode === "signin" && <><Link href="/signup">Create account</Link><Link href="/forgot-password">Forgot password?</Link></>}
      {(mode === "signin" || mode === "signup" || mode === "verify") && <Link href="/resend-verification">Resend verification</Link>}
      {mode === "reset" && <Link href="/forgot-password">Request a new link</Link>}
    </nav>
  </>;
}
