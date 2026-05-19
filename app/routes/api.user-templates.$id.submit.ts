/**
 * POST /api/user-templates/:id/submit — отправить шаблон в очередь модерации.
 *
 * v2.2 Phase 3. Юзер из MyTemplatesPanel жмёт "Submit for review", сервер:
 *   1. Проверяет ownership шаблона (только владелец может подать)
 *   2. Логирует событие через logGeneration (mode="create" с
 *      templateId="submit:<id>" — это audit-trail для админа)
 *   3. Возвращает 200, клиент локально запоминает "submitted" в localStorage
 *
 * NOTE: НЕ меняет isPublic — это всё ещё admin-only. Submit это просто
 * сигнал "пожалуйста посмотри". Реальное добавление в галерею делается
 * через /api/admin/templates/:id/approve (вручную или в будущем — через
 * admin UI которое читает audit log).
 *
 * Без отдельного поля submittedAt в коллекции — намеренно, чтобы не
 * требовать миграции Appwrite. State "submitted" хранится:
 *   - На клиенте: localStorage "nit-submitted-templates" set
 *   - На сервере: audit-trail в nit_generations
 *
 * Полноценный workflow с явным submit-полем + admin UI — backlog для v2.3+.
 */

import type { ActionFunctionArgs } from "react-router";
import { getAuth } from "~/lib/server/requireAuth.server";
import {
  getUserTemplate,
  logGeneration,
} from "~/lib/server/appwrite.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await getAuth(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templateId = params.id;
  if (!templateId) {
    return Response.json({ error: "Template ID required" }, { status: 400 });
  }

  // Ownership check + проверка что шаблон существует
  const template = await getUserTemplate(auth.userId, templateId);
  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  // Если уже public — нечего модерировать
  if (template.isPublic) {
    return Response.json(
      { error: "Template already public" },
      { status: 400 },
    );
  }

  // Audit trail — пишем в logGeneration с особым templateId-префиксом
  // чтобы админ мог отфильтровать через nit_generations query
  await logGeneration({
    userId: auth.userId,
    mode: "create",
    provider: "tunnel",
    durationMs: 0,
    success: true,
    templateId: `submit:${templateId}`,
  });

  return Response.json({
    id: templateId,
    submitted: true,
    message: "Template submitted for review",
  });
}
