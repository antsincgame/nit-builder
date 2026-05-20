/**
 * HowItWorksSection — 3 шага как это работает.
 * Минималистичный дизайн, 3 карточки с схемой пайплайна.
 */

const STEPS = [
  {
    num: "01",
    title: "Опиши сайт",
    desc: "Одно предложение на русском. AI разбирается в типе бизнеса, тоне и секциях.",
  },
  {
    num: "02",
    title: "Подбор шаблона",
    desc: "Planner LLM выбирает подходящий из 23 и формирует JSON-план с цветами и структурой.",
  },
  {
    num: "03",
    title: "Стриминг HTML",
    desc: "Coder LLM адаптирует шаблон под твой план. HTML стримится в preview в реальном времени.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how" className="px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-8 sm:mb-12">
          <div className="text-[12px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--muted-2)" }}>
            Как это работает
          </div>
          <h2
            className="nit-display mb-3"
            style={{ fontSize: "clamp(28px, 4.5vw, 44px)", color: "var(--ink)" }}
          >
            Три шага — 30 секунд
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="p-6 sm:p-7 rounded-xl"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
              }}
            >
              <div
                className="font-mono text-[13px] mb-4"
                style={{ color: "var(--muted-2)" }}
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
          ))}
        </div>
      </div>
    </section>
  );
}
