import { audit, getSessionUser } from "@/lib/server/auth";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";
import { deleteEntry, listDirectory } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("請重新登入", 401);
    const path = new URL(request.url).searchParams.get("path") ?? "";
    return Response.json({ ok: true, entries: await listDirectory(path) });
  } catch (error) {
    return jsonError(errorMessage(error));
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("請重新登入", 401);
    const body = await readJson<{
      path?: string;
      type?: "file" | "folder";
    }>(request);
    const type = body.type === "folder" ? "folder" : "file";
    await deleteEntry(body.path, type);
    await audit(user, "delete", String(body.path ?? ""));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(errorMessage(error));
  }
}
