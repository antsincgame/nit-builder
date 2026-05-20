/**
 * CtaSection — финальный призыв.
 * Минималистичный, по образцу bolt.new.
 */

type Props = { isAuthed: boolean };

export function CtaSection({ isAuthed }: Props) {
  return (
    <section className="px-5 sm:px-8 py-20 sm:py-32" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="max-w-[720px] mx-auto text-center">
        <h2
          className="nit-display mb-5 sm:mb-6"
          style={{ fontSize: "clamp(32px, 5.5vw, 56px)", color: "var(--ink)" }}
        >
          Начни собирать
          <br />
          первый сайт
        </h2>
        <p
          className="mb-8 sm:mb-10 max-w-[460px] mx-auto text-[15px] sm:text-[17px]"
          style={{ color: "var(--muted)", lineHeight: 1.55 }}
        >
          Бесплатно, без карты, без лимитов. Код остаётся у тебя.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={isAuthed ? "/app" : "/register"} className="btn-primary w-full sm:w-auto">
            {isAuthed ? "Открыть редактор" : "Начать бесплатно"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </a>
          <a
            href="https://github.com/igor1000rr/nit-builder"
            target="_blank"
            rel="noopener"
            className="btn-ghost w-full sm:w-auto"
          >
            Исходники на GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
