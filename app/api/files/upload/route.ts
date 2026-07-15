import { audit, getSessionUser } from "@/lib/server/auth";
import { errorMessage, jsonError } from "@/lib/server/http";
import { uploadFiles } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("請重新登入", 401);
    const form = await request.formData();
    const files = form
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const uploaded = await uploadFiles(form.get("path"), files, user.username);
    await audit(user, "upload", uploaded.join(", "));
    return Response.json({ ok: true, uploaded });
  } catch (error) {
    return jsonError(errorMessage(error));
  }
}
