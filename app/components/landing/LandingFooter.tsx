/**
 * LandingFooter v4 — упрощён, без «MIT» и технических терминов.
 */

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="relative px-5 sm:px-8 py-10 sm:py-12 z-10"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[12px]"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            N
          </div>
          <span className="text-[14px] font-semibold text-[color:var(--ink)]">nitgen</span>
          <span className="text-[13px] ml-2" style={{ color: "var(--muted-2)" }}>
            © {year}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-[13px]">
          <a
            href="/login"
            className="transition-colors"
            style={{ color: "var(--muted)" }}
          >
            Войти
          </a>
          <a
            href="/register"
            className="transition-colors"
            style={{ color: "var(--muted)" }}
          >
            Регистрация
          </a>
          <a
            href="mailto:hello@nitgen.org"
            className="transition-colors"
            style={{ color: "var(--muted)" }}
          >
            Поддержка
          </a>
        </div>
      </div>
    </footer>
  );
}
