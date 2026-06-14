/**
 * Персональный URL кабинета: /app/u/:publicId.
 *
 * URL — витрина, не пропуск: доступ определяет session cookie.
 * Чужой /app/u/... открыть нельзя — loader сверяет publicId с юзером
 * из куки и уводит на свой. Гость → /app (гостевой режим).
 */
import { redirect } from "react-router";
import type { Route } from "./+types/app.u.$publicId";
import Home from "./home";
import { getAuth } from "~/lib/server/requireAuth.server";
import { ensurePublicId } from "~/lib/server/publicId.server";

// publicId — ровно 10 символов base62 (publicId.server.ts). Share-токен сайта —
// 12 base62 и живёт на /p/:token. Guard не даёт принять чужой формат (например
// 12-символьный токен, по ошибке попавший в /app/u/<token>) за publicId: иначе
// loader молча редиректил бы авторизованного в его кабинет (welcome) — ровно
// «сайт открылся как проект». Не наш формат → честный 404, а не подмена.
const PUBLIC_ID_RE = /^[A-Za-z0-9]{10}$/;

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await getAuth(request);
  if (!user) {
    return redirect("/app");
  }
  if (!params.publicId || !PUBLIC_ID_RE.test(params.publicId)) {
    throw new Response("Not found", { status: 404 });
  }
  const pid = await ensurePublicId(user.userId);
  if (pid && pid !== params.publicId) {
    return redirect(`/app/u/${pid}`);
  }
  return null;
}

export function meta() {
  return [
    { title: "nitgen — Создавайте сайты бесплатно" },
    {
      name: "description",
      content:
        "Простое приложение для создания сайтов. Без программирования, без подписок.",
    },
    // Личный кабинет — не для индексации.
    { name: "robots", content: "noindex" },
  ];
}

export default function AppUserRoute() {
  return <Home />;
}
