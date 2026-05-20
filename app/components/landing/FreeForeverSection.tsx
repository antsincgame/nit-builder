/**
 * FreeForeverSection v3.2 — green tint + gradient zero + reveal.
 */

import { RevealOnScroll } from "~/components/landing/RevealOnScroll";

type Props = { isAuthed: boolean };

const COMPETITORS = [
  { name: "Bolt.new Pro", monthly: "$20", yearly: "$240" },
  { name: "v0 Pro", monthly: "$20", yearly: "$240" },
  { name: "Lovable", monthly: "$20", yearly: "$240" },
  { name: "Tilda Personal", monthly: "€15", yearly: "€180" },
];

export function FreeForeverSection({ isAuthed }: Props) {
  return (
    <section
      className="relative px-5 sm:px-8 py-20 sm:py-32 overflow-hidden"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div className="section-tint section-tint-green" aria-hidden />
      <div className="relative max-w-[1100px] mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[12px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--green)" }}>
              бесплатно
            </div>
            <h2
              className="nit-display mb-4"
              style={{ fontSize: "clamp(28px, 5vw, 48px)", color: "var(--ink)" }}
            >
              Экономь <span className="nit-text-gradient-green">$240 в год</span>
            </h2>
            <p className="text-[14px] sm:text-[16px] max-w-[520px] mx-auto" style={{ color: "var(--muted)" }}>
              Облачные AI-конструкторы берут $20 в месяц. NITGEN берёт только твоё время
              на установку. Однажды.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 sm:gap-12 items-center">
          <RevealOnScroll>
            <div className="text-center lg:text-left">
              <div className="nit-big-zero mb-4">0€</div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px]"
                style={{
                  border: "1px solid var(--green)",
                  color: "var(--green)",
                  background: "rgba(34, 197, 94, 0.08)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <span className="nit-dot-live" style={{ width: 6, height: 6 }} />
                навсегда · без карты · без лимитов
              </div>
              <p className="mt-6 text-[14px] sm:text-[15px] max-w-[440px] mx-auto lg:mx-0" style={{ color: "var(--muted)" }}>
                MIT-лицензия. Исходники открыты. Никаких токенов, тарифов, билинга —
                код на твоём железе, все токены бесплатны.
              </p>
              <div className="mt-6 sm:mt-8">
                <a href={isAuthed ? "/app" : "/register"} className="btn-gradient">
                  Начать бесплатно
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={120}>
            <div
              className="rounded-2xl p-5 sm:p-7"
              style={{
                background: "rgba(19, 20, 27, 0.7)",
                border: "1px solid var(--line)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="text-[12px] tracking-[0.15em] uppercase mb-5" style={{ color: "var(--muted-2)" }}>
                Сколько ты не платишь в год
              </div>
              <div className="flex flex-col gap-2.5">
                {COMPETITORS.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <span className="text-[14px] sm:text-[15px]" style={{ color: "var(--ink-dim)" }}>
                      {c.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] hidden sm:inline" style={{ color: "var(--muted-2)" }}>
                        {c.monthly}/мес
                      </span>
                      <span className="nit-strike text-[15px] sm:text-[16px] font-semibold tabular-nums">
                        {c.yearly}
                      </span>
                    </div>
                  </div>
                ))}
                <div
                  className="flex items-center justify-between py-3 mt-2 rounded-lg px-3"
                  style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.35)",
                  }}
                >
                  <span className="text-[15px] sm:text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
                    NITGEN
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] hidden sm:inline" style={{ color: "var(--green)" }}>
                      0€/мес
                    </span>
                    <span className="text-[18px] sm:text-[20px] font-bold tabular-nums" style={{ color: "var(--green)" }}>
                      0€
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
