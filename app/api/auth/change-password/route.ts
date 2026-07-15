import {
  audit,
  changeOwnPassword,
  getSessionUser,
} from "@/lib/server/auth";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("請重新登入", 401);
    const body = await readJson<{
      currentPassword?: string;
      newPassword?: string;
    }>(request);
    const cookie = await changeOwnPassword(
      user,
      String(body.currentPassword ?? ""),
      String(body.newPassword ?? ""),
      request,
    );
    await audit(user, "change_password");
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": cookie } },
    );
  } catch (error) {
    return jsonError(errorMessage(error));
  }
}
