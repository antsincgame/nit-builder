import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { bakeStandaloneHtml } from "~/lib/bake/compileTailwind.server";
import { logger } from "~/lib/utils/logger";

// ─── POST /api/bundle — компиляция Tailwind + standalone HTML ─────
//
// Принимает сгенерированный HTML с Tailwind CDN-скриптом, возвращает
// standalone-HTML с inline-CSS (только реально используемые классы),
// без CDN-зависимостей. Файл готов к заливке на любой статический хостинг.
//
// Auth НЕ требуется — генерация доступна анонимам, download тоже должен быть.
// Bake — pure CPU (~50-200 ms), без побочных эффектов на сервере.

const BundleSchema = z.object({
  html: z.string().min(1).max(2_000_000),
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
    const baked = await bakeStandaloneHtml(parsed.data.html);
    const tookMs = Date.now() - t0;
    const sizeIn = parsed.data.html.length;
    const sizeOut = baked.length;
    logger.info(
      "api.bundle",
      `ok in=${sizeIn}b out=${sizeOut}b took=${tookMs}ms`,
    );

    // safe filename — только ascii-альфанумерика, дефисы, подчёркивания.
    const safeName =
      parsed.data.filename?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "site.html";

    return new Response(baked, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Bundle-In-Bytes": String(sizeIn),
        "X-Bundle-Out-Bytes": String(sizeOut),
        "X-Bundle-Took-Ms": String(tookMs),
      },
    });
  } catch (err) {
    logger.error("api.bundle", "bake failed", err);
    return Response.json(
      {
        error: "Bake failed",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
