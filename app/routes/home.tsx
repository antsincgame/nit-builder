import { useState, useCallback, useRef, useMemo, useEffect } from "react";
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

export function meta() {
  return [
    { title: "NITGEN — Создавайте сайты бесплатно" },
    {
      name: "description",
      content: "Простое приложение для создания сайтов. Без программирования, без подписок.",
    },
  ];
}

/**
 * Home v4 — приложение для авторизованных пользователей.
 *
 * Радикально упрощёно:
 * - Убраны все ambient эффекты (ConicRays/Orbs/Beams/Particles/HorizontalParticles/GridBg)
 * - Убран TerminalCodeCard, GlitchHeading, Chip, StatusDot
 * - Скрыт tunnel offline banner (tunnel всегда offline без CLI;
 *   обычный юзер не должен видеть этот статус)
 * - Скрыт StatusDot tunnel-индикатор
 * - Скрыта ссылка "↓ CLI" в nav (доступно через AuthBadge dropdown)
 * - Pipeline steps "01·ANALYZE·TEMPLATE·CODE" русский
 * - Все кнопки на русском: New → Новый, Abort → Отмена, Share → Поделиться и т.д.
 * - Новый навбар (квадратик N вместо conic-gradient лого)
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

  const hasEditableZones = useMemo(() => {
    const content = html || streamingHtml;
    return !!content && /\sdata-edit="/.test(content);
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
      <div className="relative min-h-screen text-[color:var(--ink)] overflow-x-hidden">
        <div className="nit-bg-mesh" aria-hidden>
          <div className="nit-bg-mesh-orb nit-bg-mesh-1" />
          <div className="nit-bg-mesh-orb nit-bg-mesh-2" />
          <div className="nit-bg-mesh-orb nit-bg-mesh-3" />
        </div>
        <div className="nit-bg-grid" aria-hidden />
        <ToastContainer />
        <HistoryPanel isOpen={historyOpen} onClose={() => setHistoryOpen(false)} onOpen={openFromHistory} />
        <MyTemplatesPanel
          isOpen={templatesOpen}
          onClose={() => setTemplatesOpen(false)}
          onUse={handleUseTemplate}
        />
        <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

        <header
          className="sticky top-0 z-50 w-full backdrop-blur-md"
          style={{
            background: "rgba(10, 11, 16, 0.7)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 no-underline">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[14px]"
                style={{ background: "var(--ink)", color: "var(--bg)" }}
              >
                N
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-[color:var(--ink)]">
                nitgen
              </span>
            </a>

            <div className="flex items-center gap-2">
              {auth.status === "authenticated" && (
                <>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="hidden sm:inline-flex px-3 py-2 text-[13px] rounded-md transition-colors"
                    style={{ color: "var(--muted)" }}
                    title="Мои сайты"
                  >
                    История
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplatesOpen(true)}
                    className="hidden sm:inline-flex px-3 py-2 text-[13px] rounded-md transition-colors"
                    style={{ color: "var(--muted)" }}
                    title="Мои сохранённые шаблоны"
                  >
                    Мои шаблоны
                  </button>
                </>
              )}
              <AuthBadge auth={auth} onOpenSettings={() => setSettingsOpen(true)} />
            </div>
          </div>
        </header>

        <main className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-16">
          <div className="max-w-[680px] mx-auto text-center mb-10 sm:mb-14">
            <h1
              className="nit-display mb-4 sm:mb-5"
              style={{ fontSize: "clamp(32px, 5vw, 48px)", color: "var(--ink)" }}
            >
              Что построим
              <br />
              <span className="nit-text-gradient-cyan">сегодня?</span>
            </h1>
            <p
              className="max-w-[480px] mx-auto"
              style={{
                fontSize: "clamp(14px, 2vw, 16px)",
                color: "var(--muted)",
                lineHeight: 1.6,
              }}
            >
              Опишите в двух словах что вы делаете — приложение сделает сайт
              за минуту. Или выберите готовый вариант ниже.
            </p>
          </div>

          {auth.status === "loading" && (
            <div
              className="mb-8 p-3 flex items-center gap-3 rounded-lg"
              style={{ border: "1px solid var(--line)", background: "rgba(19, 20, 27, 0.4)" }}
            >
              <div className="w-2 h-2 rounded-full bg-[color:var(--muted)] animate-pulse" />
              <div className="text-[13px]" style={{ color: "var(--muted)" }}>
                Проверяем…
              </div>
            </div>
          )}

          {auth.status === "unauthenticated" && (
            <div
              className="mb-8 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl"
              style={{
                border: "1px solid var(--line-strong)",
                background: "rgba(19, 20, 27, 0.6)",
              }}
            >
              <div className="flex-1 text-[13px] sm:text-[14px]" style={{ color: "var(--ink-dim)" }}>
                Войдите или зарегистрируйтесь — ваши сайты будут сохраняться в истории.
              </div>
              <div className="flex gap-2 shrink-0">
                <a href="/login" className="btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }}>
                  Войти
                </a>
                <a href="/register" className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
                  Регистрация
                </a>
              </div>
            </div>
          )}

          <div className="mb-12 sm:mb-16">
            <SimplePromptInput onSubmit={createSite} loading={loading} />
          </div>

          <div className="mb-5 text-center">
            <h2
              className="nit-display"
              style={{ fontSize: "clamp(22px, 3vw, 28px)", color: "var(--ink)" }}
            >
              Или выберите готовый
            </h2>
          </div>
          <TemplateGrid onSelect={createSite} />
        </main>

        <footer
          className="relative z-10 px-5 sm:px-8 py-8 text-center text-[13px]"
          style={{ borderTop: "1px solid var(--line)", color: "var(--muted-2)" }}
        >
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
      <div className="h-screen text-[color:var(--ink)] flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
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
        <div
          className="flex items-center justify-between px-3 sm:px-5 py-3 shrink-0 gap-3"
          style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 overflow-hidden">
            <a href="/" className="flex items-center gap-2 no-underline shrink-0">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[12px]"
                style={{ background: "var(--ink)", color: "var(--bg)" }}
              >
                N
              </div>
              <span className="hidden sm:inline text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
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
                <span style={{ color: "var(--muted-2)" }}>→</span>
                <StepDot
                  active={currentStep === "template"}
                  done={currentStep === "code" || currentStep === "done"}
                  label={templateName ? "Подбор" : "Подбор"}
                />
                <span style={{ color: "var(--muted-2)" }}>→</span>
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
            {isGenerating ? (
              <button
                type="button"
                onClick={cancelGeneration}
                className="px-3 py-1.5 text-[12px] font-medium rounded-md transition flex items-center gap-1.5"
                style={{
                  border: "1px solid var(--pink)",
                  color: "var(--pink)",
                }}
                title="Отмена (Esc)"
              >
                <span>✕</span>
                <span className="hidden sm:inline">Отмена</span>
              </button>
            ) : (
              <>
                {versions.length > 1 && (
                  <div
                    className="hidden sm:flex items-center rounded-md overflow-hidden"
                    style={{ border: "1px solid var(--line)" }}
                  >
                    <button
                      type="button"
                      onClick={undoVersion}
                      disabled={!canUndo}
                      className="px-2.5 py-1.5 text-[13px] transition"
                      style={{
                        color: canUndo ? "var(--ink)" : "var(--muted-2)",
                        cursor: canUndo ? "pointer" : "not-allowed",
                        opacity: canUndo ? 1 : 0.4,
                        borderRight: "1px solid var(--line)",
                      }}
                      title={
                        canUndo
                          ? `Отменить изменение (${currentVersionIndex}/${versions.length - 1})`
                          : "Нет предыдущих версий"
                      }
                    >
                      ↶
                    </button>
                    <button
                      type="button"
                      onClick={redoVersion}
                      disabled={!canRedo}
                      className="px-2.5 py-1.5 text-[13px] transition"
                      style={{
                        color: canRedo ? "var(--ink)" : "var(--muted-2)",
                        cursor: canRedo ? "pointer" : "not-allowed",
                        opacity: canRedo ? 1 : 0.4,
                      }}
                      title={canRedo ? "Вернуть изменение" : "Нет следующих версий"}
                    >
                      ↷
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-md transition flex items-center gap-1.5"
                  style={{ border: "1px solid var(--line-strong)", color: "var(--muted)" }}
                  title="Создать новый сайт"
                >
                  <span>+</span>
                  <span className="hidden sm:inline">Новый</span>
                </button>
                {html && (
                  <button
                    type="button"
                    onClick={downloadHtml}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition flex items-center gap-1.5"
                    style={{ background: "var(--ink)", color: "var(--bg)" }}
                    title="Скачать сайт"
                  >
                    <span>↓</span>
                    <span>Скачать</span>
                  </button>
                )}
                {html && hasEditableZones && !isBackendArtifact && (
                  <button
                    type="button"
                    onClick={downloadPhp}
                    className="hidden md:inline-flex px-3 py-1.5 text-[12px] font-medium rounded-md transition items-center gap-1.5"
                    style={{
                      border: "1px solid var(--amber)",
                      color: "var(--amber)",
                    }}
                    title="Скачать с встроенным редактором (PHP хостинг)"
                  >
                    С редактором
                  </button>
                )}
                {html && auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="hidden sm:inline-flex px-3 py-1.5 text-[12px] font-medium rounded-md transition items-center gap-1.5"
                    style={{
                      border: "1px solid var(--line-strong)",
                      color: "var(--cyan)",
                    }}
                    title="Поделиться публичной ссылкой"
                  >
                    Поделиться
                  </button>
                )}
                {html && auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setSaveTemplateOpen(true)}
                    className="hidden md:inline-flex px-3 py-1.5 text-[12px] font-medium rounded-md transition items-center gap-1.5"
                    style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
                    title="Сохранить как свой шаблон"
                  >
                    Сохранить
                  </button>
                )}
                {auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="hidden sm:inline-flex px-3 py-1.5 text-[12px] font-medium rounded-md transition items-center gap-1.5"
                    style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
                    title="Мои сохранённые сайты"
                  >
                    История
                  </button>
                )}
              </>
            )}
            <AuthBadge auth={auth} onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        </div>

        {/* Mobile tab-switcher */}
        <div
          className="md:hidden flex shrink-0"
          style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
        >
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className="flex-1 py-2.5 text-[13px] font-medium transition"
            style={{
              color: mobileTab === "chat" ? "var(--ink)" : "var(--muted)",
              borderBottom:
                mobileTab === "chat"
                  ? "2px solid var(--cyan)"
                  : "2px solid transparent",
            }}
          >
            Чат{chatMessages.length > 0 ? ` · ${chatMessages.length}` : ""}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className="flex-1 py-2.5 text-[13px] font-medium transition"
            style={{
              color: mobileTab === "preview" ? "var(--ink)" : "var(--muted)",
              borderBottom:
                mobileTab === "preview"
                  ? "2px solid var(--cyan)"
                  : "2px solid transparent",
            }}
          >
            Просмотр
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[400px_1fr] overflow-hidden">
          <div
            className={`overflow-hidden ${mobileTab === "chat" ? "flex" : "hidden"} md:flex md:flex-col`}
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
            className={`flex-col overflow-hidden relative ${mobileTab === "preview" ? "flex" : "hidden"} md:flex`}
            style={{ background: "var(--bg-2)" }}
          >
            {previewHtml ? (
              <iframe
                title="Предпросмотр сайта"
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="nit-preview w-full h-full border-0 bg-white"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[color:var(--muted)]">
                <div
                  className="w-12 h-12 rounded-full mb-5 animate-spin"
                  style={{
                    border: "3px solid var(--line)",
                    borderTopColor: "var(--cyan)",
                  }}
                />
                <p className="text-[14px]" style={{ color: "var(--ink-dim)" }}>
                  Готовимся…
                </p>
                <p className="text-[12px] mt-2" style={{ color: "var(--muted-2)" }}>
                  Сайт появится здесь во время создания
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

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  const color = active ? "var(--cyan)" : done ? "var(--green)" : "var(--muted-2)";
  return (
    <span className="flex items-center gap-1.5" style={{ color }}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: color,
          boxShadow: active ? `0 0 8px ${color}` : undefined,
          animation: active ? "nit-pulse 1.5s infinite" : undefined,
        }}
      />
      {label}
    </span>
  );
}
