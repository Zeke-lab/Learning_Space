import Link from "next/link";
import { redirect } from "next/navigation";
import AuthButtons from "@/components/AuthButtons";
import { getAppSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getAppSession();
  if (!session) redirect("/signin");
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16 sm:py-24">
      <Link href="/" className="text-sm font-semibold text-[var(--accent)]">← Back to Book Studio</Link>
      <p className="eyebrow mt-12">Google account</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Your account</h1>
      <dl className="my-8 border-y border-[var(--line)] py-6">
        <dt className="field-label">Name</dt><dd className="mt-2 mb-5">{session.user.name ?? "Google user"}</dd>
        <dt className="field-label">Email</dt><dd className="mt-2 break-all">{session.user.email}</dd>
      </dl>
      <p className="mb-8 leading-7 text-[var(--muted)]">Your signed-in workspace is separate from the guest workspace on this device. Books are not synced across devices yet.</p>
      <AuthButtons action="signout" />
    </main>
  );
}
