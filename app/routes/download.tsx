import { useEffect, useState } from "react";
import type { MetaFunction } from "react-router";
import { Check, ChevronDown, Code2, Monitor, Apple, Terminal, ArrowRight, Download as DownloadIcon } from "lucide-react";
import { useAuth } from "~/lib/contexts/AuthContext";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";

export const meta: MetaFunction = () => [
  { title: "Скачать · nitgen" },
  {
    name: "description",
    content: "Кроссплатформенный CLI-клиент для подключения LM Studio к nitgen. Windows, macOS, Linux.",
  },
];

const RELEASE_BASE = "https://github.com/antsincgame/nit-builder/releases";

// Прямые ссылки на бинари последнего стабильного релиза.
// GitHub /releases/latest/download/<file> 302-редиректит на актуальную версию.
// Когда workflow завершит первую сборку, эти ссылки сразу заработают.
type Platform = {
  id: string;
  name: string;
  icon: React.ReactNode;
  filename: string;
  url: string;
  description: string;
  postInstall?: string[];
};

const PLATFORMS: Platform[] = [
  {
    id: "windows",
    name: "Windows",
    icon: <Monitor size={22} />,
    filename: "nit-tunnel-windows-x64.exe",
    url: `${RELEASE_BASE}/latest/download/nit-tunnel-windows-x64.exe`,
    description: "Windows 10/11, x64",
  },
  {
    id: "macos-arm",
    name: "macOS (Apple Silicon)",
    icon: <Apple size={22} />,
    filename: "nit-tunnel-macos-arm64",
    url: `${RELEASE_BASE}/latest/download/nit-tunnel-macos-arm64`,
    description: "M1, M2, M3, M4",
    postInstall: [
      "chmod +x nit-tunnel-macos-arm64",
      "xattr -d com.apple.quarantine nit-tunnel-macos-arm64",
    ],
  },
  {
    id: "macos-intel",
    name: "macOS (Intel)",
    icon: <Apple size={22} />,
    filename: "nit-tunnel-macos-x64",
    url: `${RELEASE_BASE}/latest/download/nit-tunnel-macos-x64`,
    description: "Mac на Intel",
    postInstall: [
      "chmod +x nit-tunnel-macos-x64",
      "xattr -d com.apple.quarantine nit-tunnel-macos-x64",
    ],
  },
  {
    id: "linux",
    name: "Linux",
    icon: <Terminal size={22} />,
    filename: "nit-tunnel-linux-x64",
    url: `${RELEASE_BASE}/latest/download/nit-tunnel-linux-x64`,
    description: "x64, glibc 2.31+",
    postInstall: ["chmod +x nit-tunnel-linux-x64"],
  },
];

