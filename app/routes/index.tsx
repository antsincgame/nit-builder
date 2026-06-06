/**
 * Root index route (/) — всегда лендинг.
 *
 * Было: auth-aware сплиттер (клиентский) — один URL отдавал разный
 * контент (гость → лендинг, authed → приложение), а SSR рендерил
 * только спиннер — краулеры видели пустую страницу, LCP ~3.7s.
 *
 * Стало: разделение по URL:
 *   /    — всегда лендинг (полный SSR-контент для SEO)
 *   /app — приложение-генератор
 *
 * Авторизованных серверный loader 302-ит на /app по куке nit_session.
 * Проверка дёшевая: HMAC-подпись + expiry, без похода в Appwrite.
 * Если токен отозван (logout-all) — /app сам разрулит через /api/auth/me.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/index";
import Landing from "./landing";
import {
  parseSessionCookie,
  verifySessionToken,
} from "~/lib/server/sessionCookie.server";

export function loader({ request }: Route.LoaderArgs) {
  const token = parseSessionCookie(request.headers.get("Cookie"));
  if (token && verifySessionToken(token)) {
    return redirect("/app");
  }
  return null;
}

export function meta() {
  return [
    { title: "NITGEN — Создавай сайты бесплатно" },
    {
      name: "description",
      content:
        "Расскажите, что вы делаете — приложение само соберёт сайт за минуту. Без программирования, без подписок, всё работает на вашем компьютере.",
    },
    { property: "og:title", content: "NITGEN — Создавай сайты бесплатно" },
    {
      property: "og:description",
      content:
        "Простые сайты за минуту — без программистов, без подписок. Работает на вашем компьютере.",
    },
    { tagName: "link", rel: "canonical", href: "https://nitgen.org/" },
  ];
}

export default function Index() {
  return <Landing />;
}
