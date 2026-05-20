/**
 * TemplatesSection — карточки с hover-эффектом (cursor-tracking glow + lift).
 */

import { useRef } from "react";

const TEMPLATES = [
  { emoji: "☕", name: "Кофейня", id: "coffee-shop" },
  { emoji: "💈", name: "Барбершоп", id: "barbershop" },
  { emoji: "📸", name: "Фотограф", id: "photographer" },
  { emoji: "💻", name: "Портфолио", id: "portfolio-dev" },
  { emoji: "💒", name: "Свадьба", id: "wedding" },
  { emoji: "💪", name: "Фитнес", id: "fitness-trainer" },
  { emoji: "🍽️", name: "Ресторан", id: "restaurant" },
  { emoji: "💅", name: "Бьюти-мастер", id: "beauty-master" },
  { emoji: "🖤", name: "Тату-студия", id: "tattoo-studio" },
  { emoji: "🎧", name: "DJ / Музыкант", id: "dj-music" },
  { emoji: "🚀", name: "SaaS / Продукт", id: "saas-landing" },
  { emoji: "🏠", name: "Недвижимость", id: "real-estate" },
];

function TemplateCard({ t }: { t: (typeof TEMPLATES)[number] }) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <a
      ref={ref}
      href={`/register?template=${t.id}`}
      className="nit-card-glow p-5 sm:p-6 rounded-xl no-underline flex flex-col gap-3"
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
      }}
      onMouseMove={onMouseMove}
    >
      <div className="text-2xl sm:text-3xl">{t.emoji}</div>
      <div className="text-[14px] sm:text-[15px] font-semibold text-[color:var(--ink)]">
        {t.name}
      </div>
    </a>
  );
}

export function TemplatesSection() {
  return (
    <section className="px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-8 sm:mb-12">
          <div className="text-[12px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--muted-2)" }}>
            Готовые шаблоны
          </div>
          <h2
            className="nit-display mb-3"
            style={{ fontSize: "clamp(28px, 4.5vw, 44px)", color: "var(--ink)" }}
          >
            23 готовых шаблона
          </h2>
          <p className="text-[14px] sm:text-[16px] max-w-[560px]" style={{ color: "var(--muted)" }}>
            АИ подбирает подходящий и адаптирует его под твой бизнес — работает стабильно
            даже на 7B модели.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} t={t} />
          ))}
        </div>

        <div className="mt-8 sm:mt-10 text-center">
          <a href="/register" className="btn-ghost">
            Смотреть все 23 шаблона →
          </a>
        </div>
      </div>
    </section>
  );
}
