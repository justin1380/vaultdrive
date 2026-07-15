import { audit, getSessionUser } from "@/lib/server/auth";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";
import { createFolder } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("請重新登入", 401);
    const body = await readJson<{ path?: string; name?: string }>(request);
    const created = await createFolder(body.path, body.name);
    await audit(user, "create_folder", created);
    return Response.json({ ok: true, path: created });
  } catch (error) {
    return jsonError(errorMessage(error));
  }
}
