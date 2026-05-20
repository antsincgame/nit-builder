/**
 * HeroSection — fold-1 экран лендинга.
 *
 * Большой glitch-заголовок "Опиши. Сгенерь. ВЛАДЕЙ." (синхронизирован с
 * editor home.tsx — единый бренд), value-prop с подчёркиванием отличия от
 * cloud-AI, две CTA-кнопки, статистика (22 templates · ~30s · 0$ · 923 tests),
 * справа на десктопе — animated TerminalCodeCard.
 *
 * v2.2: убран шумный второй чип и второй параграф — фидбек по читаемости.
 */

import { Chip, GlitchHeading, NitButton, RevealOnScroll } from "~/components/nit";
import { TerminalCodeCard } from "~/components/nit/TerminalCodeCard";

type Props = {
  isAuthed: boolean;
};

export function HeroSection({ isAuthed }: Props) {
  return (
    <header className="relative z-10 max-w-[1400px] mx-auto px-8 pt-[140px] pb-20 grid lg:grid-cols-[1.2fr_0.8fr] gap-16 items-center min-h-screen">
      <div>
        <RevealOnScroll>
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Chip color="acid">⏵ AI editor · powered by YOUR GPU</Chip>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={100}>
          <GlitchHeading lines={["Опиши.", "Сгенерь.", ["ВЛАДЕЙ.", "glitch"]]} />
        </RevealOnScroll>

        <RevealOnScroll delay={200}>
          <p className="text-[17px] leading-[1.65] text-[color:var(--ink-dim)] max-w-[560px] mt-8 mb-10">
            AI-конструктор сайтов где код стримится из{" "}
            <span className="nit-mark">твоего GPU</span> через
            peer-to-peer туннель. Сервер только маршрутизирует — модель крутится
            на твоей машине. Сайт — твой файл, твоё железо, твои данные.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={300}>
          <div className="flex flex-wrap gap-4 mb-12">
            <NitButton href={isAuthed ? "/" : "/register"} variant="primary">
              {isAuthed ? "Open editor →" : "Start free →"}
            </NitButton>
            <NitButton href="#how" variant="ghost">
              Как это работает
            </NitButton>
            <NitButton href="https://github.com/igor1000rr/nit-builder" variant="ghost">
              ★ GitHub
            </NitButton>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={400}>
          <div
            className="flex flex-wrap gap-8 pt-8"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <Stat n="22" l="HTML templates" />
            <Stat n="~30s" l="Avg full landing" />
            <Stat n="0$" l="Forever · MIT" />
            <Stat n="923" l="Tests passing" />
          </div>
        </RevealOnScroll>
      </div>

      <RevealOnScroll delay={150}>
        <TerminalCodeCard />
      </RevealOnScroll>
    </header>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <span
        className="nit-display block text-[28px]"
        style={{ color: "var(--accent-glow)" }}
      >
        {n}
      </span>
      <span className="text-[11px] tracking-[0.15em] uppercase text-[color:var(--ink-dim)] mt-1 block font-mono">
        {l}
      </span>
    </div>
  );
}
