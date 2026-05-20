/**
 * HowItWorksSection v4 — упрощённый язык, без «Planner LLM»/«Coder LLM».
 */

import { RevealOnScroll } from "~/components/landing/RevealOnScroll";

const STEPS = [
  {
    num: "01",
    title: "Расскажите о бизнесе",
    desc: "Одно предложение простыми словами — что вы делаете и для кого.",
    color: "var(--cyan)",
  },
  {
    num: "02",
    title: "Смотрите как рождается сайт",
    desc: "Приложение подберёт дизайн и структуру. Прямо на экране — в прямом эфире.",
    color: "var(--violet)",
  },
  {
    num: "03",
    title: "Скачайте файл",
    desc: "Один HTML-файл. Открывается в любом браузере, поднимается на любом хостинге.",
    color: "var(--amber)",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how" className="relative px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="section-tint section-tint-amber" aria-hidden />
      <div className="relative max-w-[1100px] mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-10 sm:mb-14">
            <h2
              className="nit-display mb-3"
              style={{ fontSize: "clamp(26px, 4vw, 38px)", color: "var(--ink)" }}
            >
              Три шага до вашего сайта
            </h2>
            <p className="text-[14px] sm:text-[16px]" style={{ color: "var(--muted)" }}>
              Занимает около минуты.
            </p>
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
                  className="font-mono text-[22px] sm:text-[26px] font-bold mb-4"
                  style={{ color: s.color, textShadow: `0 0 18px ${s.color}` }}
                >
                  {s.num}
                </div>
                <h3
                  className="font-semibold mb-2 text-[17px] sm:text-[18px]"
                  style={{ color: "var(--ink)" }}
                >
                  {s.title}
                </h3>
                <p className="text-[14px] leading-[1.6]" style={{ color: "var(--muted)" }}>
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
