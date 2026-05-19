/**
 * Root index route (/) — auth-aware splitter.
 *
 * - guest → лендинг (NITGEN презентация, 11 секций)
 * - authenticated → приложение-генератор (бывший Home)
 * - loading → короткий spinner (обычно <100ms благодаря localStorage-кэшу
 *   в AuthContext, так что реального flash нет при повторных визитах)
 *
 * Почему клиентский, а не серверный redirect: auth-сессия живёт в
 * httpOnly-cookie + проверяется через Appwrite API. Серверный loader
 * потребовал бы ext fetch на каждый визит / — лишняя зависимость и latency.
 * AuthContext уже решает flash-проблему через localStorage TTL=5min.
 */

import HomeApp from "./home";
import Landing from "./landing";
import { useAuth } from "~/lib/contexts/AuthContext";

export function meta() {
  return [
    { title: "NITGEN — AI конструктор сайтов на твоём GPU" },
    {
      name: "description",
      content:
        "Опиши сайт — получи HTML из своего GPU через p2p tunnel. Никакого облака, никаких лимитов. Open source.",
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
          className="w-12 h-12 rounded-full animate-spin"
          style={{
            border: "3px solid var(--line)",
            borderTopColor: "var(--accent-glow)",
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
