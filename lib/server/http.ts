export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("請求格式不正確");
  }
  return (await request.json()) as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "發生未預期的錯誤";
}
