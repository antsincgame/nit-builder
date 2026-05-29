import { useEffect, useState } from "react";
import type { MetaFunction } from "react-router";
import { Monitor, Apple, Terminal, Download as DownloadIcon, ArrowRight } from "lucide-react";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";
import type { TunnelDownloadPlatform } from "~/lib/utils/tunnelDownloads";
import { tunnelDownloadPath } from "~/lib/utils/tunnelDownloads";

export const meta: MetaFunction = () => [
  { title: "Скачать nitgen" },
  {
    name: "description",
    content:
      "nitgen — небольшая программа, которая связывает ваш локальный LM Studio с конструктором сайтов в браузере. Windows, macOS, Linux: установил, вошёл через браузер — и генерируешь на своём GPU.",
  },
];

const RELEASE_BASE = "https://github.com/antsincgame/nit-builder/releases";

/**
 * Download v7 — пользовательский язык, без консолей и без ручного токена.
 *
 * Качается nitgen (небольшой Tauri GUI) — связывает локальный LM Studio с
 * конструктором сайтов в браузере. Сам конструктор ставить не нужно.
 * Двойной клик по установщику → «Войти через nitgen» → подтверждаешь в
 * браузере → готово. Никаких chmod/xattr/--token/--server в инструкции.
 *
 * Filenames собираются workflow tunnel-desktop-release.yml через Tauri 2
 * (имена артефактов остаются NIT.Tunnel_<v>_* — это просто имена файлов):
 *   - NIT.Tunnel_<v>_x64-setup.exe   (NSIS installer, Windows)
 *   - NIT.Tunnel_<v>_aarch64.dmg     (macOS Apple Silicon)
 *   - NIT.Tunnel_<v>_x64.dmg         (macOS Intel)
 *   - nit-tunnel_<v>_amd64.AppImage  (Linux universal)
 *   - nit-tunnel_<v>_amd64.deb       (Linux Debian/Ubuntu)
 *
 * Ссылки указывают на /releases/latest/download/<filename> — GitHub
 * редиректит на актуальную версию автоматически.
 */

type Platform = {
  id: TunnelDownloadPlatform;
  name: string;
  icon: React.ReactNode;
  filename: string;
  url: string;
  description: string;
};

const PLATFORMS: Platform[] = [
  {
    id: "windows",
    name: "Windows",
    icon: <Monitor size={22} />,
    filename: "NIT.Tunnel_0.1.0_x64-setup.exe",
    url: tunnelDownloadPath("windows"),
    description: "Windows 10/11",
  },
  {
    id: "macos-arm",
    name: "macOS (Apple Silicon)",
    icon: <Apple size={22} />,
    filename: "NIT.Tunnel_0.1.0_aarch64.dmg",
    url: tunnelDownloadPath("macos-arm"),
    description: "M1, M2, M3, M4",
  },
  {
    id: "macos-intel",
    name: "macOS (Intel)",
    icon: <Apple size={22} />,
    filename: "NIT.Tunnel_0.1.0_x64.dmg",
    url: tunnelDownloadPath("macos-intel"),
    description: "Mac на Intel",
  },
  {
    id: "linux",
    name: "Linux",
    icon: <Terminal size={22} />,
    filename: "nit-tunnel_0.1.0_amd64.AppImage",
    url: tunnelDownloadPath("linux"),
    description: "AppImage · универсальный",
  },
];

