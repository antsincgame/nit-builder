import { redirect, Link } from "react-router";
import type { Route } from "./+types/home";
import { getAuth } from "~/lib/server/requireAuth.server";
import { ensurePublicId } from "~/lib/server/publicId.server";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Plus, Download, Share2, X, Undo2, Redo2, Loader2, PanelLeft, ArrowUpRight } from "lucide-react";
import { SimplePromptInput } from "~/components/simple/SimplePromptInput";
import { PolishChat } from "~/components/simple/PolishChat";
import { GenerationStage } from "~/components/simple/GenerationStage";
import { HistorySidebar } from "~/components/simple/HistorySidebar";
import { ToastContainer } from "~/components/simple/ToastContainer";
import { useKeyboardShortcuts } from "~/lib/hooks/useKeyboardShortcuts";
import { useAuth } from "~/lib/hooks/useAuth";
import { useOS } from "~/hooks/useOS";
import { useControlSocket } from "~/lib/hooks/useControlSocket";
import { useGenerationFlow } from "~/lib/hooks/useGenerationFlow";
import { toast } from "~/lib/stores/toastStore";
import { uuid } from "~/lib/utils/uuid";
import {
  artifactDownloadName,
  buildStoredZipBlob,
  extractPhpSqliteArtifact,
} from "~/lib/utils/artifactExport";
import { SettingsDrawer } from "~/components/simple/SettingsDrawer";
import { AuthBadge } from "~/components/simple/AuthBadge";
import { ShareDialog } from "~/components/simple/ShareDialog";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";
import { tunnelDownloadPath } from "~/lib/utils/tunnelDownloads";

/**
 * /app — точка входа в приложение.
 * Авторизованных уводим на персональный URL /app/u/:publicId (cookie —
 * источник истины, URL — витрина). Гости остаются здесь: гостевой режим
 * с дневным лимитом генераций.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getAuth(request);
  if (!user) return null;
  const pid = await ensurePublicId(user.userId);
  // pid === null только при сетевом сбое Appwrite — оставляем юзера на
  // /app, чтобы кабинет не падал из-за временной недоступности prefs.
  return pid ? redirect(`/app/u/${pid}`) : null;
}

export function meta() {
  return [
    { title: "nitgen — Создавайте сайты бесплатно" },
    {
      name: "description",
      content: "Простое приложение для создания сайтов. Без программирования, без подписок.",
    },
  ];
}

/**
 * Home v6 — свободный чат + сайдбар истории (как Claude/ChatGPT).
 *
 * Что ушло из v5: TemplateGrid («Или выберите готовый»), Мои шаблоны,
 * Save-as-Template, выезжающая справа история. Генерация — только через
 * свободный промпт; RAG-подбор (Planner → база заготовок → Coder)
 * работает под капотом, юзер его не видит.
 *
 * Логика useGenerationFlow / useControlSocket / chat / iframe превью —
 * не тронуты. Горячие клавиши сохранены (Cmd+H → сайдбар).
 */
