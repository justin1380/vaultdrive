import { getSessionUser } from "@/lib/server/auth";
import { errorMessage } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ authenticated: false });
    return Response.json({ authenticated: true, user });
  } catch (error) {
    return Response.json(
      { authenticated: false, error: errorMessage(error) },
      { status: 503 },
    );
  }
}