export default function Download() {
  const [detectedOS, setDetectedOS] = useState<string | null>(null);

  // Авто-определяем платформу из User-Agent чтобы предложить релевантный
  // установщик первым. ARM Mac vs Intel неотличимы через UA — предполагаем
  // arm64 для современных Mac'ов (2020+).
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
            <span className="text-[11px] font-semibold text-emerald-300">nitgen</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-white mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.06)]">
            Скачайте nitgen
            <br />
            <span className="bg-gradient-to-r from-white via-white/90 to-emerald-200/80 bg-clip-text text-transparent">
              и генерируйте на своём GPU
            </span>
          </h1>
          <p className="max-w-[520px] mx-auto text-[15px] sm:text-base text-[#A1A1AA] leading-relaxed">
            nitgen — небольшая программа, которая связывает ваш локальный LM Studio с
            конструктором сайтов в браузере. Сам конструктор работает в браузере, ставить его
            не нужно. Установите, нажмите «Войти через nitgen» и подтвердите устройство в
            браузере — и создавайте сайты на своём GPU. Никаких настроек и консолей.
          </p>
        </div>

        {/* Primary CTA — auto-detected OS */}
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
                  {primary.description}
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 group-hover:bg-emerald-400 text-[#0A0A0A] font-semibold text-sm transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)] shrink-0">
              <DownloadIcon size={14} />
              <span className="hidden sm:inline">Скачать</span>
            </div>
          </div>
        </a>

        {/* Other platforms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
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

        {/* Quickstart — 3 простых шага без консолей */}
        <div className="rounded-xl border border-white/[0.06] bg-[#141414] p-6 sm:p-7 mb-6">
          <div className="text-[11px] tracking-[0.15em] uppercase mb-4 font-mono text-emerald-400/80">
            Как это работает
          </div>
          <ol className="space-y-5">
            <Step number="1" title="Скачайте установщик">
              Нажмите кнопку выше — для вашей системы автоматически предложен правильный файл.
            </Step>
            <Step number="2" title="Установите и откройте nitgen">
              <span>
                Двойной клик по скачанному файлу. На <b className="text-white">Windows</b> запустится мастер установки, на{" "}
                <b className="text-white">macOS</b> перетащите иконку в Applications, на <b className="text-white">Linux</b>{" "}
                просто запустите .AppImage.
              </span>
            </Step>
            <Step number="3" title="Войдите — один клик в браузере">
              <span>
                В приложении нажмите <b className="text-white">«Войти через nitgen»</b>. Откроется браузер: войдите
                (если ещё не вошли) и подтвердите это устройство. Токен вводить вручную не нужно.
              </span>
            </Step>
          </ol>

          <div className="mt-6 pt-5 border-t border-white/[0.06] text-[12px] text-[#71717A] leading-relaxed">
            Когда туннель подключится — в{" "}
            <a href="/app" className="text-emerald-400 hover:text-emerald-300 transition-colors">конструкторе nitgen</a>{" "}
            загорится зелёный индикатор «Туннель онлайн», и генерация пойдёт через ваш компьютер.
          </div>
        </div>

        {/* Безопасность — короткое объяснение про SmartScreen / Gatekeeper */}
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-5 mb-6 text-[12px] text-[#A1A1AA] leading-relaxed">
          <div className="text-amber-300 font-medium mb-1.5">
            Если Windows или macOS предупредят про «непроверенный издатель»
          </div>
          <p className="text-[#71717A]">
            Это нормально для новой программы — сертификат подписи стоит дорого, мы его пока не покупали.
            На <b className="text-white">Windows</b> нажмите «Подробнее» → «Выполнить в любом случае».
            На <b className="text-white">macOS</b> — правый клик по иконке → «Открыть» → «Открыть всё равно».
            Исходный код полностью открыт, проверить можно в{" "}
            <a href="https://github.com/antsincgame/nit-builder" target="_blank" rel="noopener" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              репозитории
            </a>
            .
          </p>
        </div>

        <div className="text-center">
          <a
            href={`${RELEASE_BASE}/latest`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 text-[12px] text-[#71717A] hover:text-emerald-300 transition-colors no-underline"
          >
            Все версии и список изменений
            <ArrowRight size={11} />
          </a>
        </div>
      </main>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-500/[0.12] border border-emerald-500/25 flex items-center justify-center text-emerald-300 text-[12px] font-semibold">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <div className="text-[14px] font-medium text-white mb-1">{title}</div>
        <div className="text-[13px] text-[#A1A1AA] leading-relaxed">{children}</div>
      </div>
    </li>
  );
}
