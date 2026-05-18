/**
 * GET /api/public-templates       — публичный список одобренных шаблонов
 * GET /api/public-templates/:id   — один шаблон с full html (для "fork")
 *
 * v2.2 Community templates. БЕЗ auth — открыт любому посетителю.
 * Возвращаются только документы с isPublic=true (модерация через admin
 * endpoint api.admin.templates.approve.$id.ts).
 *
 * NOTE: список и один шаблон обслуживаются одним route'ом через splat?
 * Нет — для одного id есть отдельный файл api.public-templates.$id.ts,
 * чтобы соответствовать конвенциям проекта (api.sites.ts + api.sites.$id.ts
 * и т.д.).
 */

import type { LoaderFunctionArgs } from "react-router";
import { listPublicTemplates } from "~/lib/server/appwrite.server";

export async function loader({ request: _request }: LoaderFunctionArgs) {
  try {
    const templates = await listPublicTemplates(50);
    return Response.json({
      templates: templates.map((t) => ({
        id: t.$id,
        name: t.name,
        // prompt полезен в галерее как hint о том для чего шаблон создавался
        prompt: t.prompt ?? null,
        createdAt: t.$createdAt,
        votes: t.votes,
        hasZones: !!t.zones,
        // html НЕ возвращается в list view — fetch индивидуально через :id
      })),
    });
  } catch (err) {
    console.error("[api.public-templates] list failed:", err);
    return Response.json(
      { error: "Failed to list public templates" },
      { status: 500 },
    );
  }
}
