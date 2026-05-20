/**
 * LandingNav — минималистичная навигация в стиле bolt.new.
 * На мобиле: лого слева, кнопка "Войти" справа.
 * На десктопе: + GitHub.
 */

type Props = { isAuthed: boolean };

export function LandingNav({ isAuthed }: Props) {
  return (
    <header
      className="sticky top-0 z-50 w-full backdrop-blur-md"
      style={{
        background: "rgba(10, 10, 10, 0.7)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 no-underline">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[14px]"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            N
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[color:var(--ink)]">
            nitgen
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="https://github.com/igor1000rr/nit-builder"
            target="_blank"
            rel="noopener"
            className="hidden sm:inline-flex items-center gap-2 text-[13px] text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 .3a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.17c-3.34.73-4.04-1.42-4.04-1.42-.55-1.4-1.34-1.77-1.34-1.77-1.1-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.2 0 0 1-.32 3.3 1.23a11.49 11.49 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.67.24 2.89.12 3.2.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.23v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .3" />
            </svg>
            <span>GitHub</span>
          </a>

          {isAuthed ? (
            <a href="/" className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
              Открыть редактор →
            </a>
          ) : (
            <>
              <a
                href="/login"
                className="text-[13px] text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors px-3 py-2"
              >
                Войти
              </a>
              <a
                href="/register"
                className="btn-primary"
                style={{ padding: "8px 16px", fontSize: 13 }}
              >
                Начать
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
