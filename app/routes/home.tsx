import { redirect } from "react-router";
import type { Route } from "./+types/home";
import { getAuth } from "~/lib/server/requireAuth.server";
import { ensurePublicId } from "~/lib/server/publicId.server";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Plus, Download, Share2, Save, History, X, Undo2, Redo2, Loader2 } from "lucide-react";
import { SimplePromptInput } from "~/components/simple/SimplePromptInput";
import { TemplateGrid } from "~/components/simple/TemplateGrid";
import { PolishChat } from "~/components/simple/PolishChat";
import { HistoryPanel } from "~/components/simple/HistoryPanel";
import { ToastContainer } from "~/components/simple/ToastContainer";
import { useKeyboardShortcuts } from "~/lib/hooks/useKeyboardShortcuts";
import { useAuth } from "~/lib/hooks/useAuth";
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
import { SaveAsTemplateDialog } from "~/components/simple/SaveAsTemplateDialog";
import { MyTemplatesPanel } from "~/components/simple/MyTemplatesPanel";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";
import type { StylePresetId } from "~/lib/llm/style-presets";
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
 * Home v5 — эстетика лендинга nitgen-gront.
 *
 * Меняется только визуал: #0A0A0A фон, NeuralBackground canvas,
 * emerald-акценты, lucide-react иконки, без mesh-orbs/nit-bg-grid.
 *
 * Логика useGenerationFlow / useControlSocket / chat / iframe превью —
 * не тронуты. Горячие клавиши сохранены.
 */
