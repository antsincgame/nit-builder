/**
 * HeroSection — fold-1 экран лендинга.
 *
 * Большой glitch-заголовок "Опиши. Сгенерь. ВЛАДЕЙ." (синхронизирован с
 * editor home.tsx — единый бренд), value-prop с подчёркиванием отличия от
 * cloud-AI, две CTA-кнопки, live status-line с "tunnel · LM Studio · GPU",
 * статистика (22 templates · ~30s · 0$ · 923 tests),
 * справа на десктопе — animated TerminalCodeCard.
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
            <span
              className="inline-flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase px-3 py-1.5"
              style={{
                border: "1px solid var(--magenta)",
                color: "var(--magenta)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: "var(--magenta)",
                  boxShadow: "0 0 6px var(--magenta)",
                  animation: "nit-pulse 1.5s infinite",
                }}
              />
              v2.1 · undo · share · mobile
            </span>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={100}>
          <GlitchHeading lines={["Опиши.", "Сгенерь.", ["ВЛАДЕЙ.", "glitch"]]} />
        </RevealOnScroll>

        <RevealOnScroll delay={200}>
          <p className="text-[16px] leading-[1.7] text-[color:var(--muted)] max-w-[560px] mt-8 mb-4">
            AI-конструктор сайтов где код стримится из{" "}
            <span className="nit-mark">твоего GPU</span> через
            peer-to-peer туннель. Сервер только маршрутизирует — модель крутится
            на твоей машине. Сайт — твой файл, твоё железо, твои данные.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={250}>
          <p className="text-[13px] text-[color:var(--muted-2)] max-w-[560px] mb-10 leading-[1.7]">
            Vercel v0, Bolt, Lovable жгут твои токены и читают твои промпты
            в своих облаках. Мы — нет.{" "}
            <span style={{ color: "var(--acid)" }}>Никаких подписок.
            Никаких лимитов. Никакой телеметрии.</span>
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
      <span className="text-[10px] tracking-[0.15em] uppercase text-[color:var(--muted)] mt-1 block">
        {l}
      </span>
    </div>
  );
}
