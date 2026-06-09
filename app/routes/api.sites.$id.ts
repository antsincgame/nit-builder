import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { requireAuth } from "~/lib/server/requireAuth.server";
import {
  APPWRITE_CONFIG,
  deleteSite,
  getAdminDatabases,
  updateSite,
  type NitSite,
} from "~/lib/server/appwrite.server";
import { rebuildLivePreviewHtml } from "~/lib/services/phpSqliteArtifactBuilder";

// ─── GET /api/sites/:id — get one site (with full HTML) ──────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const siteId = params.id;
  if (!siteId) {
    return Response.json({ error: "Site ID required" }, { status: 400 });
  }

  try {
    const db = getAdminDatabases();
    const site = await db.getDocument<NitSite>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sites,
      siteId,
    );

    // Ownership check
    if (site.userId !== user.userId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      id: site.$id,
      createdAt: site.$createdAt,
      updatedAt: site.$updatedAt,
      prompt: site.prompt,
      html: site.html,
      templateId: site.templateId,
      templateName: site.templateName,
      thumbnail: site.thumbnail ?? null,
      // v2.1 Continue from history — JSON-string или null.
      // Клиент десериализует через JSON.parse(...) в loadFromHistory.
      chatMessages: site.chatMessages ?? null,
    });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

// ─── PATCH /api/sites/:id — update html / chatMessages / thumbnail ──

const PatchSiteSchema = z.object({
  html: z.string().min(1).max(1_000_000).optional(),
  chatMessages: z.string().max(100_000).optional(),
  thumbnail: z.string().max(100_000).optional(),
});

// ─── DELETE /api/sites/:id ────────────────────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const siteId = params.id;
  if (!siteId) {
    return Response.json({ error: "Site ID required" }, { status: 400 });
  }

  if (request.method === "DELETE") {
    const ok = await deleteSite(user.userId, siteId);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ message: "Site deleted" });
  }

  if (request.method === "PATCH") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Пересборка превью на текущем движке без перегенерации: грузим текущий
    // html, заменяем boot-скрипт на актуальный, сохраняем. Boot самодостаточен
    // и сам чинит PHP под превью, поэтому работает и со старыми сайтами.
    if (
      body &&
      typeof body === "object" &&
      (body as { rebuild?: unknown }).rebuild === true
    ) {
      try {
        const db = getAdminDatabases();
        const site = await db.getDocument<NitSite>(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.sites,
          siteId,
        );
        if (site.userId !== user.userId) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        const rebuilt = rebuildLivePreviewHtml(site.html);
        if (rebuilt === site.html) {
          return Response.json({ message: "Nothing to rebuild" });
        }
        const ok = await updateSite(user.userId, siteId, { html: rebuilt });
        if (!ok) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        return Response.json({ message: "Rebuilt" });
      } catch {
        return Response.json({ error: "Rebuild failed" }, { status: 500 });
      }
    }

    const parsed = PatchSiteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Пустой patch — ничего не делаем, возвращаем 200 (idempotent).
    if (Object.keys(parsed.data).length === 0) {
      return Response.json({ message: "Nothing to update" });
    }

    const ok = await updateSite(user.userId, siteId, parsed.data);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ message: "Site updated" });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