export default function Home() {
  const [projectId] = useState(() => `simple-${uuid()}`);
  const auth = useAuth();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("preview");
  const [stylePresetId, setStylePresetId] = useState<StylePresetId | "auto">("auto");

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

  useEffect(() => {
    if (mode === "generating") setMobileTab("preview");
  }, [mode]);

  const handleUseTemplate = useCallback(
    (template: { id: string; name: string; html: string; prompt: string | null }) => {
      openFromHistory({
        id: "",
        prompt: template.prompt ?? "",
        html: template.html,
        templateId: `user-template:${template.id}`,
        templateName: template.name,
        createdAt: Date.now(),
      });
      toast.success(`Шаблон «${template.name}» загружен`);
    },
    [openFromHistory],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let pending: string | null;
    try {
      pending = sessionStorage.getItem("nit-pending-template");
    } catch {
      return;
    }
    if (!pending) return;
    try {
      sessionStorage.removeItem("nit-pending-template");
    } catch {
      /* ignore */
    }
    try {
      const parsed = JSON.parse(pending) as {
        id?: unknown;
        name?: unknown;
        html?: unknown;
        prompt?: unknown;
      };
      if (
        typeof parsed.id === "string" &&
        typeof parsed.name === "string" &&
        typeof parsed.html === "string" &&
        (parsed.prompt === null || typeof parsed.prompt === "string")
      ) {
        handleUseTemplate({
          id: parsed.id,
          name: parsed.name,
          html: parsed.html,
          prompt: parsed.prompt,
        });
      }
    } catch {
      /* ignore invalid JSON */
    }
  }, [handleUseTemplate]);

  const selectedStylePreset = stylePresetId === "auto" ? undefined : stylePresetId;
  const createSiteWithSelectedStyle = useCallback(
    (prompt: string) => createSite(prompt, { stylePresetId: selectedStylePreset }),
    [createSite, selectedStylePreset],
  );

  // Есть ли в текущем HTML админ-разметка от Coder-а (зоны ИЛИ коллекции) —
  // значит Planner отметил needs_admin=true и можно собрать PHP-бандл с
  // админкой. Сервер сам извлечёт и зоны, и схему коллекций из html
  // (extract-фоллбеки бандл-роута) — клиенту достаточно показать кнопку.
  // useMemo: regex дешёвый, но html меняется на каждый стрим-чанк во время
  // генерации — пусть будет мемо чтобы не пересчитывать на каждый render.
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
        else if (historyOpen) setHistoryOpen(false);
        else if (mode === "generating") cancelGeneration();
      },
      description: "Отмена / закрыть",
    },
    { key: "h", meta: true, handler: () => setHistoryOpen(true), description: "История" },
    { key: "h", ctrl: true, handler: () => setHistoryOpen(true), description: "История" },
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
      <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
        <NeuralBackground />
        <ToastContainer />
        <HistoryPanel isOpen={historyOpen} onClose={() => setHistoryOpen(false)} onOpen={openFromHistory} />
        <MyTemplatesPanel
          isOpen={templatesOpen}
          onClose={() => setTemplatesOpen(false)}
          onUse={handleUseTemplate}
        />
        <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#0A0A0A]/80 border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 no-underline">
              <Logo size={32} />
              <span className="text-[15px] font-semibold text-white tracking-tight">nitgen</span>
            </a>

            <div className="flex items-center gap-2">
              {auth.status === "authenticated" && (
                <>
                  <TunnelStatusPill status={socket.tunnelStatus} />
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="hidden sm:inline-flex px-3 py-2 text-[13px] rounded-md text-[#71717A] hover:text-white transition-colors"
                    title="Мои сайты"
                  >
                    История
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplatesOpen(true)}
                    className="hidden sm:inline-flex px-3 py-2 text-[13px] rounded-md text-[#71717A] hover:text-white transition-colors"
                    title="Мои сохранённые шаблоны"
                  >
                    Мои шаблоны
                  </button>
                  <a
                    href={tunnelDownloadPath("macos-arm")}
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

        <main className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-16">
          <div className="max-w-[680px] mx-auto text-center mb-10 sm:mb-14">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-white mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.06)]">
              Что построим
              <br />
              <span className="bg-gradient-to-r from-white via-white/90 to-emerald-200/80 bg-clip-text text-transparent">
                сегодня?
              </span>
            </h1>
            <p className="max-w-[480px] mx-auto text-base sm:text-lg text-[#A1A1AA] leading-relaxed">
              Опишите в двух словах что вы делаете — приложение сделает сайт
              за минуту. Или выберите готовый вариант ниже.
            </p>
          </div>

          {auth.status === "loading" && (
            <div className="mb-8 p-3 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[#141414]">
              <Loader2 size={14} className="text-emerald-400 animate-spin" />
              <div className="text-[13px] text-[#71717A]">Проверяем…</div>
            </div>
          )}

          {auth.status === "unauthenticated" && (
            <div className="mb-8 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-white/[0.08] bg-[#141414]">
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

          {auth.status === "authenticated" && socket.tunnelStatus !== "online" && (
            <div className="mb-8 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06]">
              <div className="flex-1">
                <div className="text-[13px] sm:text-[14px] font-semibold text-amber-200 mb-1">
                  nitgen не подключён
                </div>
                <div className="text-[13px] sm:text-[14px] text-[#A1A1AA] leading-relaxed">
                  Чтобы генерировать на своём GPU, скачайте nitgen, запустите LM Studio и войдите через «Войти через nitgen».
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2">
                <a
                  href={tunnelDownloadPath("macos-arm")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[13px] bg-amber-300 hover:bg-amber-200 text-[#0A0A0A] font-semibold transition-all"
                >
                  <Download size={14} />
                  Скачать nitgen
                </a>
                <a
                  href="/guide"
                  className="text-[12px] text-amber-200/80 hover:text-amber-100 transition-colors text-center sm:text-right"
                >
                  Как подключить — пошагово →
                </a>
              </div>
            </div>
          )}

          <div className="mb-12 sm:mb-16">
            <SimplePromptInput
              onSubmit={createSiteWithSelectedStyle}
              loading={loading}
              selectedStylePresetId={stylePresetId}
              onStylePresetChange={setStylePresetId}
            />
          </div>

          <div className="mb-5 text-center">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Или выберите готовый
            </h2>
          </div>
          <TemplateGrid onSelect={createSiteWithSelectedStyle} />
        </main>

        <footer className="relative z-10 px-5 sm:px-8 py-8 text-center text-[13px] border-t border-white/[0.06] text-[#71717A]/60">
          <span>nitgen · © {new Date().getFullYear()}</span>
        </footer>
      </div>
    );
  }

  /* ─── Generating / Editing layout ─── */
  if (mode === "generating" || mode === "editing") {
    const previewHtml = streamingHtml || html;
    const isGenerating = mode === "generating";
    const isBackendArtifact = !!extractPhpSqliteArtifact(previewHtml);

    return (
      <div className="h-screen text-white flex flex-col overflow-hidden bg-[#0A0A0A]">
        <ToastContainer />
        <HistoryPanel isOpen={historyOpen} onClose={() => setHistoryOpen(false)} onOpen={openFromHistory} />
        <MyTemplatesPanel
          isOpen={templatesOpen}
          onClose={() => setTemplatesOpen(false)}
          onUse={handleUseTemplate}
        />
        <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ShareDialog isOpen={shareOpen} siteId={currentSiteId} onClose={() => setShareOpen(false)} />
        <SaveAsTemplateDialog
          isOpen={saveTemplateOpen}
          html={html}
          prompt={lastPrompt}
          onClose={() => setSaveTemplateOpen(false)}
        />

        {/* Top bar */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 shrink-0 gap-3 border-b border-white/[0.06] bg-[#0A0A0A]">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 overflow-hidden">
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
                  onClick={reset}
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
                {html && auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setSaveTemplateOpen(true)}
                    className="hidden md:inline-flex px-3 py-1.5 text-[12px] font-medium rounded-md border border-white/[0.08] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] transition items-center gap-1.5"
                    title="Сохранить как свой шаблон"
                  >
                    <Save size={12} />
                    Сохранить
                  </button>
                )}
                {auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="hidden sm:inline-flex px-3 py-1.5 text-[12px] font-medium rounded-md border border-white/[0.08] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] transition items-center gap-1.5"
                    title="Мои сохранённые сайты"
                  >
                    <History size={12} />
                    История
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
              loadingLabel={
                isGenerating
                  ? currentStep === "plan"
                    ? "Изучаем запрос…"
                    : currentStep === "template"
                      ? "Подбираем вариант…"
                      : currentStep === "code"
                        ? `Создаём сайт · ${streamingChars} симв.`
                        : "Работаем…"
                  : "Применяем правки…"
              }
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
                <p className="text-sm text-[#A1A1AA]">Готовимся…</p>
                <p className="text-xs text-[#71717A]/60 mt-2">Сайт появится здесь во время создания</p>
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
