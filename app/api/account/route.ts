import { getAppSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAppSession();
  const headers = { "Cache-Control": "private, no-store" };
  if (!session) return Response.json({ error: "Sign in to view your account." }, { status: 401, headers });
  const { id, name, email } = session.user;
  return Response.json({ user: { id, name, email }, bookStorage: "this-browser" }, { headers });
}
