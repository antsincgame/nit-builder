/**
 * GET  /api/user-templates       — список моих шаблонов (без full html)
 * POST /api/user-templates       — сохранить новый шаблон
 *
 * v2.1 Save as Template. Шаблоны хранятся в Appwrite collection
 * nit_user_templates. Soft-limit 50 шт. на юзера (защита от спама).
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { requireAuth } from "~/lib/server/requireAuth.server";
import {
  listUserTemplates,
  saveUserTemplate,
} from "~/lib/server/appwrite.server";

// ─── GET /api/user-templates ──────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  try {
    const templates = await listUserTemplates(user.userId, 50);
    return Response.json({
      templates: templates.map((t) => ({
        id: t.$id,
        name: t.name,
        prompt: t.prompt ?? null,
        createdAt: t.$createdAt,
        isPublic: t.isPublic,
        votes: t.votes,
        // html НЕ возвращаем в list view — fetch индивидуально через :id
        hasZones: !!t.zones,
      })),
    });
  } catch (err) {
    console.error("[api.user-templates] list failed:", err);
    return Response.json(
      { error: "Failed to list templates" },
      { status: 500 },
    );
  }
}

// ─── POST /api/user-templates ──────────────────────────────

const SaveTemplateSchema = z.object({
  name: z.string().min(1).max(128),
  html: z.string().min(1).max(1_000_000),
  prompt: z.string().max(5000).optional(),
  // zones — JSON-сериализованный массив data-edit зон (optional, для v2.2).
  zones: z.string().max(100_000).optional(),
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireAuth(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SaveTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const id = await saveUserTemplate({
      userId: user.userId,
      ...parsed.data,
    });
    return Response.json({ id, message: "Template saved" }, { status: 201 });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "USER_TEMPLATE_LIMIT_EXCEEDED") {
      return Response.json(
        {
          error: "Лимит шаблонов превышен (50). Удалите неиспользуемые.",
          code: "LIMIT_EXCEEDED",
        },
        { status: 403 },
      );
    }
    console.error("[api.user-templates] save failed:", err);
    return Response.json(
      { error: "Failed to save template" },
      { status: 500 },
    );
  }
}