export default function Home() {
  const [projectId] = useState(() => `simple-${uuid()}`);
  const auth = useAuth();
  const os = useOS();
  // Платформа для прямой ссылки скачивания туннеля под ОС юзера.
  const downloadPlatform =
    os === "macos" ? ("macos-arm" as const)
    : os === "linux" ? ("linux" as const)
    : ("windows" as const);
  const downloadLabel =
    os === "macos" ? "Скачать для macOS"
    : os === "linux" ? "Скачать для Linux"
    : os === "windows" ? "Скачать для Windows"
    : "Скачать nitgen";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("preview");

  const socketRef = useRef<ReturnType<typeof useControlSocket> | null>(null);
  const flow = useGenerationFlow({
    projectId,
    auth: auth.status === "authenticated" ? auth : { status: auth.status },
    getSocket: () =>
      socketRef.current ?? {
        status: "idle",
        tunnelStatus: "unknown",
        sendGenerate: () => false,
        sendAbort: () => undefined,
      },
  });

  const socket = useControlSocket({
    enabled: auth.status === "authenticated",
    onEvent: flow.handleWsEvent,
  });
  socketRef.current = socket;

  const {
    mode,
    html,
    streamingHtml,
    streamingChars,
    loading,
    currentStep,
    templateName,
    lastTemplateId,
    chatMessages,
    createSite,
    polishSite,
    cancelGeneration,
    retryGeneration,
    retryAvailable,
    generationProgress,
    handleWsEvent,
    loadFromHistory: openFromHistory,
    reset,
    undoVersion,
    redoVersion,
    canUndo,
    canRedo,
    versions,
    currentVersionIndex,
    currentSiteId,
    lastPrompt,
  } = flow;
  void lastPrompt;

  useEffect(() => {
    if (mode === "generating") setMobileTab("preview");
  }, [mode]);

  // Устойчивость к обрыву во время генерации. Сеть могла моргнуть — NIT
  // Tunnel и control-сокет переподключаются сами (туннель ретраит ~60с),
  // поэтому даём щедрый grace: если за это время связь вернулась, генерация
  // продолжится и финальное событие придёт. Если нет — не виснем молча и не
  // делаем грубый reset (он раньше и «выкидывал» работу), а прогоняем тот же
  // путь, что серверный обрыв: спасаем накопленный HTML (если успели собрать)
  // и предлагаем «Повторить». При нормальной генерации socket.status ===
  // "authed", эффект не срабатывает.
  useEffect(() => {
    if (mode !== "generating") return;
    if (socket.status === "authed") return;
    const t = setTimeout(() => {
      if (socketRef.current?.status !== "authed") {
        handleWsEvent({
          type: "generate_error",
          requestId: "",
          error: "Соединение потеряно",
          code: "TUNNEL_DISCONNECTED",
        });
      }
    }, 45000);
    return () => clearTimeout(t);
  }, [mode, socket.status, handleWsEvent]);

  // Локальный таймер «сколько идёт генерация» для loading-экрана: тикает раз
  // в секунду от старта loading, токены приходят из generationProgress.
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!loading) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.round((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [loading]);

  const handleOpenEntry = useCallback(
    (entry: Parameters<typeof openFromHistory>[0]) => {
      openFromHistory(entry);
      setSidebarOpen(false);
    },
    [openFromHistory],
  );

  const handleNewSite = useCallback(() => {
    reset();
    setSidebarOpen(false);
  }, [reset]);

  // Есть ли в текущем HTML админ-разметка от Coder-а (зоны ИЛИ коллекции) —
  // значит Planner отметил needs_admin=true и можно собрать PHP-бандл с
  // админкой. Сервер сам извлечёт и зоны, и схему коллекций из html
  // (extract-фоллбэки бандл-роута) — клиенту достаточно показать кнопку.
  const hasEditableZones = useMemo(() => {
    const content = html || streamingHtml;
    return !!content && /\sdata-(edit|collection)="/.test(content);
  }, [html, streamingHtml]);

  const downloadHtml = useCallback(async () => {
    const content = streamingHtml || html;
    if (!content) return;
    const artifact = extractPhpSqliteArtifact(content);
    if (artifact) {
      const blob = buildStoredZipBlob(artifact.files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = artifactDownloadName(artifact);
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Сайт скачан");
      return;
    }

    const filename = `nit-${lastTemplateId || "site"}-${Date.now()}.html`;
    try {
      const resp = await fetch("/api/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: content, filename }),
      });
      if (!resp.ok) throw new Error(`bundle ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Сайт скачан");
    } catch (err) {
      console.error("[downloadHtml] bundle failed, fallback to raw:", err);
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Сайт скачан");
    }
  }, [html, streamingHtml, lastTemplateId]);

  const downloadPhp = useCallback(async () => {
    const content = html || streamingHtml;
    if (!content) return;
    const filename = `nit-${lastTemplateId || "site"}-php-${Date.now()}.zip`;
    try {
      const resp = await fetch("/api/bundle/php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: content, filename }),
      });
      if (!resp.ok) {
        let detail = `${resp.status}`;
        try {
          const j = (await resp.json()) as { message?: string; error?: string };
          detail = j.message ?? j.error ?? detail;
        } catch {
          /* not JSON */
        }
        throw new Error(detail);
      }
      const blob = await resp.blob();
      const setupFile = resp.headers.get("X-Bundle-Setup-File") || "setup.php";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Сайт с редактором скачан. Распакуйте архив, выложите файлы на хостинг и откройте файл /${setupFile} один раз для первого входа.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "неизвестная ошибка";
      console.error("[downloadPhp] failed:", err);
      toast.error(`Не удалось скачать: ${msg}`);
    }
  }, [html, streamingHtml, lastTemplateId]);

  useKeyboardShortcuts([
    {
      key: "Escape",
      handler: () => {
        if (settingsOpen) setSettingsOpen(false);
        else if (sidebarOpen) setSidebarOpen(false);
        else if (mode === "generating") cancelGeneration();
      },
      description: "Отмена / закрыть",
    },
    { key: "h", meta: true, handler: () => setSidebarOpen(true), description: "История" },
    { key: "h", ctrl: true, handler: () => setSidebarOpen(true), description: "История" },
    { key: "d", meta: true, handler: () => mode === "editing" && downloadHtml(), description: "Скачать" },
    { key: "d", ctrl: true, handler: () => mode === "editing" && downloadHtml(), description: "Скачать" },
    { key: ",", meta: true, handler: () => setSettingsOpen(true), description: "Настройки" },
    { key: ",", ctrl: true, handler: () => setSettingsOpen(true), description: "Настройки" },
    { key: "z", meta: true, handler: () => mode === "editing" && canUndo && undoVersion(), description: "Отменить" },
    { key: "z", ctrl: true, handler: () => mode === "editing" && canUndo && undoVersion(), description: "Отменить" },
    { key: "z", meta: true, shift: true, handler: () => mode === "editing" && canRedo && redoVersion(), description: "Вернуть" },
    { key: "z", ctrl: true, shift: true, handler: () => mode === "editing" && canRedo && redoVersion(), description: "Вернуть" },
  ]);

  /* ─── Welcome screen ─── */
  if (mode === "welcome") {
    return (
      <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden flex">
        <NeuralBackground />
        <ToastContainer />
        <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

        <HistorySidebar
          inlineOnDesktop
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenEntry={handleOpenEntry}
          onNewSite={handleNewSite}
          activeSiteId={currentSiteId}
          refreshKey={currentSiteId}
        />

        <div className="relative flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#0A0A0A]/80 border-b border-white/[0.06]">
            <div className="px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-white/[0.04] transition"
                  aria-label="История"
                  title="История (Cmd+H)"
                >
                  <PanelLeft size={17} />
                </button>
                <a href="/" className="lg:hidden flex items-center gap-2.5 no-underline">
                  <Logo size={28} />
                  <span className="text-[14px] font-semibold text-white tracking-tight">nitgen</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                {auth.status === "authenticated" && (
                  <>
                    <TunnelStatusPill status={socket.tunnelStatus} />
                    <a
                      href={tunnelDownloadPath(downloadPlatform)}
                      className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-[13px] rounded-md text-[#71717A] hover:text-white transition-colors"
                      title="Скачать nitgen"
                    >
                      <Download size={13} />
                      nitgen
                    </a>
                  </>
                )}
                <AuthBadge auth={auth} onOpenSettings={() => setSettingsOpen(true)} />
              </div>
            </div>
          </header>

          <main className="relative z-10 flex-1 w-full max-w-[860px] mx-auto px-5 sm:px-8 pt-8 sm:pt-10 pb-10 flex flex-col justify-center">
            <div className="max-w-[680px] mx-auto text-center mb-5 sm:mb-6">
              <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight leading-[1.15] text-white mb-3 drop-shadow-[0_0_30px_rgba(255,255,255,0.06)]">
                Что построим
                <br />
                <span className="bg-gradient-to-r from-white via-white/90 to-emerald-200/80 bg-clip-text text-transparent">
                  сегодня?
                </span>
              </h1>
              <p className="max-w-[440px] mx-auto text-[14px] sm:text-[15px] text-[#A1A1AA] leading-relaxed">
                Опишите своими словами, что вам нужно — приложение соберёт сайт само.
              </p>
            </div>

            {/* Как это работает — три простых шага без техники, для всех. */}
            <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-1.5 sm:gap-0">
              <HowItWorksStep n={1} text="Опишите идею своими словами" />
              <HowArrow />
              <HowItWorksStep n={2} text="ИИ соберёт сайт" />
              <HowArrow />
              <HowItWorksStep n={3} text="Скачайте готовый файл" />
            </div>

            {auth.status === "loading" && (
              <div className="mb-5 p-2.5 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[#141414]">
                <Loader2 size={14} className="text-emerald-400 animate-spin" />
                <div className="text-[13px] text-[#71717A]">Проверяем…</div>
              </div>
            )}

            {auth.status === "unauthenticated" && (
              <div className="mb-5 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-white/[0.08] bg-[#141414]">
                <div className="flex-1 text-[13px] sm:text-[14px] text-[#A1A1AA]">
                  Войдите по email — ваши сайты будут сохраняться в истории.
                </div>
                <div className="shrink-0">
                  <a
                    href="/login"
                    className="px-4 py-2 rounded-lg text-[13px] bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                  >
                    Войти
                  </a>
                </div>
              </div>
            )}

            <div className="mb-5">
              <SimplePromptInput
                onSubmit={createSite}
                loading={loading}
                connectGate={
                  auth.status === "authenticated" && socket.tunnelStatus !== "online"
                    ? { label: "Сначала подключите nitgen", href: "#connect" }
                    : null
                }
              />
            </div>

            {auth.status === "authenticated" && socket.tunnelStatus !== "online" && (
              <div
                id="connect"
                className="mb-5 p-4 sm:p-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] scroll-mt-24"
              >
                <div className="text-[13px] sm:text-[14px] font-semibold text-amber-200 mb-1">
                  Остался один шаг: подключите свой компьютер
                </div>
                <p className="text-[12px] sm:text-[13px] text-[#A1A1AA] leading-relaxed mb-3">
                  Сайты создаёт ваш компьютер, а не чужое облако — поэтому
                  nitgen полностью бесплатный, и ваши данные остаются у вас.
                  Подключение делается один раз; большая часть времени уйдёт
                  на скачивание нейросети (несколько гигабайт).
                </p>
                <ol className="space-y-2.5 mb-3.5">
                  <li className="flex items-start gap-3">
                    <ConnectStepNum n={1} />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                      <span className="text-[12px] sm:text-[13px] text-white/90">
                        Скачайте и установите приложение nitgen
                      </span>
                      <a
                        href={tunnelDownloadPath(downloadPlatform)}
                        className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-amber-300 hover:bg-amber-200 text-[#0A0A0A] font-semibold transition-all"
                      >
                        <Download size={12} />
                        {downloadLabel}
                      </a>
                      <Link
                        to="/download"
                        className="text-[11px] text-amber-200/70 hover:text-amber-100 underline underline-offset-2 transition-colors"
                      >
                        другие версии
                      </Link>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <ConnectStepNum n={2} />
                    <span className="text-[12px] sm:text-[13px] text-white/90">
                      Откройте инструкцию ниже и повторите 3 простых действия —
                      она проведёт за руку, ничего настраивать вслепую не надо
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <ConnectStepNum n={3} />
                    <span className="text-[12px] sm:text-[13px] text-white/90">
                      Когда всё готово, статус в шапке станет зелёным
                      «Подключён» — и можно создавать сайты
                    </span>
                  </li>
                </ol>
                <a
                  href="/guide"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] border border-amber-500/40 text-amber-200 hover:bg-amber-500/[0.1] font-semibold transition-all"
                >
                  Открыть пошаговую инструкцию
                  <ArrowUpRight size={13} />
                </a>
              </div>
            )}
          </main>

          <footer className="relative z-10 px-5 sm:px-8 py-6 text-center text-[13px] border-t border-white/[0.06] text-[#71717A]/60">
            <span>nitgen · © {new Date().getFullYear()}</span>
          </footer>
        </div>
      </div>
    );
  }

  /* ─── Generating / Editing layout ─── */
  if (mode === "generating" || mode === "editing") {
    const previewHtml = streamingHtml || html;
    const isGenerating = mode === "generating";
    const isBackendArtifact = !!extractPhpSqliteArtifact(previewHtml);

    // Живой прогресс для loading-экрана. Токены текут с туннеля через
    // generationProgress (во всех фазах, включая долгую plan-фазу), символы
    // кода — из streamingChars, секунды — локальный таймер. Раньше на анализе
    // висел статичный текст и казалось, что всё зависло; теперь видно, что
    // модель реально печатает.
    const genTokens = generationProgress?.tokens ?? 0;
    const genSec = elapsedSec > 0 ? ` · ${elapsedSec}с` : "";
    const genTokensSuffix =
      genTokens > 0 ? ` · ${genTokens.toLocaleString("ru-RU")} ток.` : "";
    const genCoding = currentStep === "code" || currentStep === "done";
    const genLabel = genCoding
      ? streamingChars > 0
        ? `Пишу код · ${streamingChars.toLocaleString("ru-RU")} симв.${genSec}`
        : `Пишу код${genTokensSuffix}${genSec}`
      : `Думаю над структурой${genTokensSuffix}${genSec}`;

    return (
      <div className="h-screen text-white flex flex-col overflow-hidden bg-[#0A0A0A]">
        <ToastContainer />
        <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ShareDialog isOpen={shareOpen} siteId={currentSiteId} onClose={() => setShareOpen(false)} />

        <HistorySidebar
          inlineOnDesktop={false}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenEntry={handleOpenEntry}
          onNewSite={handleNewSite}
          activeSiteId={currentSiteId}
          refreshKey={currentSiteId}
        />

        {/* Top bar */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 shrink-0 gap-3 border-b border-white/[0.06] bg-[#0A0A0A]">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-white/[0.04] transition shrink-0"
              aria-label="История"
              title="История (Cmd+H)"
            >
              <PanelLeft size={16} />
            </button>
            <a href="/" className="flex items-center gap-2.5 no-underline shrink-0">
              <Logo size={26} />
              <span className="hidden sm:inline text-[13px] font-semibold text-white tracking-tight">
                nitgen
              </span>
            </a>

            {isGenerating && (
              <div className="hidden md:flex items-center gap-2 text-[12px]">
                <StepDot
                  active={currentStep === "plan"}
                  done={currentStep === "template" || currentStep === "code" || currentStep === "done"}
                  label="Анализ"
                />
                <span className="text-[#71717A]/60">→</span>
                <StepDot
                  active={currentStep === "template"}
                  done={currentStep === "code" || currentStep === "done"}
                  label={templateName ? "Подбор" : "Подбор"}
                />
                <span className="text-[#71717A]/60">→</span>
                <StepDot
                  active={currentStep === "code"}
                  done={currentStep === "done"}
                  label={
                    streamingChars > 0
                      ? `Создание · ${streamingChars} симв.`
                      : "Создание"
                  }
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <TunnelStatusPill status={socket.tunnelStatus} compact />
            {isGenerating ? (
              <button
                type="button"
                onClick={cancelGeneration}
                className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-rose-500/40 text-rose-300 hover:bg-rose-500/[0.08] transition flex items-center gap-1.5"
                title="Отмена (Esc)"
              >
                <X size={12} />
                <span className="hidden sm:inline">Отмена</span>
              </button>
            ) : (
              <>
                {versions.length > 1 && (
                  <div className="hidden sm:flex items-center rounded-md overflow-hidden border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={undoVersion}
                      disabled={!canUndo}
                      className="px-2.5 py-1.5 text-white hover:bg-white/[0.04] transition border-r border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title={
                        canUndo
                          ? `Отменить изменение (${currentVersionIndex}/${versions.length - 1})`
                          : "Нет предыдущих версий"
                      }
                    >
                      <Undo2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={redoVersion}
                      disabled={!canRedo}
                      className="px-2.5 py-1.5 text-white hover:bg-white/[0.04] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title={canRedo ? "Вернуть изменение" : "Нет следующих версий"}
                    >
                      <Redo2 size={13} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleNewSite}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-white/[0.08] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] transition flex items-center gap-1.5"
                  title="Создать новый сайт"
                >
                  <Plus size={12} />
                  <span className="hidden sm:inline">Новый</span>
                </button>
                {html && (
                  <button
                    type="button"
                    onClick={downloadHtml}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-md bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] transition shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-1.5"
                    title="Скачать сайт"
                  >
                    <Download size={12} />
                    <span>Скачать</span>
                  </button>
                )}
                {html && hasEditableZones && !isBackendArtifact && (
                  <button
                    type="button"
                    onClick={downloadPhp}
                    className="hidden md:inline-flex px-3 py-1.5 text-[12px] font-medium rounded-md border border-amber-500/40 text-amber-300 hover:bg-amber-500/[0.08] transition items-center gap-1.5"
                    title="Скачать с встроенным редактором (PHP хостинг)"
                  >
                    С редактором
                  </button>
                )}
                {html && auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="hidden sm:inline-flex px-3 py-1.5 text-[12px] font-medium rounded-md border border-white/[0.08] text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/30 transition items-center gap-1.5"
                    title="Поделиться публичной ссылкой"
                  >
                    <Share2 size={12} />
                    Поделиться
                  </button>
                )}
              </>
            )}
            <AuthBadge auth={auth} onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        </div>

        {/* Mobile tab-switcher */}
        <div className="md:hidden flex shrink-0 border-b border-white/[0.06] bg-[#0A0A0A]">
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-2.5 text-[13px] font-medium transition border-b-2 ${
              mobileTab === "chat"
                ? "text-white border-emerald-500"
                : "text-[#71717A] border-transparent"
            }`}
          >
            Чат{chatMessages.length > 0 ? ` · ${chatMessages.length}` : ""}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={`flex-1 py-2.5 text-[13px] font-medium transition border-b-2 ${
              mobileTab === "preview"
                ? "text-white border-emerald-500"
                : "text-[#71717A] border-transparent"
            }`}
          >
            Просмотр
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[400px_1fr] overflow-hidden">
          <div
            className={`overflow-hidden border-r border-white/[0.06] bg-[#0A0A0A] ${mobileTab === "chat" ? "flex" : "hidden"} md:flex md:flex-col`}
          >
            <PolishChat
              onPolish={polishSite}
              messages={chatMessages}
              loading={loading}
              loadingLabel={isGenerating ? genLabel : "Применяем правки…"}
              onRetry={retryGeneration}
              retryAvailable={retryAvailable}
            />
          </div>

          <div
            className={`flex-col overflow-hidden relative bg-[#141414] ${mobileTab === "preview" ? "flex" : "hidden"} md:flex`}
          >
            {previewHtml ? (
              <iframe
                title="Предпросмотр сайта"
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="nit-preview w-full h-full border-0 bg-white"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#71717A]">
                <Loader2 size={32} className="text-emerald-400 animate-spin mb-5" />
                <p className="text-sm text-[#A1A1AA]">{genLabel}</p>
                <p className="text-xs text-[#71717A]/60 mt-2 max-w-[320px] text-center leading-relaxed">
                  ИИ на вашем компьютере уже работает. Большие модели могут
                  думать несколько минут — это нормально, прогресс идёт.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Local sub-components ─── */

/** Шаг полоски «как это работает» на welcome-экране. */
function HowItWorksStep({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg sm:rounded-none">
      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/[0.12] border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="text-[12px] text-[#A1A1AA]">{text}</span>
    </div>
  );
}

/** Стрелка между шагами «как это работает» (горизонтальная на десктопе). */
function HowArrow() {
  return (
    <span className="hidden sm:flex items-center text-[#71717A]/50 px-1" aria-hidden>
      →
    </span>
  );
}

/** Номер шага в степпере подключения. */
function ConnectStepNum({ n }: { n: number }) {
  return (
    <span className="shrink-0 w-5 h-5 rounded-full border border-amber-500/40 bg-amber-500/[0.1] text-amber-200 text-[11px] font-bold flex items-center justify-center mt-[1px]">
      {n}
    </span>
  );
}

/**
 * Индикатор подключения туннеля в шапке. Берёт живой socket.tunnelStatus
 * ("online" | "offline" | "unknown") и показывает зелёную точку «Подключён»
 * либо серую «Не подключён». Обновляется сам, когда десктоп-туннель
 * поднимет/оборвёт WebSocket. compact — узкий вид для тулбара редактора.
 */
function TunnelStatusPill({
  status,
  compact = false,
}: {
  status: "online" | "offline" | "unknown";
  compact?: boolean;
}) {
  const online = status === "online";
  const label = online ? "Подключён" : "Не подключён";
  const title = online
    ? "Туннель подключён — генерация идёт через ваш GPU"
    : "Туннель не подключён. Запустите nitgen и LM Studio.";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border ${
        compact ? "px-2 py-1" : "px-2.5 py-1.5"
      } text-[12px] font-medium ${
        online
          ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
          : "border-white/[0.08] bg-white/[0.02] text-[#71717A]"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          online
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"
            : "bg-[#71717A]/60"
        }`}
      />
      {!compact && <span>{label}</span>}
      {compact && <span className="hidden sm:inline">{label}</span>}
    </span>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`flex items-center gap-1.5 ${
        active ? "text-emerald-300" : done ? "text-emerald-500/70" : "text-[#71717A]/60"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"
            : done
              ? "bg-emerald-500/60"
              : "bg-[#71717A]/40"
        }`}
      />
      {label}
    </span>
  );
}
