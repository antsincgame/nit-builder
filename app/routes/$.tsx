export function loader() {
  throw new Response(null, { status: 404, statusText: "Not Found" });
}

export function meta() {
  return [{ title: "404 — Страница не найдена · NITGEN" }];
}

/**
 * 404 v2 — приведён к общим токенам дизайн-системы v3.2.
 * Был bg-slate-950 + blue/violet gradient — выбивался из общего вида.
 */
export default function NotFound() {
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
          style={{ fontSize: "clamp(80px, 16vw, 160px)", color: "var(--ink)" }}
        >
          <span className="nit-text-gradient-cyan">404</span>
        </h1>
        <p
          className="mb-8 max-w-md mx-auto"
          style={{
            fontSize: "clamp(15px, 2vw, 17px)",
            color: "var(--muted)",
            lineHeight: 1.55,
          }}
        >
          Такой страницы нет. Но вы можете создать свой сайт прямо сейчас.
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
