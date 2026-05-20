/**
 * LandingFooter — минималистичный футер.
 */

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="px-5 sm:px-8 py-10 sm:py-12"
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
            href="https://github.com/igor1000rr/nit-builder"
            target="_blank"
            rel="noopener"
            className="text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://vibecoding.by"
            target="_blank"
            rel="noopener"
            className="text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
          >
            VibeCoding
          </a>
          <a
            href="/templates"
            className="text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
          >
            Шаблоны сообщества
          </a>
          <span className="text-[color:var(--muted-2)]">MIT</span>
        </div>
      </div>
    </footer>
  );
}
