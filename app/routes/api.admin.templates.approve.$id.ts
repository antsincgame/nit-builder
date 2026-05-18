/**
 * POST /api/admin/templates/:id/approve  — одобрить шаблон в публичную галерею
 * POST /api/admin/templates/:id/reject   — отозвать одобрение (action в body)
 *
 * v2.2 Community templates moderation. Защищён через NIT_ADMIN_TOKEN
 * (см. app/lib/server/adminAuth.ts).
 *
 * Реализация: один route принимает action в body чтобы не плодить
 * файлы:
 *   POST /api/admin/templates/:id/approve  body: { action: "approve" | "reject" }
 *
 * При action="approve" → isPublic=true, попадает в /api/public-templates
 * При action="reject"  → isPublic=false, убирается из публичной выдачи (но
 *                       не удаляется — владелец увидит в своих, может
 *                       исправить и подать снова).
 *
 * Не трогает votes, name, html — модерация только про видимость. Юзер не
 * получает уведомления (это сделается в v2.3+ когда будет notification
 * infrastructure).
 */

import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { checkAdminToken } from "~/lib/server/adminAuth";
import { setTemplatePublicState } from "~/lib/server/appwrite.server";

const ActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = checkAdminToken(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const templateId = params.id;
  if (!templateId) {
    return Response.json({ error: "Template ID required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const isPublic = parsed.data.action === "approve";
  const ok = await setTemplatePublicState(templateId, isPublic);
  if (!ok) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  return Response.json({
    id: templateId,
    isPublic,
    message: isPublic ? "Template approved" : "Template rejected",
  });
}
