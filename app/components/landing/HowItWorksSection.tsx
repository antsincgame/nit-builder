/**
 * HowItWorksSection v4.1 — убраны "HTML-файл» и "хостинг».
 */

import { RevealOnScroll } from "~/components/landing/RevealOnScroll";

const STEPS = [
  {
    num: "1",
    title: "Расскажите о себе",
    desc: "Одно предложение простыми словами — что вы делаете и для кого.",
    color: "var(--cyan)",
  },
  {
    num: "2",
    title: "Смотрите, как появляется сайт",
    desc: "Приложение подберёт дизайн и всё напишет. Вы видите результат прямо на экране.",
    color: "var(--violet)",
  },
  {
    num: "3",
    title: "Сохраните и пользуйтесь",
    desc: "Готовый сайт одним файлом. Открывается в любом браузере — можно выложить в интернет или показывать клиентам.",
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
              Как это работает
            </h2>
            <p className="text-[14px] sm:text-[16px]" style={{ color: "var(--muted)" }}>
              Три шага — около одной минуты.
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
                  className="font-bold text-[28px] sm:text-[32px] mb-3 leading-none"
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
