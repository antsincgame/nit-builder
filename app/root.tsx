import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  type LinksFunction,
} from "react-router";
import type { Route } from "./+types/root";
import { AuthProvider } from "~/lib/contexts/AuthContext";
import "./styles/app.css";

export const links: LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@300;400;700;900&family=JetBrains+Mono:wght@300;400;500;700&display=swap",
  },
];

/**
 * Root meta — fallback для всех страниц + og/twitter для соцсетей.
 * Раньше было: "LLM", "GPU", "LM Studio", "peer-to-peer туннель", "inference",
 * "Open source" — всё это отображалось при шаре ссылки в мессенджерах.
 */
export const meta = () => [
  { title: "NITGEN — Создавайте сайты бесплатно" },
  {
    name: "description",
    content:
      "Расскажите, что вы делаете — приложение само соберёт сайт. Без программирования, без подписок, всё работает на вашем компьютере.",
  },
  { property: "og:title", content: "NITGEN — Создавайте сайты бесплатно" },
  {
    property: "og:description",
    content:
      "Простое приложение для создания сайтов. Без программистов, без подписок — бесплатно навсегда.",
  },
  { property: "og:type", content: "website" },
  { property: "og:image", content: "/og-image.svg" },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { property: "og:locale", content: "ru_RU" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "NITGEN — Создавайте сайты бесплатно" },
  {
    name: "twitter:description",
    content:
      "Простое приложение для создания сайтов без программистов. Бесплатно, приватно.",
  },
  { name: "twitter:image", content: "/og-image.svg" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0b10" />
        <Meta />
        <Links />
      </head>
      <body className="bg-nit-bg text-nit-ink antialiased font-sans">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

/**
 * ErrorBoundary v2 — переведён на русский, приведён к токенам v3.2.
 * Было: "// system error", "← Back to root", старые nit-orb классы.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Ошибка";
  let details = "Что-то пошло не так. Попробуйте обновить страницу.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : `${error.status}`;
    details = error.status === 404 ? "Страница не найдена" : "Что-то пошло не так";
  } else if (error instanceof Error) {
    // Не показываем технические сообщения обычным пользователям — только лог.
    console.error("[ErrorBoundary]", error);
  }

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-hidden"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <div className="nit-bg-mesh" aria-hidden>
        <div className="nit-bg-mesh-orb nit-bg-mesh-1" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-2" />
      </div>
      <div className="nit-bg-grid" aria-hidden />

      <div className="relative z-10">
        <h1
          className="nit-display mb-5 sm:mb-6"
          style={{ fontSize: "clamp(72px, 14vw, 140px)", color: "var(--ink)" }}
        >
          <span className="nit-text-gradient-cyan">{message}</span>
        </h1>
        <p
          className="mb-8 max-w-md mx-auto"
          style={{
            fontSize: "clamp(15px, 2vw, 17px)",
            color: "var(--muted)",
            lineHeight: 1.55,
          }}
        >
          {details}
        </p>
        <a href="/" className="btn-primary" style={{ padding: "12px 24px" }}>
          На главную
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
