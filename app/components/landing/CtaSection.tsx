/**
 * CtaSection — финальный CTA-блок перед футером.
 *
 * Раньше был "Готов запустить тоннель?" с двумя кнопками. Теперь —
 * последовательность из 4 конкретных шагов с временными оценками,
 * чтобы юзер видел весь путь до первой генерации (~7 минут реально).
 *
 * Сильнее push'аем: время, понятный путь, две CTA + footer-надпись
 * "Self-hosted на VPS · GitHub" для trust-сигнала.
 */

import { NitButton, RevealOnScroll } from "~/components/nit";

type Props = {
  isAuthed: boolean;
};

type Step = {
  num: string;
  title: string;
  time: string;
  text: string;
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Скачай LM Studio",
    time: "~3 мин",
    text: "lmstudio.ai — бесплатно, есть для Windows / Mac / Linux. Установи Qwen2.5-Coder-7B (~4.5 ГБ) через built-in search.",
  },
  {
    num: "02",
    title: "Регистрация",
    time: "~30 сек",
    text: "Один email — получаешь tunnel-token. Это всё, без подписки и кредитки.",
  },
  {
    num: "03",
    title: "Запусти tunnel CLI",
    time: "~1 мин",
    text: "Скачай Tauri-клиент / Node CLI. Вставь токен. Кнопка Start.",
  },
  {
    num: "04",
    title: "Generate",
    time: "~30 сек",
    text: "Открой editor, опиши сайт. Код стримится из твоего GPU прямо в превью.",
  },
];

export function CtaSection({ isAuthed }: Props) {
  return (
    <section className="relative z-10 max-w-[1200px] mx-auto px-8 my-32">
      <RevealOnScroll>
        <div
          className="relative overflow-hidden px-10 py-16 md:py-20"
          style={{
            border: "1px solid var(--line-strong)",
            background:
              "radial-gradient(ellipse at center, rgba(0,212,255,0.12), transparent 70%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
              WebkitMaskImage:
                "radial-gradient(ellipse at center, #000, transparent 70%)",
              maskImage: "radial-gradient(ellipse at center, #000, transparent 70%)",
            }}
          />

          <div className="relative">
            <div className="text-center mb-12">
              <h2 className="nit-display text-[clamp(36px,5vw,72px)] mb-4">
                От нуля до{" "}
                <em
                  className="not-italic"
                  style={{ color: "transparent", WebkitTextStroke: "1.5px var(--acid)" }}
                >
                  первого сайта
                </em>
              </h2>
              <p
                className="text-[14px] tracking-[0.15em] uppercase"
                style={{ color: "var(--acid)" }}
              >
                ⏵ ≈ 7 минут реального времени
              </p>
            </div>

            {/* 4-step timeline */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {STEPS.map((s, i) => (
                <StepBlock key={s.num} {...s} delay={i * 100} />
              ))}
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-4 justify-center mb-6">
              <NitButton href={isAuthed ? "/" : "/register"} variant="primary">
                {isAuthed ? "Go to editor →" : "Start now →"}
              </NitButton>
              <NitButton href="/download" variant="ghost">
                ↓ Download tunnel
              </NitButton>
              <NitButton href="https://github.com/igor1000rr/nit-builder" variant="ghost">
                ★ Star on GitHub
              </NitButton>
            </div>

            <p
              className="text-center text-[10px] tracking-[0.2em] uppercase"
              style={{ color: "var(--muted-2)" }}
            >
              Self-hosted · MIT · 0 vulnerabilities · 923 tests passing
            </p>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

function StepBlock({
  num,
  title,
  time,
  text,
  delay,
}: Step & { delay: number }) {
  return (
    <RevealOnScroll delay={delay}>
      <div
        className="p-5 h-full transition-colors hover:bg-[rgba(0,212,255,0.04)]"
        style={{
          border: "1px solid var(--line)",
          background: "rgba(5,6,10,0.5)",
        }}
      >
        <div className="flex items-baseline justify-between mb-3">
          <span
            className="nit-display text-[28px] leading-none"
            style={{ color: "var(--accent-glow)" }}
          >
            {num}
          </span>
          <span
            className="text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5"
            style={{
              color: "var(--acid)",
              border: "1px solid var(--acid)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {time}
          </span>
        </div>
        <h4 className="nit-display text-[15px] mb-2 leading-[1.3]">{title}</h4>
        <p className="text-[11px] text-[color:var(--muted)] leading-[1.7]">
          {text}
        </p>
      </div>
    </RevealOnScroll>
  );
}
