import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { bundlePhp } from "~/lib/bake/bundle.server";
import { extractZonesFromHtml } from "~/lib/bake/extractZones.server";
import { extractCollectionsFromHtml } from "~/lib/bake/extractCollections.server";
import type { PlanCollection } from "~/lib/utils/planSchema";
import { logger } from "~/lib/utils/logger";

// ─── POST /api/bundle/php — ZIP с PHP-админкой ──────────────────
//
// Принимает {html, zones?, collections?, filename?}, возвращает application/zip
// с готовым бандлом: index.php (HTML + PHP-вставки), admin/, data/,
// setup-<hex>.php, README.md.
//
// zones[] опционально: если передан — используется как есть; если не передан
// или пустой — извлекается из data-edit-* атрибутов самого HTML. Это позволяет
// клиенту скачать бандл без знания plan'а — Coder уже разметил всё необходимое
// прямо в HTML (data-edit="<id>" data-edit-type="<type>" data-edit-label="<label>").
//
// collections[] (Tier 6) — та же модель: из клиента (plan.collections) если
// переданы, иначе извлекаются из самодостаточной разметки
// data-collection(-label)/data-item/data-field(-type/-label) самого HTML
// (extractCollectionsFromHtml). Туннельный WS-протокол план в браузер не
// передаёт — extract-фоллбек делает кнопку «С редактором» рабочей на обоих
// генерационных путях без правки протокола.
//
// Auth не требуется (как /api/bundle). Compile + bake + zip: CPU-bound,
// ~150-500ms для типичного лендинга.

const EditableZoneRequestSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "id — snake_case, только a-z, 0-9, _, начинается с буквы"),
  type: z.enum(["text", "richtext", "image"]),
  label: z.string().min(2).max(80),
  section: z.string().min(1).max(50),
});

// Зеркало CollectionSchema из planSchema — дублируем сознательно, как зоны:
// контракт API не должен молча дрейфовать вместе с внутренней схемой плана.
const CollectionFieldRequestSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "id — snake_case, только a-z, 0-9, _, начинается с буквы"),
  label: z.string().min(2).max(80),
  type: z.enum(["text", "richtext", "image", "price", "number"]),
});

const CollectionRequestSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "id — snake_case, только a-z, 0-9, _, начинается с буквы"),
  label: z.string().min(2).max(80),
  fields: z.array(CollectionFieldRequestSchema).min(1).max(10),
  section: z.string().min(1).max(50),
});

const BundlePhpSchema = z.object({
  html: z.string().min(1).max(2_000_000),
  zones: z.array(EditableZoneRequestSchema).max(20).optional(),
  collections: z.array(CollectionRequestSchema).max(5).optional(),
  filename: z.string().min(1).max(120).optional(),
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BundlePhpSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // zones из клиента приоритетнее, иначе извлекаем из HTML.
  let zones = parsed.data.zones ?? [];
  let zonesSource: "client" | "extracted" = "client";
  if (zones.length === 0) {
    zones = extractZonesFromHtml(parsed.data.html);
    zonesSource = "extracted";
  }

  // collections — та же модель: клиент приоритетнее, иначе извлекаем из
  // самодостаточной разметки (label/type живут в data-атрибутах).
  let collections: PlanCollection[] = parsed.data.collections ?? [];
  let collectionsSource: "client" | "extracted" = "client";
  if (collections.length === 0) {
    collections = extractCollectionsFromHtml(parsed.data.html);
    collectionsSource = "extracted";
  }

  if (zones.length === 0 && collections.length === 0) {
    return Response.json(
      {
        error: "No editable zones",
        message:
          "В HTML нет ни одной зоны с атрибутом data-edit и не переданы коллекции. Опиши в запросе что нужна возможность редактирования (admin, CMS, «чтобы клиент сам менял контент») — Planner разметит зоны.",
      },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  try {
    const result = await bundlePhp({
      html: parsed.data.html,
      zones,
      collections,
    });
    const tookMs = Date.now() - t0;
    logger.info(
      "api.bundle.php",
      `ok source=${zonesSource} col_source=${collectionsSource} matched=${result.matchedZones.length} missing=${result.missingZones.length} col_matched=${result.matchedCollections.length} col_missing=${result.missingCollections.length} col_fields_missing=${result.missingCollectionFields.length} size=${result.sizeBytes}b setup=${result.setupFilename} took=${tookMs}ms`,
    );

    const safeName =
      parsed.data.filename?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "site-php.zip";

    const zipBody = result.zip.buffer.slice(
      result.zip.byteOffset,
      result.zip.byteOffset + result.zip.byteLength,
    ) as ArrayBuffer;
    return new Response(zipBody, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Bundle-Took-Ms": String(tookMs),
        "X-Bundle-Matched": String(result.matchedZones.length),
        "X-Bundle-Missing": String(result.missingZones.length),
        "X-Bundle-Collections-Matched": String(result.matchedCollections.length),
        "X-Bundle-Collections-Missing": String(result.missingCollections.length),
        "X-Bundle-Collections-Source": collectionsSource,
        "X-Bundle-Size": String(result.sizeBytes),
        "X-Bundle-Zones-Source": zonesSource,
        // setup-файл переименован в setup-<8hex>.php (см. bundle.server.ts).
        // Клиент использует этот header чтобы показать юзеру правильную ссылку
        // в toast после download — иначе юзер пойдёт на /setup.php и получит 404.
        // Same-origin: Access-Control-Expose-Headers не нужен.
        "X-Bundle-Setup-File": result.setupFilename,
      },
    });
  } catch (err) {
    logger.error("api.bundle.php", "bundle failed", err);
    return Response.json(
      {
        error: "Bundle failed",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
