import { audit, getSessionUser } from "@/lib/server/auth";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";
import { renameEntry } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("請重新登入", 401);
    const body = await readJson<{
      path?: string;
      name?: string;
      type?: "file" | "folder";
    }>(request);
    const renamed = await renameEntry(
      body.path,
      body.name,
      body.type === "folder" ? "folder" : "file",
    );
    await audit(user, "rename", `${body.path ?? ""} → ${renamed}`);
    return Response.json({ ok: true, path: renamed });
  } catch (error) {
    return jsonError(errorMessage(error));
  }
}
