import { authenticate, createSession } from "@/lib/server/auth";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ username?: string; password?: string }>(request);
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) return jsonError("請輸入帳號與密碼");
    const user = await authenticate(username, password);
    if (!user) return jsonError("帳號或密碼不正確", 401);
    const cookie = await createSession(user.id, request);
    return Response.json(
      { ok: true, user },
      { headers: { "Set-Cookie": cookie } },
    );
  } catch (error) {
    const message = errorMessage(error);
    return jsonError(message, message.includes("稍後") ? 429 : 400);
  }
}
