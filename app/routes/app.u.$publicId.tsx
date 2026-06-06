/**
 * Персональный URL кабинета: /app/u/:publicId.
 *
 * URL — витрина, не пропуск: доступ определяет session cookie.
 * Чужой /app/u/... открыть нельзя — loader сверяет publicId с юзером
 * из куки и уводит на свой. Гость → лендинг (приложение только
 * для авторизованных).
 */
import { redirect } from "react-router";
import type { Route } from "./+types/app.u.$publicId";
import Home from "./home";
import { getAuth } from "~/lib/server/requireAuth.server";
import { ensurePublicId } from "~/lib/server/publicId.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await getAuth(request);
  if (!user) {
    return redirect("/");
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
