import type { LoaderFunctionArgs } from "react-router";
import {
  getSharedPreviewByToken,
  incrementSharedPreviewViews,
} from "~/lib/server/appwrite.server";

/**
 * GET /p/:token — публичный read-only просмотр сгенерированного сайта.
 *
 * Не требует auth — это публичная ссылка которую владелец может скинуть
 * клиенту/коллеге. Возвращает чистый HTML с правильным Content-Type и
 * security headers'ами.
 *
 * Поведение:
 * - token не валидной формы (не 12 alphanum) → 404 (не палим различия
 *   между "не существует" и "плохой формат" атакеру).
 * - token не найден или истёк → 404 (объединяем, чтобы не различать
 *   "истёк/удалён" — это деталь реализации).
 * - найден → отдаём snapshot HTML, инкрементируем views (fire-and-forget).
 *
 * Security:
 * - X-Frame-Options: SAMEORIGIN — нельзя встраивать в чужой сайт.
 * - Referrer-Policy: no-referrer — не светим source.
 * - X-Robots-Tag: по умолчанию noindex (юзер может расшарить приватный сайт
 *   клиенту, а Google его проиндексирует). При NIT_PUBLIC_INDEXABLE=1 —
 *   index,follow + самоканоникал (защита от дублей по query).
 * - Cache-Control: private/public в зависимости от индексируемости.
 */

// Индексировать публичные превью /p/:token в поисковиках. По умолчанию OFF —
// превью часто приватные ссылки для клиента. NIT_PUBLIC_INDEXABLE=1 включает.
const PUBLIC_INDEXABLE = process.env.NIT_PUBLIC_INDEXABLE === "1";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) {
    return new Response("Not found", { status: 404 });
  }

  const share = await getSharedPreviewByToken(token);
  if (!share) {
    return new Response("Not found", { status: 404 });
  }

  // Fire-and-forget — не блокируем рендер на этом
  void incrementSharedPreviewViews(share.$id, share.views);

  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
  };

  let html = share.html;

  if (PUBLIC_INDEXABLE) {
    // Разрешаем индексацию + самоканоникал, чтобы случайные query-параметры
    // не плодили дубли страницы в индексе.
    const canonical = new URL(request.url);
    canonical.search = "";
    // За Traefik/Caddy внутренний запрос идёт по http — берём реальный протокол
    // из X-Forwarded-Proto, иначе https (прод всегда за TLS).
    const fwdProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    canonical.protocol = fwdProto ? `${fwdProto}:` : "https:";
    const canonicalUrl = canonical.toString();
    headers["X-Robots-Tag"] = "index, follow";
    headers["Link"] = `<${canonicalUrl}>; rel="canonical"`;
    headers["Cache-Control"] = "public, max-age=300";
    if (!/rel=["']canonical["']/i.test(html)) {
      const tag = `<link rel="canonical" href="${canonicalUrl}">`;
      html = html.includes("</head>")
        ? html.replace("</head>", `${tag}\n</head>`)
        : `${tag}\n${html}`;
    }
  } else {
    headers["X-Robots-Tag"] = "noindex, nofollow";
    headers["Cache-Control"] = "private, max-age=60";
  }

  return new Response(html, { status: 200, headers });
}
