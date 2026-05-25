import { useState } from "react";
import type { MetaFunction } from "react-router";
import { Check, ChevronDown, Code2, Monitor, Apple, Terminal, ArrowRight, Clock } from "lucide-react";
import { useAuth } from "~/lib/contexts/AuthContext";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";

export const meta: MetaFunction = () => [
  { title: "Скачать · nitgen" },
  {
    name: "description",
    content: "Приложение для Windows, macOS и Linux — скоро выйдет. Оставьте email и получите ссылку.",
  },
  { name: "robots", content: "noindex" },
];

/**
 * Download v3 — выровнян под эстетику лендинга: чёрный #0A0A0A,
 * NeuralBackground, emerald-акценты, lucide иконки. Логика waitlist
 * и дев-секции с git/LM Studio/tunnel не тронута.
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
    <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-hidden">
      <NeuralBackground />

      <header className="relative z-10 px-5 sm:px-8 py-5 max-w-[1200px] mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <Logo size={32} />
          <span className="font-semibold text-[15px] text-white tracking-tight">nitgen</span>
        </a>
        <a href="/" className="text-[13px] text-[#71717A] hover:text-white transition-colors">
          ← Назад
        </a>
      </header>

      <main className="relative z-10 max-w-[640px] mx-auto px-5 sm:px-8 pt-8 sm:pt-16 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full border border-amber-500/30 bg-amber-500/[0.08]">
            <Clock size={12} className="text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-300">Скоро</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-white mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.06)]">
            Приложение
            <br />
            <span className="bg-gradient-to-r from-white via-white/90 to-emerald-200/80 bg-clip-text text-transparent">
              для компьютера
            </span>
          </h1>
          <p className="max-w-[460px] mx-auto text-[15px] sm:text-base text-[#A1A1AA] leading-relaxed">
            Готовим версии для Windows, macOS и Linux. Оставьте email — пришлём ссылку, как только будет готово.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-5 sm:p-7 mb-8">
          {!submitted ? (
            <form onSubmit={submitWaitlist} className="space-y-4">
              <div>
                <label
                  htmlFor="download-email"
                  className="block text-[13px] font-medium mb-1.5 text-[#A1A1AA]"
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
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              {emailError && (
                <div className="p-3 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.08] text-rose-300">
                  {emailError}
                </div>
              )}
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
              >
                Прислать ссылку
                <ArrowRight size={14} />
              </button>
              <a
                href={auth.status === "authenticated" ? "/app" : "/register"}
                className="block text-center text-[13px] py-2 text-[#71717A] hover:text-emerald-300 transition-colors"
              >
                Попробовать сейчас в браузере →
              </a>
            </form>
          ) : (
            <div className="text-center py-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5 border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400">
                <Check size={26} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white mb-3">Готово</h2>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                Пришлём ссылку на <span className="text-white">{email}</span>, как только
                приложение будет готово.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { name: "Windows", icon: <Monitor size={20} /> },
            { name: "macOS", icon: <Apple size={20} /> },
            { name: "Linux", icon: <Terminal size={20} /> },
          ].map((p) => (
            <div
              key={p.name}
              className="rounded-xl border border-white/[0.06] bg-[#141414] p-4 text-center hover:border-white/[0.12] transition-colors"
            >
              <div className="flex justify-center mb-2 text-white/60">{p.icon}</div>
              <div className="text-[12px] font-medium text-[#A1A1AA]">{p.name}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setDevOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/[0.06] hover:border-white/[0.12] text-[#71717A] hover:text-white transition"
        >
          <span className="text-[13px] flex items-center gap-2">
            <Code2 size={14} />
            Для разработчиков
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${devOpen ? "rotate-180" : ""}`}
          />
        </button>

        {devOpen && (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/30 p-5 space-y-5 text-[13px] text-[#A1A1AA] leading-relaxed">
            <p>
              До релиза десктопного клиента можно запустить CLI вручную.
              Нужны: Node.js 20+, LM Studio (лучше Qwen2.5-Coder-7B-Q4),
              GPU с 6+ ГБ VRAM и tunnel-токен из{" "}
              <a href="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                регистрации
              </a>
              .
            </p>

            <div>
              <div className="text-[11px] tracking-[0.15em] uppercase mb-2 font-mono text-emerald-400/80">
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
              <div className="text-[11px] tracking-[0.15em] uppercase mb-2 font-mono text-emerald-400/80">
                2. Start LM Studio Server (localhost:1234)
              </div>
              <p className="text-[12px] text-[#71717A]">
                Открой LM Studio → загрузи модель → во вкладке Server нажми Start Server.
              </p>
            </div>

            <div>
              <div className="text-[11px] tracking-[0.15em] uppercase mb-2 font-mono text-emerald-400/80">
                3. Run tunnel
              </div>
              <CodeBlock
                code={`cd tunnel\nnpm run dev -- \\\n  --token YOUR_TOKEN \\\n  --server ${SERVER_URL} \\\n  --lm-studio http://localhost:1234/v1`}
                copyKey="run"
                copied={copied}
                onCopy={copy}
              />
            </div>

            <p className="text-[12px] text-[#71717A]">
              Исходники:{" "}
              <a
                href="https://github.com/igor1000rr/nit-builder"
                target="_blank"
                rel="noopener"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
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
      <pre className="p-4 text-[11px] font-mono overflow-x-auto leading-[1.65] rounded-lg bg-black/50 border border-white/[0.08] text-[#A1A1AA]">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => onCopy(code, copyKey)}
        className={`absolute top-2 right-2 px-2.5 py-1 text-[10px] font-semibold rounded transition border ${
          copied === copyKey
            ? "bg-emerald-500 border-emerald-400 text-[#0A0A0A]"
            : "bg-white/[0.04] border-white/[0.08] text-[#A1A1AA] hover:text-white hover:border-white/[0.15]"
        }`}
      >
        {copied === copyKey ? "✓" : "Copy"}
      </button>
    </div>
  );
}
