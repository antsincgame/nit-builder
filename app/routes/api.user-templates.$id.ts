/**
 * GET    /api/user-templates/:id   — один шаблон с full html + zones
 * DELETE /api/user-templates/:id   — удалить (ownership-check)
 *
 * v2.1 Save as Template.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/server/requireAuth.server";
import {
  deleteUserTemplate,
  getUserTemplate,
} from "~/lib/server/appwrite.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const templateId = params.id;
  if (!templateId) {
    return Response.json({ error: "Template ID required" }, { status: 400 });
  }

  const t = await getUserTemplate(user.userId, templateId);
  if (!t) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    id: t.$id,
    name: t.name,
    prompt: t.prompt ?? null,
    html: t.html,
    zones: t.zones ?? null,
    isPublic: t.isPublic,
    votes: t.votes,
    createdAt: t.$createdAt,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireAuth(request);
  const templateId = params.id;
  if (!templateId) {
    return Response.json({ error: "Template ID required" }, { status: 400 });
  }

  const ok = await deleteUserTemplate(user.userId, templateId);
  if (!ok) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ message: "Template deleted" });
}
