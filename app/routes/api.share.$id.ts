import type { ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/server/requireAuth.server";
import { revokeSharedPreview } from "~/lib/server/appwrite.server";

// ─── DELETE /api/share/:id — revoke a share link ─────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireAuth(request);
  const docId = params.id;
  if (!docId) {
    return Response.json({ error: "Share ID required" }, { status: 400 });
  }

  const ok = await revokeSharedPreview(user.userId, docId);
  if (!ok) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ message: "Share revoked" });
}
