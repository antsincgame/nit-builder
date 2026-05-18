/**
 * ProblemSection — секция "01 · The broken market".
 *
 * 4 problem cards с конкретными pain points cloud-AI билдеров:
 * v0/Bolt/Lovable их ценами, лимитами и vendor-lock'ом.
 * Затем acid-bordered блок с peer-to-peer pitch'ем.
 */

import { Card, Chip, RevealOnScroll, SectionLabel } from "~/components/nit";

type Problem = {
  num: string;
  tag: string;
  title: string;
  text: string;
};

const PROBLEMS: Problem[] = [
  {
    num: "01",
    tag: "$20-50/mo paywall",
    title: "Vercel v0 · Bolt · Lovable",
    text: "v0 Premium $20/мес · 100 msgs/мес. Bolt Pro $20/мес · 10M токенов. Lovable Pro $25/мес · 100 prompts. Правишь дизайн 5 раз — лимит на день съеден. Кодеру дешевле нанять стажёра.",
  },
  {
    num: "02",
    tag: "Your data → их сервера",
    title: "Промпт уезжает к OpenAI",
    text: "Все эти стартапы — обёртки над OpenAI/Anthropic API. Логируется: твой промпт, твой бизнес-план, твоё имя клиента, твои внутренние данные. NDA? Шутить про это в команде не стоит.",
  },
  {
    num: "03",
    tag: "Lock-in by design",
    title: "Чёрные ящики и API",
    text: "Сгенерированный код часто завязан на их runtime / hosting / database. Хочешь съехать на свой сервер — переписывать. Стартап закрылся (это случается) — сайты пропадают вместе с ним.",
  },
  {
    num: "04",
    tag: "Content moderation",
    title: "Кто-то решает что тебе можно",
    text: "Random content moderator завернёт промпт за «триггерное слово». Юридический сайт про оружие, кибербез research, шутка про политику — получи 'I cannot help with that' и неработающий план.",
  },
];

export function ProblemSection() {
  return (
    <section id="problem" className="relative z-10 max-w-[1400px] mx-auto px-8 py-32">
      <RevealOnScroll>
        <SectionLabel number="01">The broken market</SectionLabel>
      </RevealOnScroll>
      <RevealOnScroll>
        <h2 className="nit-display text-[clamp(36px,5vw,72px)] mb-6 max-w-[900px]">
          Облачные AI-билдеры{" "}
          <em
            className="not-italic"
            style={{ color: "transparent", WebkitTextStroke: "1.5px var(--magenta)" }}
          >
            сломаны
          </em>
          .<br />
          И все делают вид, что так и надо.
        </h2>
      </RevealOnScroll>
      <RevealOnScroll delay={100}>
        <p className="text-[15px] text-[color:var(--muted)] max-w-[700px] leading-[1.7] mb-16">
          Vercel v0, Bolt, Lovable, Replit Agent — все они продают одну и ту же
          модель: твой промпт уезжает в их облако, кто-то сжигает{" "}
          <span style={{ color: "var(--magenta)" }}>твои</span> токены,
          кто-то читает{" "}
          <span style={{ color: "var(--magenta)" }}>твои</span> данные, кто-то
          решает что{" "}
          <span style={{ color: "var(--magenta)" }}>тебе</span> можно
          генерить.
        </p>
      </RevealOnScroll>

      <div className="grid md:grid-cols-2 gap-6">
        {PROBLEMS.map((p, i) => (
          <RevealOnScroll key={p.title} delay={i * 80}>
            <ProblemCard {...p} />
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll delay={200}>
        <div
          className="mt-16 p-10 max-w-[900px]"
          style={{
            borderLeft: "3px solid var(--acid)",
            background: "rgba(212,255,0,0.03)",
          }}
        >
          <p className="nit-display text-[24px] font-light leading-[1.4] mb-4">
            Никто не делает{" "}
            <b className="font-bold" style={{ color: "var(--acid)" }}>
              peer-to-peer
            </b>{" "}
            AI-билдер где LLM крутится на железе пользователя, а сервер только
            маршрутизирует.
          </p>
          <p className="text-[14px] text-[color:var(--muted)] leading-[1.7]">
            <span style={{ color: "var(--acid)" }}>Мы делаем.</span>{" "}
            Твой GPU. Твой LM Studio. Твой контроль. Наш сервер — тонкая прокладка
            на 340 строк, без LLM-внутрянки. Если нас закроют, ты ставишь
            self-hosted версию из репозитория и продолжаешь.
          </p>
        </div>
      </RevealOnScroll>
    </section>
  );
}

function ProblemCard({ num, tag, title, text }: Problem) {
  return (
    <Card hoverable className="p-8 group">
      <span
        className="nit-display absolute top-3 right-5 text-[64px] opacity-20 transition-colors"
        style={{ color: "var(--accent)" }}
      >
        {num}
      </span>
      <div className="relative">
        <Chip color="acid">{tag}</Chip>
        <h3 className="nit-display text-[22px] mt-4 mb-3">{title}</h3>
        <p className="text-[13px] text-[color:var(--muted)] leading-[1.7]">
          {text}
        </p>
      </div>
    </Card>
  );
}
