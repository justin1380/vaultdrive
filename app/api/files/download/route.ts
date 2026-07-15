import { getSessionUser } from "@/lib/server/auth";
import { errorMessage, jsonError } from "@/lib/server/http";
import { getDownload } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("請重新登入", 401);
    const path = new URL(request.url).searchParams.get("path");
    const { object } = await getDownload(path);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Length", String(object.size));
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/octet-stream");
    }
    if (!headers.has("Content-Disposition")) {
      const filename = String(path ?? "download").split("/").pop() || "download";
      headers.set(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
    }
    headers.set("Cache-Control", "private, no-store");
    return new Response(object.body, { headers });
  } catch (error) {
    return jsonError(errorMessage(error), 404);
  }
}
