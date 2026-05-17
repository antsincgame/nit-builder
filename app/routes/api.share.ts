import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod";
import { requireAuth } from "~/lib/server/requireAuth.server";
import {
  APPWRITE_CONFIG,
  createSharedPreview,
  getAdminDatabases,
  listUserSharedPreviews,
  SHARED_PREVIEW_TTL_DAYS,
  type NitSite,
} from "~/lib/server/appwrite.server";

// ─── GET /api/share — list current user's active share links ─────

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  try {
    const shares = await listUserSharedPreviews(user.userId, 50);
    return Response.json({
      shares: shares.map((s) => ({
        id: s.$id,
        token: s.token,
        siteId: s.siteId,
        createdAt: s.$createdAt,
        expiresAt: s.expiresAt,
        views: s.views,
        url: `/p/${s.token}`,
      })),
    });
  } catch (err) {
    console.error("[api.share] list failed:", err);
    return Response.json({ error: "Failed to list shares" }, { status: 500 });
  }
}

// ─── POST /api/share — create a public share link ────────────────

const CreateShareSchema = z.object({
  siteId: z.string().min(1).max(64),
  ttlDays: z.number().int().min(1).max(365).optional(),
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

  const parsed = CreateShareSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { siteId, ttlDays } = parsed.data;

  // Загружаем site и проверяем ownership + забираем актуальный HTML.
  // Snapshot подхода: html копируется в share-документ один раз, чтобы
  // share-ссылка пережила удаление/правку самого сайта.
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

    const share = await createSharedPreview({
      siteId,
      userId: user.userId,
      html: site.html,
      ttlDays,
    });

    return Response.json(
      {
        id: share.$id,
        token: share.token,
        url: `/p/${share.token}`,
        expiresAt: share.expiresAt,
        ttlDays: ttlDays ?? SHARED_PREVIEW_TTL_DAYS,
      },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // Если getDocument упал с 404 — сайт не наш / не существует.
    if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api.share] create failed:", err);
    return Response.json({ error: "Failed to create share" }, { status: 500 });
  }
}
