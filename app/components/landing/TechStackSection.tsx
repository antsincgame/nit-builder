/**
 * TechStackSection — секция "06 · Under the hood".
 *
 * Для технических buyers и code-savvy юзеров. Показывает реальную
 * внутрянку: pipeline (Planner → Coder → Polisher), RAG (BM25 + embeddings),
 * tunnel security (argon2id + HMAC), test coverage.
 *
 * Layout: terminal-style монобоксы с тегами слева ([AI], [RAG], [API], etc).
 * Не маркетинговый bullet-list, а скорее "вот что у нас под капотом, читай
 * исходник если интересно".
 */

import { RevealOnScroll, SectionLabel } from "~/components/nit";

type Entry = {
  tag: string;
  title: string;
  text: string;
  ref?: string;
};

const ENTRIES: Entry[] = [
  {
    tag: "AI · pipeline",
    title: "3-step caskade: Planner → Coder → Polisher",
    text: "Planner возвращает JSON-план + выбор шаблона (Zod schema, constrained generation). Coder адаптирует HTML-шаблон. Polisher умеет 3 режима правок — css_patch / section-only / full_rewrite (intent classifier выбирает дешёвый где можно).",
    ref: "app/lib/services/pipeline*.ts",
  },
  {
    tag: "RAG",
    title: "BM25 + per-template embeddings",
    text: "BM25-токенайзер с unicode-поддержкой (русские буквы и цифры считаются). Embeddings с contextual prefixes для повышения retrieval-качества. Few-shot инжектируется в Planner для редких категорий.",
    ref: "app/lib/services/bm25.ts · templateRetriever.ts",
  },
  {
    tag: "Templates",
    title: "22 шаблона с annotated section markers",
    text: "Каждый шаблон размечен HTML-комментариями `<!-- ═══ SECTION: id ═══ -->` чтобы помочь маленьким моделям (7B) навигироваться по структуре. Маркеры стрипятся из финального output автоматически.",
    ref: "app/templates/* · 22 категории",
  },
  {
    tag: "PHP · bakery",
    title: "Flat-file CMS из data-edit зон",
    text: "Атрибут `data-edit=\"hero.title\"` в шаблоне → Baker извлекает зоны → выпекает PHP с админкой (login, edit, save). SQLite база, ZIP-бандл, заливаешь на любой shared hosting. Setup-файл с CSPRNG-именем чтобы избежать race на первом запуске.",
    ref: "app/lib/bake/* · htmlToPhp.ts",
  },
  {
    tag: "Tunnel · WSS",
    title: "Peer-to-peer через WebSocket",
    text: "Tauri-клиент / Node CLI держит WSS к серверу. tokio + tokio-tungstenite + rustls. Tokens: двухполевая схема — HMAC-SHA256 (deterministic lookup для индекса) + argon2id (verification). Reconnect 5s→60s exponential backoff.",
    ref: "tunnel/desktop/src-tauri/src/* · wsHandlers.server.ts",
  },
  {
    tag: "Auth · Appwrite",
    title: "Self-hosted на нашей инфре",
    text: "Никаких Cognito/Auth0/Clerk. Self-hosted Appwrite 1.8 на нашем VPS. HttpOnly + SameSite=Lax cookies, CSRF Origin/Referer-чек, persistent guest-quota по hash(ip). Cleanup-cron вытирает истёкшие записи.",
    ref: "app/lib/server/appwrite.server.ts · auth.ts",
  },
  {
    tag: "Tests",
    title: "75 файлов · 923 теста · ESLint strict",
    text: "Vitest, jsdom, RTL для UI. Coverage по lines/functions/statements ≥77%. TypeScript strict + noUnused*. ESLint @typescript-eslint + react-hooks. Regression-suite на Unicode regex (катастрофа с кириллицей в \\b/\\w в v1).",
    ref: "tests/**/*.test.ts · vitest.config.ts",
  },
  {
    tag: "Code · stack",
    title: "React 19 · TS strict · Tailwind v4",
    text: "React Router v7 (SSR) — explicit routes, не file-based. Vite 6. Tailwind v4 через Vite plugin (CSS-first без config). Vercel AI SDK v5 для streaming. Zod для runtime валидации schemas. Никаких legacy CRA или Webpack.",
    ref: "package.json · 0 vulnerabilities",
  },
];

export function TechStackSection() {
  return (
    <section
      id="under-hood"
      className="relative z-10 max-w-[1400px] mx-auto px-8 py-32"
    >
      <RevealOnScroll>
        <SectionLabel number="06">Under the hood</SectionLabel>
      </RevealOnScroll>
      <RevealOnScroll>
        <h2 className="nit-display text-[clamp(36px,5vw,72px)] mb-6 max-w-[900px]">
          Не магия.{" "}
          <em
            className="not-italic"
            style={{ color: "transparent", WebkitTextStroke: "1.5px var(--violet-glow)" }}
          >
            Инженерия
          </em>
          .
        </h2>
      </RevealOnScroll>
      <RevealOnScroll delay={100}>
        <p className="text-[14px] text-[color:var(--muted)] max-w-[700px] leading-[1.7] mb-12">
          Если ты codey-человек и хочешь понять что именно у нас под капотом —
          вот короткий список. Полные исходники в репозитории, читай сколько
          угодно.
        </p>
      </RevealOnScroll>

      <div className="grid md:grid-cols-2 gap-4">
        {ENTRIES.map((e, i) => (
          <RevealOnScroll key={e.title} delay={i * 50}>
            <TechEntry {...e} />
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}

function TechEntry({ tag, title, text, ref }: Entry) {
  return (
    <div
      className="p-6 transition-colors hover:bg-[rgba(157,77,255,0.04)]"
      style={{
        border: "1px solid var(--line)",
        background: "var(--bg)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[9px] tracking-[0.15em] uppercase px-2 py-1"
          style={{
            border: "1px solid var(--violet-glow)",
            color: "var(--violet-glow)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {tag}
        </span>
      </div>
      <h4 className="nit-display text-[18px] mb-2 leading-[1.3]">{title}</h4>
      <p className="text-[12px] text-[color:var(--muted)] leading-[1.7] mb-3">
        {text}
      </p>
      {ref && (
        <code
          className="text-[10px] tracking-[0.05em] block"
          style={{ color: "var(--muted-2)", fontFamily: "var(--font-mono)" }}
        >
          ⏵ {ref}
        </code>
      )}
    </div>
  );
}
