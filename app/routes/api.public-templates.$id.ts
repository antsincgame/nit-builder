/**
 * GET /api/public-templates/:id — один публичный шаблон с full html.
 *
 * v2.2 Community templates. БЕЗ auth — открыт любому посетителю.
 * Возвращает 404 если шаблон не существует или isPublic=false (ownership
 * не проверяется, любой может прочитать публичный).
 *
 * Используется при клике на карточку в публичной галерее → юзер получает
 * HTML, грузит как стартовую точку для нового сайта (forking-семантика).
 */

import type { LoaderFunctionArgs } from "react-router";
import { getPublicTemplate } from "~/lib/server/appwrite.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const templateId = params.id;
  if (!templateId) {
    return Response.json({ error: "Template ID required" }, { status: 400 });
  }

  const t = await getPublicTemplate(templateId);
  if (!t) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    id: t.$id,
    name: t.name,
    prompt: t.prompt ?? null,
    html: t.html,
    zones: t.zones ?? null,
    votes: t.votes,
    createdAt: t.$createdAt,
  });
}
