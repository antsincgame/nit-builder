/**
 * HowItWorksSection v3.2 — amber tint + reveal animations + colored step numbers.
 */

import { RevealOnScroll } from "~/components/landing/RevealOnScroll";

const STEPS = [
  {
    num: "01",
    title: "Опиши сайт",
    desc: "Одно предложение на русском. AI разбирается в типе бизнеса, тоне и секциях.",
    color: "var(--cyan)",
  },
  {
    num: "02",
    title: "Подбор шаблона",
    desc: "Planner LLM выбирает подходящий из 23 и формирует JSON-план с цветами и структурой.",
    color: "var(--violet)",
  },
  {
    num: "03",
    title: "Стриминг HTML",
    desc: "Coder LLM адаптирует шаблон под твой план. HTML стримится в preview в реальном времени.",
    color: "var(--amber)",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how" className="relative px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="section-tint section-tint-amber" aria-hidden />
      <div className="relative max-w-[1100px] mx-auto">
        <RevealOnScroll>
          <div className="mb-8 sm:mb-12">
            <div className="text-[12px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--amber)" }}>
              Как это работает
            </div>
            <h2
              className="nit-display mb-3"
              style={{ fontSize: "clamp(28px, 4.5vw, 44px)", color: "var(--ink)" }}
            >
              Три шага — <span style={{ color: "var(--amber)" }}>30 секунд</span>
            </h2>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {STEPS.map((s, i) => (
            <RevealOnScroll key={s.num} delay={i * 100}>
              <div
                className="nit-card-glow p-6 sm:p-7 rounded-xl h-full"
                style={{ border: "1px solid var(--line)" }}
              >
                <div
                  className="font-mono text-[24px] sm:text-[28px] font-bold mb-4"
                  style={{ color: s.color, textShadow: `0 0 20px ${s.color}` }}
                >
                  {s.num}
                </div>
                <h3
                  className="font-semibold mb-2 text-[18px] sm:text-[20px]"
                  style={{ color: "var(--ink)" }}
                >
                  {s.title}
                </h3>
                <p className="text-[14px] leading-[1.55]" style={{ color: "var(--muted)" }}>
                  {s.desc}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
