import { getAppSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAppSession();
  const headers = { "Cache-Control": "private, no-store" };
  if (!session) return Response.json({ error: "Sign in to view your account." }, { status: 401, headers });
  return Response.json({ user: session.user, bookStorage: "this-browser" }, { headers });
}
