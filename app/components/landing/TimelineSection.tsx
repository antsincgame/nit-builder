/**
 * TimelineSection — секция "08 · Built in the open".
 *
 * Показывает что проект живой и быстро эволюционирует: 5 ключевых
 * milestone'ов за 1.5 месяца разработки. Подкрепляет trust-signal
 * "это не abandonware, это активная разработка".
 *
 * Дополнительный эффект: показывает roadmap не как обещания, а как
 * реальное движение — что уже сделано, а что в работе.
 *
 * Layout: вертикальный timeline слева, с alternating boxes справа.
 * На мобильном — стек.
 */

import { Chip, RevealOnScroll, SectionLabel } from "~/components/nit";

type Milestone = {
  date: string;
  version: string;
  title: string;
  text: string;
  status: "shipped" | "current" | "next";
};

const MILESTONES: Milestone[] = [
  {
    date: "Apr 05",
    version: "v1.0-beta",
    title: "Single-instance cloud tool",
    text: "Первый публичный релиз. 16 шаблонов, Planner→Coder pipeline, Groq/OpenRouter/LM Studio. ~5000 LOC, 65 тестов. Концепт: тогда мы были просто облачным AI-билдером.",
    status: "shipped",
  },
  {
    date: "Apr 06",
    version: "v2.0-alpha",
    title: "Архитектурный pivot · peer-to-peer",
    text: "За один день решено: cloud-AI рынок сломан. Переписали ядро под WSS-туннель — сервер только маршрутизирует, модель крутится на GPU юзера. Tauri-клиент + Node CLI. Это сменило позиционирование принципиально.",
    status: "shipped",
  },
  {
    date: "Apr 15",
    version: "v2.0-beta.1",
    title: "Multi-user · Appwrite · stabilization",
    text: "Auth через self-hosted Appwrite. Tunnel-токены argon2id+HMAC. Мои сайты, истории, persistent guest-quotas. 9 critical fixes (unicode regex, CSRF Bearer bypass, session leak). CI green после 10+ красных коммитов.",
    status: "shipped",
  },
  {
    date: "May 17",
    version: "v2.0-beta.2",
    title: "Post-launch audit · security · docs",
    text: "PHP-bundle setup.php race fix через CSPRNG. Auto-sync NIT_SERVER_VERSION ← package.json. README переписан под v2. README screenshots остаются.",
    status: "shipped",
  },
  {
    date: "May 17",
    version: "v2.1",
    title: "UX polish · undo · share · mobile",
    text: "Polish undo/redo (⌘Z как в IDE), shareable preview links (/p/<token> · 30 дней TTL), mobile UI tabs. 923 теста зелёные. Save-as-Template и Continue-from-history — следующие в очереди.",
    status: "current",
  },
  {
    date: "Q3 2026",
    version: "v3.0",
    title: "Bundled llama.cpp · image generation",
    text: "Встроить llama.cpp в Tauri-клиент — auto-download GGUF, onboarding wizard. SD WebUI / Flux через тот же туннель для inline hero-images. Framework export (React/Vue/Astro/WordPress).",
    status: "next",
  },
];

export function TimelineSection() {
  return (
    <section
      id="timeline"
      className="relative z-10 max-w-[1100px] mx-auto px-8 py-32"
    >
      <RevealOnScroll>
        <SectionLabel number="08">Built in the open</SectionLabel>
      </RevealOnScroll>
      <RevealOnScroll>
        <h2 className="nit-display text-[clamp(36px,5vw,72px)] mb-6">
          Релизы — это{" "}
          <em
            className="not-italic"
            style={{ color: "transparent", WebkitTextStroke: "1.5px var(--accent-glow)" }}
          >
            пульс
          </em>
        </h2>
      </RevealOnScroll>
      <RevealOnScroll delay={100}>
        <p className="text-[14px] text-[color:var(--muted)] leading-[1.7] mb-16 max-w-[700px]">
          От первого commit'а до v2.1 — 6 недель. Каждая дата — это
          реальный merge в `main` с тестами и changelog'ом. Никаких
          месяцев тишины между релизами.
        </p>
      </RevealOnScroll>

      <div className="relative">
        {/* Вертикальная линия */}
        <div
          className="absolute left-[7px] top-2 bottom-2 w-px hidden md:block"
          style={{ background: "var(--line-strong)" }}
        />

        <div className="flex flex-col gap-8">
          {MILESTONES.map((m, i) => (
            <RevealOnScroll key={m.version} delay={i * 80}>
              <MilestoneRow {...m} />
            </RevealOnScroll>
          ))}
        </div>
      </div>

      <RevealOnScroll delay={500}>
        <div className="mt-16 flex flex-wrap items-center gap-3 text-[12px]">
          <span className="text-[color:var(--muted)]">
            ⏵ Полный changelog:
          </span>
          <a
            href="https://github.com/igor1000rr/nit-builder/blob/main/CHANGELOG.md"
            className="no-underline transition-colors hover:text-[color:var(--accent-glow)]"
            style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}
          >
            CHANGELOG.md ↗
          </a>
          <span className="text-[color:var(--muted-2)]">·</span>
          <a
            href="https://github.com/igor1000rr/nit-builder/commits/main"
            className="no-underline transition-colors hover:text-[color:var(--accent-glow)]"
            style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}
          >
            Все коммиты ↗
          </a>
        </div>
      </RevealOnScroll>
    </section>
  );
}

function MilestoneRow({ date, version, title, text, status }: Milestone) {
  const dotColor =
    status === "shipped"
      ? "var(--accent-glow)"
      : status === "current"
      ? "var(--acid)"
      : "var(--violet-glow)";

  return (
    <div className="grid md:grid-cols-[160px_1fr] gap-6 items-start">
      {/* Дата + dot */}
      <div className="flex items-start gap-4">
        <span
          className="block w-4 h-4 rounded-full shrink-0 mt-1"
          style={{
            background: dotColor,
            boxShadow:
              status === "current"
                ? "0 0 12px var(--acid)"
                : `0 0 6px ${dotColor}`,
          }}
        />
        <div>
          <div
            className="text-[11px] tracking-[0.15em] uppercase"
            style={{ color: dotColor, fontFamily: "var(--font-mono)" }}
          >
            {date}
          </div>
          <div className="text-[10px] text-[color:var(--muted-2)] mt-1">
            {version}
          </div>
        </div>
      </div>

      {/* Card */}
      <div
        className="p-6 transition-colors hover:bg-[rgba(0,212,255,0.04)]"
        style={{
          border: "1px solid var(--line)",
          background: "var(--bg)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h4 className="nit-display text-[18px] leading-[1.3]">{title}</h4>
          {status === "current" && <Chip color="acid">⏵ NOW</Chip>}
          {status === "next" && (
            <span
              className="text-[9px] tracking-[0.15em] uppercase px-2 py-1"
              style={{
                color: "var(--violet-glow)",
                border: "1px solid var(--violet-glow)",
                fontFamily: "var(--font-mono)",
              }}
            >
              next
            </span>
          )}
        </div>
        <p className="text-[12px] text-[color:var(--muted)] leading-[1.7]">
          {text}
        </p>
      </div>
    </div>
  );
}
