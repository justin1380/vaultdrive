import {
  audit,
  createUserAccount,
  deleteUserAccount,
  getSessionUser,
  listUsers,
  updateUserAccount,
  type UserRole,
} from "@/lib/server/auth";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

function adminError(error: unknown) {
  const message = errorMessage(error);
  if (message === "UNAUTHORIZED") return jsonError("請重新登入", 401);
  if (message === "FORBIDDEN") return jsonError("只有管理員可以管理帳號", 403);
  return jsonError(message);
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return Response.json({ ok: true, users: await listUsers() });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await readJson<{
      username?: string;
      password?: string;
      role?: UserRole;
    }>(request);
    const role: UserRole = body.role === "admin" ? "admin" : "member";
    await createUserAccount(
      String(body.username ?? "").trim(),
      String(body.password ?? ""),
      role,
    );
    await audit(admin, "create_user", String(body.username ?? ""));
    return Response.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await readJson<{
      id?: number;
      active?: boolean;
      role?: UserRole;
      password?: string;
    }>(request);
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("帳號編號不正確");
    await updateUserAccount({
      id,
      active: typeof body.active === "boolean" ? body.active : undefined,
      role:
        body.role === "admin" || body.role === "member" ? body.role : undefined,
      password: body.password ? String(body.password) : undefined,
    });
    await audit(admin, "update_user", String(id));
    return Response.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await readJson<{ id?: number }>(request);
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("帳號編號不正確");
    await deleteUserAccount(id, admin.id);
    await audit(admin, "delete_user", String(id));
    return Response.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
