"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";

export default function AuthButtons({ action }: { action: "signin" | "signout" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (action === "signin") await signIn("google", { callbackUrl: "/" });
      else await signOut({ callbackUrl: "/" });
    } catch {
      setError("That did not finish. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={action === "signin" ? "primary-button" : "secondary-button"} onClick={handleClick} disabled={busy} aria-busy={busy}>
        {busy ? (action === "signin" ? "Opening Google…" : "Signing out…") : action === "signin" ? "Continue with Google" : "Sign out"}
      </button>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}
