/**
 * WhySection v4 — упрощённый язык, без Bolt.new/Tilda в подзаголовке.
 */

import { RevealOnScroll } from "~/components/landing/RevealOnScroll";

const REASONS = [
  {
    icon: "💰",
    title: "Бесплатно навсегда",
    desc: "Никаких подписок и платных возможностей. Сколько хотите сайтов — столько и делаете.",
    color: "var(--green)",
  },
  {
    icon: "✨",
    title: "Просто как описать",
    desc: "Напишите «Кофейня в Минске с меню» — получите готовый сайт. Не нужны знания программирования.",
    color: "var(--cyan)",
  },
  {
    icon: "🔒",
    title: "Ваши данные у вас",
    desc: "Приложение работает на вашем компьютере. Мы не видим и не храним то, что вы создаёте.",
    color: "var(--violet)",
  },
];

export function WhySection() {
  return (
    <section className="relative px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="section-tint section-tint-violet" aria-hidden />
      <div className="relative max-w-[1100px] mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-10 sm:mb-14">
            <h2
              className="nit-display mb-3"
              style={{ fontSize: "clamp(26px, 4vw, 38px)", color: "var(--ink)" }}
            >
              Почему люди выбирают нас
            </h2>
            <p className="text-[14px] sm:text-[16px] max-w-[480px] mx-auto" style={{ color: "var(--muted)" }}>
              Три простых причины попробовать.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {REASONS.map((r, i) => (
            <RevealOnScroll key={r.title} delay={i * 100}>
              <div
                className="nit-card-glow p-6 sm:p-7 rounded-xl h-full"
                style={{ border: "1px solid var(--line)" }}
              >
                <div
                  className="text-3xl mb-4"
                  style={{ filter: `drop-shadow(0 0 14px ${r.color})` }}
                >
                  {r.icon}
                </div>
                <h3
                  className="font-semibold mb-2 text-[17px] sm:text-[18px]"
                  style={{ color: "var(--ink)" }}
                >
                  {r.title}
                </h3>
                <p className="text-[14px] leading-[1.6]" style={{ color: "var(--muted)" }}>
                  {r.desc}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
