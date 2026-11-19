import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ nextauth: string[] }> };

async function handler(request: NextRequest, context: Context) {
  const options = getAuthOptions();
  if (!options) {
    return Response.json({ error: "Google sign-in is temporarily unavailable." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
  return NextAuth(options)(request, context);
}

export { handler as GET, handler as POST };
