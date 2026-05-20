/**
 * TemplatesSection v4 — упрощённый язык, без "7B» и "SaaS".
 */

import { useRef } from "react";
import { RevealOnScroll } from "~/components/landing/RevealOnScroll";

const TEMPLATES = [
  { emoji: "☕", name: "Кофейня", id: "coffee-shop" },
  { emoji: "💈", name: "Барбершоп", id: "barbershop" },
  { emoji: "📸", name: "Фотограф", id: "photographer" },
  { emoji: "👤", name: "Личная страница", id: "portfolio-dev" },
  { emoji: "💒", name: "Свадьба", id: "wedding" },
  { emoji: "💪", name: "Фитнес-тренер", id: "fitness-trainer" },
  { emoji: "🍽️", name: "Ресторан", id: "restaurant" },
  { emoji: "💅", name: "Мастер красоты", id: "beauty-master" },
  { emoji: "🖤", name: "Тату-студия", id: "tattoo-studio" },
  { emoji: "🎧", name: "Диджей / Музыкант", id: "dj-music" },
  { emoji: "🚀", name: "Свой бизнес", id: "saas-landing" },
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
      style={{ border: "1px solid var(--line)" }}
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
    <section className="relative px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="section-tint section-tint-violet" aria-hidden />
      <div className="relative max-w-[1100px] mx-auto">
        <RevealOnScroll>
          <div className="mb-8 sm:mb-12 text-center">
            <h2
              className="nit-display mb-3"
              style={{ fontSize: "clamp(26px, 4vw, 38px)", color: "var(--ink)" }}
            >
              Сайт для любого дела
            </h2>
            <p className="text-[14px] sm:text-[16px] max-w-[520px] mx-auto" style={{ color: "var(--muted)" }}>
              Приложение само подберёт подходящий вариант и настроит его под вас.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {TEMPLATES.map((t, i) => (
            <RevealOnScroll key={t.id} delay={i * 35}>
              <TemplateCard t={t} />
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll delay={200}>
          <div className="mt-8 sm:mt-10 text-center">
            <a href="/register" className="btn-ghost">
              Посмотреть все варианты →
            </a>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
