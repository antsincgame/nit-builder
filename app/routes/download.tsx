import { useState } from "react";
import type { MetaFunction } from "react-router";
import { useAuth } from "~/lib/contexts/AuthContext";

export const meta: MetaFunction = () => [
  { title: "Скачать · NITGEN" },
  {
    name: "description",
    content: "Приложение для Windows, Mac и Linux — скоро выйдет.",
  },
  { name: "robots", content: "noindex" },
];

/**
 * Download v2 — человекоориентированная страница «Скачать».
 *
 * Раньше была инструкция для разработчиков: git clone, npm install,
 * LM Studio Server, --token YOUR_TOKEN, GPU 6+ GB VRAM и т.д. Обычный
 * человек это не выполнит.
 *
 * Теперь: вверху — заглушка «Скоро · введите email» (как в DownloadModal),
 * внизу — раскрывающийся блок «Для разработчиков» с оригинальной инструкцией
 * по CLI — кто ищет локальный запуск, найдёт за один клик.
 */

const SERVER_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/tunnel`
    : "wss://nit.vibecoding.by/api/tunnel";

export default function Download() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const submitWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    const v = email.trim();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setEmailError("Проверьте правильность email");
      return;
    }
    try {
      const subs = JSON.parse(localStorage.getItem("desktop-waitlist") || "[]");
      if (!subs.includes(v)) subs.push(v);
      localStorage.setItem("desktop-waitlist", JSON.stringify(subs));
    } catch {
      /* ignore */
    }
    setSubmitted(true);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {
        setCopied(`${key}-failed`);
        setTimeout(() => setCopied(null), 2000);
      });
  };

  return (
    <div className="relative min-h-screen text-[color:var(--ink)] overflow-hidden">
      <div className="nit-bg-mesh" aria-hidden>
        <div className="nit-bg-mesh-orb nit-bg-mesh-1" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-2" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-3" />
      </div>
      <div className="nit-bg-grid" aria-hidden />

      <header
        className="relative z-10 px-5 sm:px-8 py-5 max-w-[1200px] mx-auto flex items-center justify-between"
      >
        <a href="/" className="flex items-center gap-2 no-underline">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[14px]"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            N
          </div>
          <span className="text-[15px] font-semibold text-[color:var(--ink)]">nitgen</span>
        </a>
        <a href="/" className="text-[13px] transition-colors" style={{ color: "var(--muted)" }}>
          ← Назад
        </a>
      </header>

      <main className="relative z-10 max-w-[640px] mx-auto px-5 sm:px-8 pt-8 sm:pt-16 pb-20">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full text-[11px] font-semibold"
            style={{
              background: "rgba(251, 191, 36, 0.1)",
              border: "1px solid rgba(251, 191, 36, 0.35)",
              color: "var(--amber)",
            }}
          >
            Скоро
          </div>
          <h1
            className="nit-display mb-4"
            style={{ fontSize: "clamp(32px, 5.5vw, 48px)", color: "var(--ink)" }}
          >
            Приложение
            <br />
            <span className="nit-text-gradient-cyan">для компьютера</span>
          </h1>
          <p
            className="max-w-[460px] mx-auto"
            style={{ fontSize: "clamp(15px, 2vw, 16px)", color: "var(--muted)", lineHeight: 1.6 }}
          >
            Готовим версии для Windows, Mac и Linux. Оставьте email — пришлём ссылку, как только будет готово.
          </p>
        </div>

        <div
          className="rounded-2xl p-5 sm:p-7 mb-8"
          style={{
            background: "rgba(19, 20, 27, 0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--line-strong)",
          }}
        >
          {!submitted ? (
            <form onSubmit={submitWaitlist} className="space-y-3">
              <label
                htmlFor="download-email"
                className="block text-[13px] font-medium mb-1.5"
                style={{ color: "var(--ink-dim)" }}
              >
                Ваш email
              </label>
              <input
                id="download-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vasha@pochta.ru"
                autoComplete="email"
                required
                className="w-full px-4 py-3 text-[15px] outline-none rounded-lg transition"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--line-strong)",
                  color: "var(--ink)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--cyan)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--line-strong)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {emailError && (
                <div className="text-[13px]" style={{ color: "var(--pink)" }}>
                  {emailError}
                </div>
              )}
              <button type="submit" className="btn-primary w-full" style={{ padding: "12px 22px" }}>
                Прислать ссылку
              </button>
              <a
                href={auth.status === "authenticated" ? "/app" : "/register"}
                className="block text-center text-[13px] py-2 transition"
                style={{ color: "var(--muted-2)" }}
              >
                Попробовать сейчас в браузере →
              </a>
            </form>
          ) : (
            <div className="text-center py-2">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid var(--green)",
                  color: "var(--green)",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="nit-display mb-3" style={{ fontSize: 22, color: "var(--ink)" }}>
                Готово
              </h2>
              <p className="text-[14px]" style={{ color: "var(--muted)", lineHeight: 1.55 }}>
                Пришлём ссылку на <span style={{ color: "var(--ink)" }}>{email}</span>, как только
                приложение будет готово.
              </p>
            </div>
          )}
        </div>

        {/* Platforms preview */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { name: "Windows", icon: "⊞" },
            { name: "Mac", icon: "⌘" },
            { name: "Linux", icon: "⏻" },
          ].map((p) => (
            <div
              key={p.name}
              className="rounded-xl p-4 text-center"
              style={{
                background: "rgba(19, 20, 27, 0.6)",
                border: "1px solid var(--line)",
              }}
            >
              <div className="text-2xl mb-2" style={{ color: "var(--muted)" }}>
                {p.icon}
              </div>
              <div className="text-[12px] font-medium" style={{ color: "var(--ink-dim)" }}>
                {p.name}
              </div>
            </div>
          ))}
        </div>

        {/* Developer collapse — спрятано под expander, обычные юзеры не видят */}
        <button
          type="button"
          onClick={() => setDevOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition"
          style={{
            background: "transparent",
            border: "1px solid var(--line)",
            color: "var(--muted)",
          }}
        >
          <span className="text-[13px] flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Для разработчиков
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: devOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {devOpen && (
          <div
            className="mt-3 rounded-lg p-5 space-y-5 text-[13px]"
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              lineHeight: 1.6,
            }}
          >
            <p>
              До релиза десктопного клиента можно запустить CLI вручную. Нужны: Node.js 20+,
              LM Studio (лучше Qwen2.5-Coder-7B-Q4), GPU с 6+ GB VRAM и tunnel-токениз{" "}
              <a href="/register" style={{ color: "var(--cyan)" }} className="transition-colors">
                регистрации
              </a>
              .
            </p>

            <div>
              <div
                className="text-[11px] tracking-[0.15em] uppercase mb-2 font-mono"
                style={{ color: "var(--cyan)" }}
              >
                1. Clone &amp; install
              </div>
              <CodeBlock
                code={`git clone https://github.com/igor1000rr/nit-builder.git\ncd nit-builder\nnpm install`}
                copyKey="clone"
                copied={copied}
                onCopy={copy}
              />
            </div>

            <div>
              <div
                className="text-[11px] tracking-[0.15em] uppercase mb-2 font-mono"
                style={{ color: "var(--cyan)" }}
              >
                2. Start LM Studio Server (localhost:1234)
              </div>
              <p className="text-[12px]" style={{ color: "var(--muted-2)" }}>
                Открой LM Studio → загрузи модель → во вкладке Server нажми Start Server.
              </p>
            </div>

            <div>
              <div
                className="text-[11px] tracking-[0.15em] uppercase mb-2 font-mono"
                style={{ color: "var(--cyan)" }}
              >
                3. Run tunnel
              </div>
              <CodeBlock
                code={`cd tunnel\nnpm run dev -- \\\n  --token YOUR_TOKEN \\\n  --server ${SERVER_URL} \\\n  --lm-studio http://localhost:1234/v1`}
                copyKey="run"
                copied={copied}
                onCopy={copy}
              />
            </div>

            <p className="text-[12px]" style={{ color: "var(--muted-2)" }}>
              Исходники:{" "}
              <a
                href="https://github.com/igor1000rr/nit-builder"
                target="_blank"
                rel="noopener"
                style={{ color: "var(--cyan)" }}
                className="transition-colors"
              >
                github.com/igor1000rr/nit-builder
              </a>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function CodeBlock({
  code,
  copyKey,
  copied,
  onCopy,
}: {
  code: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className="relative">
      <pre
        className="p-4 text-[11px] font-mono overflow-x-auto leading-[1.65] rounded-lg"
        style={{
          background: "rgba(0,0,0,0.5)",
          border: "1px solid var(--line-strong)",
          color: "var(--ink-dim)",
        }}
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => onCopy(code, copyKey)}
        className="absolute top-2 right-2 px-2.5 py-1 text-[10px] font-semibold rounded transition"
        style={{
          background: copied === copyKey ? "var(--green)" : "var(--bg-elev)",
          color: copied === copyKey ? "var(--bg)" : "var(--ink-dim)",
          border: "1px solid var(--line-strong)",
        }}
      >
        {copied === copyKey ? "✓" : "Copy"}
      </button>
    </div>
  );
}
