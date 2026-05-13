import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { bundlePhp } from "~/lib/bake/bundle.server";
import { logger } from "~/lib/utils/logger";

// ─── POST /api/bundle/php — ZIP с PHP-админкой ───────────────────
//
// Принимает {html, zones, filename?}, возвращает application/zip с готовым
// бандлом: index.php (HTML + PHP-вставки), admin/, data/, setup.php, README.md.
//
// Auth не требуется (как /api/bundle) — download должен быть доступен анонимам.
// Compile + bake + zip: CPU-bound, ~150-500ms для типичного лендинга.

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

const BundlePhpSchema = z.object({
  html: z.string().min(1).max(2_000_000),
  zones: z.array(EditableZoneRequestSchema).min(1).max(20),
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

  const t0 = Date.now();
  try {
    const result = await bundlePhp({
      html: parsed.data.html,
      zones: parsed.data.zones,
    });
    const tookMs = Date.now() - t0;
    logger.info(
      `[api.bundle.php] ok matched=${result.matchedZones.length} missing=${result.missingZones.length} size=${result.sizeBytes}b took=${tookMs}ms`,
    );

    const safeName =
      parsed.data.filename?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "site-php.zip";

    return new Response(result.zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Bundle-Took-Ms": String(tookMs),
        "X-Bundle-Matched": String(result.matchedZones.length),
        "X-Bundle-Missing": String(result.missingZones.length),
        "X-Bundle-Size": String(result.sizeBytes),
      },
    });
  } catch (err) {
    logger.error("[api.bundle.php] bundle failed", err);
    return Response.json(
      {
        error: "Bundle failed",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