const SERVER_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/tunnel`
    : "wss://nit.vibecoding.by/api/tunnel";

/**
 * Download v5 — замена «токен» на «ключ доступа» в UI-текстах.
 * Ссылки на /register заменены на /login — регистрация теперь автоматическая
 * через magic-link при первом входе.
 */
export default function Download() {
  const auth = useAuth();
  const [detectedOS, setDetectedOS] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Авто-определяем платформу из User-Agent чтобы предложить релевантный бинарь.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent.toLowerCase();
    const platform = window.navigator.platform.toLowerCase();

    if (ua.includes("windows") || platform.includes("win")) {
      setDetectedOS("windows");
    } else if (ua.includes("mac") || platform.includes("mac")) {
      setDetectedOS("macos-arm");
    } else if (ua.includes("linux") || platform.includes("linux")) {
      setDetectedOS("linux");
    }
  }, []);

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

  const primary = PLATFORMS.find((p) => p.id === detectedOS) ?? PLATFORMS[0]!;
  const rest = PLATFORMS.filter((p) => p.id !== primary.id);

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

      <main className="relative z-10 max-w-[720px] mx-auto px-5 sm:px-8 pt-8 sm:pt-14 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08]">
            <DownloadIcon size={12} className="text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-300">CLI tunnel · кроссплатформенный</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-white mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.06)]">
            Запустите nitgen
            <br />
            <span className="bg-gradient-to-r from-white via-white/90 to-emerald-200/80 bg-clip-text text-transparent">
              на своей GPU
            </span>
          </h1>
          <p className="max-w-[520px] mx-auto text-[15px] sm:text-base text-[#A1A1AA] leading-relaxed">
            Один исполняемый файл подключает локальный LM Studio к nitgen. Ничего устанавливать не нужно —
            скачайте бинарь, запустите, готово.
          </p>
        </div>

        <a
          href={primary.url}
          className="block rounded-2xl border border-emerald-500/20 bg-[#0f1a14] p-6 sm:p-7 mb-4 no-underline group hover:border-emerald-500/30 transition-all shadow-[0_0_40px_rgba(16,185,129,0.06)]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-emerald-500/[0.12] border border-emerald-500/25 flex items-center justify-center text-emerald-300">
                {primary.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-white mb-0.5">
                  Скачать для {primary.name}
                </div>
                <div className="text-[12px] text-[#71717A] truncate">
                  {primary.description} · {primary.filename}
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 group-hover:bg-emerald-400 text-[#0A0A0A] font-semibold text-sm transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)] shrink-0">
              <DownloadIcon size={14} />
              <span className="hidden sm:inline">Скачать</span>
            </div>
          </div>
        </a>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {rest.map((p) => (
            <a
              key={p.id}
              href={p.url}
              className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-[#141414] hover:border-white/[0.15] no-underline transition-all"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/70">
                {p.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white truncate">{p.name}</div>
                <div className="text-[11px] text-[#71717A] truncate">{p.description}</div>
              </div>
            </a>
          ))}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-5 sm:p-6 mb-6">
          <div className="text-[11px] tracking-[0.15em] uppercase mb-3 font-mono text-emerald-400/80">
            Быстрый старт
          </div>
          <ol className="space-y-3 text-[13px] text-[#A1A1AA] leading-relaxed">
            <li>
              <span className="text-white font-medium">1.</span> Запустите LM Studio, загрузите модель
              (рекомендуем <code className="text-emerald-300 text-[12px] px-1.5 py-0.5 rounded bg-white/[0.04]">Qwen2.5-Coder-7B-Instruct</code>),
              включите Server на порту 1234.
            </li>
            <li>
              <span className="text-white font-medium">2.</span> Получите ключ доступа:{" "}
              {auth.status === "authenticated" ? (
                <a href="/app" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  Settings → «Ключ доступа» → Создать новый
                </a>
              ) : (
                <a href="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  войдите в аккаунт
                </a>
              )}
              {" "}— ключ показывается один раз.
            </li>
            <li>
              <span className="text-white font-medium">3.</span> Скачайте бинарь под вашу ОС
              (кнопка выше).
            </li>
            {primary.postInstall && primary.postInstall.length > 0 && (
              <li>
                <span className="text-white font-medium">4.</span> Дайте право на выполнение:
                <CodeBlock
                  code={primary.postInstall.join("\n")}
                  copyKey="post-install"
                  copied={copied}
                  onCopy={copy}
                />
              </li>
            )}
            <li>
              <span className="text-white font-medium">
                {primary.postInstall && primary.postInstall.length > 0 ? "5." : "4."}
              </span>{" "}
              Запустите туннель:
              <CodeBlock
                code={
                  primary.id === "windows"
                    ? `.\\${primary.filename} \`\n  --token ВАШ_КЛЮЧ \`\n  --server ${SERVER_URL} \`\n  --lm-studio http://localhost:1234/v1`
                    : `./${primary.filename} \\\n  --token ВАШ_КЛЮЧ \\\n  --server ${SERVER_URL} \\\n  --lm-studio http://localhost:1234/v1`
                }
                copyKey="run"
                copied={copied}
                onCopy={copy}
              />
            </li>
          </ol>

          <div className="mt-5 pt-5 border-t border-white/[0.06] flex items-center gap-3 text-[12px] text-[#71717A]">
            <Check size={13} className="text-emerald-400 shrink-0" />
            <span>
              Когда туннель подключится — в{" "}
              <a href="/app" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                /app
              </a>
              {" "}загорится зелёный индикатор «Туннель онлайн», генерация пойдёт через ваш GPU.
            </span>
          </div>
        </div>

        <div className="text-center mb-4">
          <a
            href={`${RELEASE_BASE}/latest`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 text-[12px] text-[#71717A] hover:text-emerald-300 transition-colors no-underline"
          >
            Все версии и changelog
            <ArrowRight size={11} />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setDevOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/[0.06] hover:border-white/[0.12] text-[#71717A] hover:text-white transition"
        >
          <span className="text-[13px] flex items-center gap-2">
            <Code2 size={14} />
            Запустить из исходников
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${devOpen ? "rotate-180" : ""}`}
          />
        </button>

        {devOpen && (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/30 p-5 space-y-5 text-[13px] text-[#A1A1AA] leading-relaxed">
            <p>
              Нужны: Node.js 20+ или Bun, LM Studio с запущенным сервером,
              GPU с 6+ ГБ VRAM и ключ доступа (получите его в Settings после входа).
            </p>

            <div>
              <div className="text-[11px] tracking-[0.15em] uppercase mb-2 font-mono text-emerald-400/80">
                1. Clone &amp; install
              </div>
              <CodeBlock
                code={`git clone https://github.com/antsincgame/nit-builder.git\ncd nit-builder\nnpm install`}
                copyKey="clone"
                copied={copied}
                onCopy={copy}
              />
            </div>

            <div>
              <div className="text-[11px] tracking-[0.15em] uppercase mb-2 font-mono text-emerald-400/80">
                2. Run tunnel
              </div>
              <CodeBlock
                code={`cd tunnel\nnpm run dev -- \\\n  --token ВАШ_КЛЮЧ \\\n  --server ${SERVER_URL} \\\n  --lm-studio http://localhost:1234/v1`}
                copyKey="run-dev"
                copied={copied}
                onCopy={copy}
              />
            </div>

            <p className="text-[12px] text-[#71717A]">
              Исходники:{" "}
              <a
                href="https://github.com/antsincgame/nit-builder"
                target="_blank"
                rel="noopener"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                github.com/antsincgame/nit-builder
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
    <div className="relative mt-2">
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
