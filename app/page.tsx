import Link from "next/link";
import BookWorkspace from "@/components/BookWorkspace";
import { getAppSession } from "@/lib/auth";
import { workspaceStorageKey } from "@/lib/workspace-storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getAppSession();
  const storageKey = workspaceStorageKey(session?.user.workspaceId ?? session?.user.id);
  return <BookWorkspace key={storageKey} storageKey={storageKey} accountControls={
    <nav aria-label="Account" className="flex items-center gap-3">
      {session ? <>
        <span className="hidden max-w-40 truncate text-sm text-[var(--muted)] sm:inline">{session.user.name ?? session.user.email}</span>
        <Link className="secondary-button inline-flex items-center" href="/account">Your account</Link>
      </> : <Link className="secondary-button inline-flex items-center" href="/signin">Sign in</Link>}
    </nav>
  } />;
}
