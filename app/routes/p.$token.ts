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
 * - X-Robots-Tag: noindex — не светим в поисковики (юзер может расшарить
 *   приватный сайт клиенту, а Google его проиндексирует).
 * - Cache-Control: private, max-age=60 — небольшой кэш на CDN-уровне.
 */
export async function loader({ params }: LoaderFunctionArgs) {
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

  return new Response(share.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, max-age=60",
    },
  });
}
