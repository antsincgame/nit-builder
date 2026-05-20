/**
 * Root index route (/) — auth-aware splitter.
 *
 * Обновлены meta-теги — было "Опиши сайт — получи HTML из своего GPU
 * через p2p tunnel", видимо в SEO Google и при шаре ссылки.
 *
 * - guest → лендинг
 * - authenticated → приложение-генератор (бывший Home)
 * - loading → короткий spinner
 */

import HomeApp from "./home";
import Landing from "./landing";
import { useAuth } from "~/lib/contexts/AuthContext";

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
  ];
}

export default function Index() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="w-10 h-10 rounded-full animate-spin"
          style={{
            border: "3px solid var(--line)",
            borderTopColor: "var(--ink)",
          }}
        />
      </div>
    );
  }

  if (auth.status === "authenticated") {
    return <HomeApp />;
  }

  return <Landing />;
}
