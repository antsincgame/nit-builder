import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { bundleStaticSiteZip } from "~/lib/bake/bundle.server";
import { logger } from "~/lib/utils/logger";
import { checkRateLimit } from "~/lib/utils/rateLimit";

// ─── POST /api/bundle — standalone ZIP (index.html + assets/images/) ─────
//
// Принимает сгенерированный HTML с Tailwind CDN-скриптом, возвращает ZIP:
//   index.html — inline CSS, без CDN
//   assets/images/* — скачанные картинки (Unsplash/picsum → локальные файлы)
//
// Auth НЕ требуется — генерация доступна анонимам, download тоже должен быть.

const BundleSchema = z.object({
  html: z.string().min(1).max(2_000_000),
  filename: z.string().min(1).max(120).optional(),
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const rl = checkRateLimit(request, {
    scope: "bundle",
    windowMs: 60_000,
    maxRequests: 30,
  });
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many requests. Try again in a minute.", retryAfterMs: rl.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BundleSchema.safeParse(body);
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
    const bundled = await bundleStaticSiteZip(parsed.data.html);
    const tookMs = Date.now() - t0;
    logger.info(
      "api.bundle",
      `ok in=${parsed.data.html.length}b zip=${bundled.sizeBytes}b took=${tookMs}ms images=${bundled.imagesEmbedded}/${bundled.imagesEmbedded + bundled.imagesFailed}`,
    );

    const safeName =
      parsed.data.filename?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "site.zip";

    const zipBody = bundled.zip.buffer.slice(
      bundled.zip.byteOffset,
      bundled.zip.byteOffset + bundled.zip.byteLength,
    ) as ArrayBuffer;

    return new Response(zipBody, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Bundle-In-Bytes": String(parsed.data.html.length),
        "X-Bundle-Out-Bytes": String(bundled.sizeBytes),
        "X-Bundle-Took-Ms": String(tookMs),
        "X-Bundle-Images": `${bundled.imagesEmbedded}/${bundled.imagesEmbedded + bundled.imagesFailed}`,
      },
    });
  } catch (err) {
    logger.error("api.bundle", "bundle failed", err);
    return Response.json(
      {
        error: "Bundle failed",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
