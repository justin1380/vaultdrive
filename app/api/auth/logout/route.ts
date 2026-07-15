import { destroySession, ensureAuthDatabase } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureAuthDatabase();
  const cookie = await destroySession(request);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie } },
  );
}
