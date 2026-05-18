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
import { GridBg, Orbs, Chip, StatusDot, GlitchHeading, Particles, HorizontalParticles, ConicRays, Beams } from "~/components/nit";
import { TerminalCodeCard } from "~/components/nit/TerminalCodeCard";

export function meta() {
  return [
    { title: "NITGEN — Создай сайт на своём компьютере за минуту" },
    {
      name: "description",
      content: "AI-конструктор сайтов работающий локально через LM Studio. Бесплатно, приватно, без подписки.",
    },
  ];
}

export default function Home() {
  // Stable projectId на сессию (одна вкладка = один проект)
  const [projectId] = useState(() => `simple-${uuid()}`);

  // Auth state из global AuthContext (Phase B.5)
  const auth = useAuth();

  // UI state — toggles drawer'ов. Намеренно отдельно от generation pipeline
  // state: open/close drawer не должно пересоздавать generate-callback'и.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Mobile tab (видим только на < md). На широких экранах оба панели
  // показываются в split-layout одновременно, на узких — переключаемся
  // между chat и preview через tab-bar.
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("preview");

  // ─── Generation pipeline + WebSocket flow ─────────────────────────
  //
  // useGenerationFlow инкапсулирует ~250 LOC pipeline-логики: state
  // (mode/html/streamingHtml/loading/...), createSite/polishSite/cancel,
  // WebSocket event handling, HTTP fallback. Раньше всё это было inline
  // в этом компоненте — см. git history pre-P3.
  //
  // socket передаётся через геттер (а не объект) чтобы разорвать
  // циклическую зависимость useControlSocket ↔ useGenerationFlow:
  // useControlSocket нужен handleWsEvent (отдаёт hook), hook нужен
  // socket (создаёт useControlSocket). Lazy getter решает elegantly.
  const socketRef = useRef<ReturnType<typeof useControlSocket> | null>(null);
  const flow = useGenerationFlow({
    projectId,
    auth: auth.status === "authenticated" ? auth : { status: auth.status },
    getSocket: () =>
      socketRef.current ?? {
        // До первого render useControlSocket — placeholder. На практике
        // generate-action возможен только после нескольких рендеров
        // (юзер нажимает submit), к этому моменту socket уже реальный.
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

  // Алиасы — короткие имена для JSX ниже.
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

  // UX-хелпер: при старте генерации авто-переключаемся на preview-таб
  // (на mobile). Логика консервативная — срабатывает только на переходе
  // в "generating", не на каждый чанк стрима.
  useEffect(() => {
    if (mode === "generating") setMobileTab("preview");
  }, [mode]);

  // Использование пользовательского шаблона из MyTemplatesPanel: переключаемся
  // в editing-mode с HTML и prompt из шаблона. Передаём id="" в loadFromHistory
  // — это намеренно: currentSiteIdRef.current=="" falsy, при первом polish'е
  // создастся новый Appwrite-site (POST), а не PATCH несуществующего id.
  // Логика: "шаблон — это стартовая точка; полировка превращает его в новый сайт
  // в моей истории".
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

  // Pending template из sessionStorage (v2.2 Community gallery):
  // /templates сохраняет туда выбранный шаблон перед редиректом на /. Здесь
  // подбираем — один раз при mount — и грузим через тот же handleUseTemplate.
  // Ключ затирается сразу после consume, чтобы reload не повторил загрузку.
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
      // ignore — если remove упал, при следующем mount грузанём снова, не критично
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
      // невалидный JSON — silently skip
    }
  }, [handleUseTemplate]);


  // Есть ли в текущем HTML data-edit разметка от Coder-а — значит Planner
  // отметил needs_admin=true и можно собрать PHP-бандл с админкой.
  // useMemo: regex дешёвый, но html меняется на каждый стрим-чанк во время
  // генерации — пусть будет мемо чтобы не пересчитывать на каждый render.
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
      toast.success("PHP-проект скачан");
      return;
    }

    const filename = `nit-${lastTemplateId || "site"}-${Date.now()}.html`;

    // Скачиваем через /api/bundle — серверный compile-step Tailwind:
    // ~300 KB CDN-скрипт превращается в ~8-15 KB inline CSS. Lighthouse
    // mobile LCP +30-40 баллов. При ошибке (endpoint недоступен, compile
    // упал, нет постcss/tailwind в проде) — graceful fallback на raw blob.
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
      toast.success("HTML скачан");
    } catch (err) {
      console.error("[downloadHtml] bundle failed, fallback to raw:", err);
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.error("Compile упал, скачан raw HTML");
    }
  }, [html, streamingHtml, lastTemplateId]);

  const downloadPhp = useCallback(async () => {
    const content = html || streamingHtml;
    if (!content) return;
    const filename = `nit-${lastTemplateId || "site"}-php-${Date.now()}.zip`;

    // POST на /api/bundle/php — сервер сам извлечёт zones из data-edit-*
    // атрибутов, скомпилит Tailwind, выпечет PHP, упакует в ZIP с админкой.
    // Никакого клиентского fallback здесь нет: PHP-бандл нельзя собрать без
    // сервера, при ошибке просто показываем toast.
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
          // body не JSON — оставляем status code
        }
        throw new Error(detail);
      }
      const blob = await resp.blob();
      const matched = resp.headers.get("X-Bundle-Matched");
      // setup-файл переименован сервером в setup-<8hex>.php (см. bundle.server.ts —
      // защита от first-come-first-served race на свежем деплое). Fallback на
      // "setup.php" — на случай если фронт получит ответ от старого сервера
      // во время раскатки.
      const setupFile = resp.headers.get("X-Bundle-Setup-File") || "setup.php";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `PHP-бандл скачан${matched ? ` · ${matched} зон в админке` : ""}. Распакуй в public_html и открой /${setupFile} (одноразовый, удали после первого входа).`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error("[downloadPhp] failed:", err);
      toast.error(`PHP-бандл: ${msg}`);
    }
  }, [html, streamingHtml, lastTemplateId]);

  // Keyboard shortcuts
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
    {
      key: "h",
      meta: true,
      handler: () => setHistoryOpen(true),
      description: "⌘H — История",
    },
    {
      key: "h",
      ctrl: true,
      handler: () => setHistoryOpen(true),
      description: "Ctrl+H — История",
    },
    {
      key: "d",
      meta: true,
      handler: () => mode === "editing" && downloadHtml(),
      description: "⌘D — Скачать",
    },
    {
      key: "d",
      ctrl: true,
      handler: () => mode === "editing" && downloadHtml(),
      description: "Ctrl+D — Скачать",
    },
    {
      key: ",",
      meta: true,
      handler: () => setSettingsOpen(true),
      description: "⌘, — Настройки",
    },
    {
      key: ",",
      ctrl: true,
      handler: () => setSettingsOpen(true),
      description: "Ctrl+, — Настройки",
    },
    {
      key: "z",
      meta: true,
      handler: () => mode === "editing" && canUndo && undoVersion(),
      description: "⌘Z — Откатить",
    },
    {
      key: "z",
      ctrl: true,
      handler: () => mode === "editing" && canUndo && undoVersion(),
      description: "Ctrl+Z — Откатить",
    },
    {
      key: "z",
      meta: true,
      shift: true,
      handler: () => mode === "editing" && canRedo && redoVersion(),
      description: "⌘⇧Z — Вперёд",
    },
    {
      key: "z",
      ctrl: true,
      shift: true,
      handler: () => mode === "editing" && canRedo && redoVersion(),
      description: "Ctrl+⇧Z — Вперёд",
    },
  ]);

  // ─── Welcome screen ─────────────────────────────────
  if (mode === "welcome") {
    return (
      <div className="relative min-h-screen text-[color:var(--ink)] nit-grain overflow-x-hidden">
        <ConicRays />
        <GridBg />
        <Orbs />
        <Beams />
        <Particles count={30} />
        <HorizontalParticles count={15} />
        <ToastContainer />
        <HistoryPanel isOpen={historyOpen} onClose={() => setHistoryOpen(false)} onOpen={openFromHistory} />
        <MyTemplatesPanel
          isOpen={templatesOpen}
          onClose={() => setTemplatesOpen(false)}
          onUse={handleUseTemplate}
        />
        <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* NAV */}
        <nav
          className="relative z-10 px-8 py-5 flex justify-between items-center max-w-[1400px] mx-auto"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <a href="/" className="flex items-center gap-3 no-underline">
            <span
              className="block w-7 h-7 relative"
              style={{
                background:
                  "conic-gradient(from 0deg, var(--accent), var(--magenta), var(--acid), var(--accent))",
                animation: "nit-spin 8s linear infinite",
              }}
            >
              <span className="absolute inset-[3px]" style={{ background: "var(--bg)" }} />
            </span>
            <span className="nit-display text-lg text-[color:var(--ink)]">NITGEN</span>
          </a>

          <div className="flex gap-2 items-center">
            {auth.status === "authenticated" && (
              <>
                <div className="hidden md:block">
                  <StatusDot
                    status={socket.tunnelStatus === "online" ? "online" : "offline"}
                    label={
                      socket.tunnelStatus === "online"
                        ? `TUNNEL · ${socket.activeTunnels}`
                        : "TUNNEL OFF"
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="hidden sm:flex px-4 py-2 text-[11px] tracking-[0.15em] uppercase text-[color:var(--muted)] hover:text-[color:var(--ink)] transition items-center gap-2"
                  style={{ border: "1px solid var(--line)" }}
                >
                  <span>⌘H</span>
                  <span>History</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemplatesOpen(true)}
                  className="hidden sm:flex px-4 py-2 text-[11px] tracking-[0.15em] uppercase text-[color:var(--muted)] hover:text-[color:var(--ink)] transition items-center gap-2"
                  style={{ border: "1px solid var(--line)" }}
                  title="Мои сохранённые шаблоны"
                >
                  <span>★</span>
                  <span>Templates</span>
                </button>
              </>
            )}
            <a
              href="/download"
              className="hidden md:inline-flex px-4 py-2 text-[11px] tracking-[0.15em] uppercase no-underline transition items-center gap-2 text-[color:var(--muted)] hover:text-[color:var(--accent-glow)]"
              style={{ border: "1px solid var(--line)" }}
            >
              ↓ CLI
            </a>
            <AuthBadge auth={auth} onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        </nav>

        <main className="relative z-10 max-w-[1400px] mx-auto px-8 pt-12 md:pt-20 pb-20">
          {/* HERO — 2-col grid (text left, terminal card right) */}
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center mb-16 lg:mb-24">
            <div>
              <div className="mb-6">
                <Chip color="acid">⏵ AI editor · powered by your GPU</Chip>
              </div>
              <GlitchHeading
                lines={["Опиши.", "Сгенерь.", ["ВЛАДЕЙ.", "glitch"]]}
                className="!text-[clamp(48px,7.5vw,104px)]"
              />
              <p className="text-[15px] text-[color:var(--muted)] max-w-[520px] leading-[1.7] mt-6">
                Один промпт → готовый HTML-сайт. Стрим из{" "}
                <span className="nit-mark">твоего GPU</span> через peer-to-peer
                tunnel. Никакого облака, никаких лимитов.
              </p>
            </div>
            <div className="hidden lg:block">
              <TerminalCodeCard />
            </div>
          </div>

          {/* Tunnel offline banner */}
          {auth.status === "authenticated" && socket.tunnelStatus === "offline" && (
            <div
              className="mb-8 p-5 flex items-start gap-4"
              style={{
                border: "1px solid var(--magenta)",
                background: "rgba(255,46,147,0.05)",
              }}
            >
              <span
                className="text-[10px] tracking-[0.2em] uppercase shrink-0 px-2 py-1 mt-0.5"
                style={{ color: "var(--magenta)", border: "1px solid var(--magenta)" }}
              >
                ⚠ TUNNEL OFFLINE
              </span>
              <div className="flex-1">
                <p className="text-[13px] text-[color:var(--ink)] mb-1">
                  CLI не подключён к серверу.
                </p>
                <p className="text-[12px] text-[color:var(--muted)]">
                  Скачай tunnel клиент и запусти с твоим токеном — генерация
                  пойдёт через твой GPU.
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <a
                  href="/download"
                  className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] uppercase no-underline text-black transition"
                  style={{ background: "var(--accent)" }}
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] uppercase transition"
                  style={{ border: "1px solid var(--line-strong)", color: "var(--ink)" }}
                >
                  Settings
                </button>
              </div>
            </div>
          )}

          {auth.status === "loading" && (
            <div
              className="mb-8 p-4 flex items-center gap-3"
              style={{ border: "1px solid var(--line)", background: "var(--bg-glass)" }}
            >
              <div className="w-2 h-2 rounded-full bg-[color:var(--muted)] animate-pulse" />
              <div className="text-[11px] tracking-[0.15em] uppercase text-[color:var(--muted)]">
                Authenticating...
              </div>
            </div>
          )}

          {auth.status === "unauthenticated" && (
            <div
              className="mb-8 p-5 flex items-center gap-4"
              style={{
                border: "1px solid var(--line-strong)",
                background: "rgba(0,212,255,0.04)",
              }}
            >
              <Chip color="accent">⏵ ANONYMOUS</Chip>
              <div className="flex-1 text-[12px] text-[color:var(--muted)]">
                Зарегистрируйся чтобы получить tunnel token и подключить
                свой GPU.
              </div>
              <div className="flex gap-2 shrink-0">
                <a
                  href="/login"
                  className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] uppercase no-underline transition text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                >
                  Login
                </a>
                <a
                  href="/register"
                  className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] uppercase text-black no-underline transition"
                  style={{ background: "var(--accent)" }}
                >
                  Register →
                </a>
              </div>
            </div>
          )}

          <div className="mb-16">
            <SimplePromptInput onSubmit={createSite} loading={loading} />
          </div>

          <div className="text-[10px] tracking-[0.2em] uppercase text-[color:var(--accent-glow)] mb-6 flex items-center gap-3">
            <span className="w-10 h-px bg-[color:var(--accent-glow)]" />
            Templates · 22 ready
          </div>
          <TemplateGrid onSelect={createSite} />
        </main>

        <footer
          className="relative z-10 py-10 text-center text-[10px] tracking-[0.15em] uppercase text-[color:var(--muted-2)]"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <div className="max-w-6xl mx-auto px-8 flex flex-wrap justify-center items-center gap-6">
            <span>NITGEN · MIT · OPEN SOURCE</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">⌘H — HISTORY</span>
            <span className="hidden md:inline">⌘↵ — GENERATE</span>
            <span className="hidden md:inline">⌘, — SETTINGS</span>
          </div>
        </footer>
      </div>
    );
  }

  // ─── Split layout: chat (left) + preview (right) ──────────────
  // Used for BOTH "generating" and "editing" modes. During generation
  // we stream into the right iframe, show the user's prompt as the first
  // chat bubble, and render a "typing" indicator. After generation the
  // same layout stays — user can polish via chat on the left.
  if (mode === "generating" || mode === "editing") {
    const previewHtml = streamingHtml || html;
    const isGenerating = mode === "generating";
    const isBackendArtifact = !!extractPhpSqliteArtifact(previewHtml);

    return (
      <div className="h-screen text-[color:var(--ink)] flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
        <ToastContainer />
        <HistoryPanel
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onOpen={openFromHistory}
        />
        <MyTemplatesPanel
          isOpen={templatesOpen}
          onClose={() => setTemplatesOpen(false)}
          onUse={handleUseTemplate}
        />
        <SettingsDrawer
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
        <ShareDialog
          isOpen={shareOpen}
          siteId={currentSiteId}
          onClose={() => setShareOpen(false)}
        />
        <SaveAsTemplateDialog
          isOpen={saveTemplateOpen}
          html={html}
          prompt={lastPrompt}
          onClose={() => setSaveTemplateOpen(false)}
        />

        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <a href="/" className="flex items-center gap-2 no-underline shrink-0">
              <span
                className="block w-5 h-5 relative"
                style={{
                  background:
                    "conic-gradient(from 0deg, var(--accent), var(--magenta), var(--acid), var(--accent))",
                  animation: "nit-spin 8s linear infinite",
                }}
              >
                <span className="absolute inset-[2px]" style={{ background: "var(--bg)" }} />
              </span>
              <span className="nit-display text-[13px]">NITGEN</span>
            </a>

            <span
              className="hidden md:inline text-[10px] tracking-[0.15em] uppercase"
              style={{ color: "var(--muted-2)" }}
            >
              // session/{projectId.slice(-8)}
            </span>

            {/* Pipeline status during generation — ASCII-style progress */}
            {isGenerating && (
              <div className="hidden md:flex items-center gap-3 text-[10px] tracking-[0.15em] uppercase">
                <PipeStep
                  active={currentStep === "plan"}
                  done={currentStep === "template" || currentStep === "code" || currentStep === "done"}
                  label="01·ANALYZE"
                />
                <span style={{ color: "var(--muted-2)" }}>→</span>
                <PipeStep
                  active={currentStep === "template"}
                  done={currentStep === "code" || currentStep === "done"}
                  label={templateName ? `02·${templateName.toUpperCase()}` : "02·TEMPLATE"}
                />
                <span style={{ color: "var(--muted-2)" }}>→</span>
                <PipeStep
                  active={currentStep === "code"}
                  done={currentStep === "done"}
                  label={streamingChars > 0 ? `03·CODE [${streamingChars}]` : "03·CODE"}
                />
              </div>
            )}

            {/* Tunnel badge when not generating */}
            {!isGenerating &&
              auth.status === "authenticated" &&
              socket.tunnelStatus !== "unknown" && (
                <div className="hidden md:block">
                  <StatusDot
                    status={socket.tunnelStatus === "online" ? "online" : "offline"}
                    label={
                      socket.tunnelStatus === "online"
                        ? `TUNNEL · ${socket.activeTunnels}`
                        : "TUNNEL OFF"
                    }
                  />
                </div>
              )}
          </div>

          <div className="flex items-center gap-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={cancelGeneration}
                className="px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition flex items-center gap-2"
                style={{
                  border: "1px solid var(--magenta)",
                  color: "var(--magenta)",
                }}
                title="Отмена (Esc)"
              >
                <span>✕</span>
                <span className="hidden sm:inline">Abort</span>
              </button>
            ) : (
              <>
                {versions.length > 1 && (
                  <div
                    className="hidden sm:flex items-center"
                    style={{ border: "1px solid var(--line)" }}
                  >
                    <button
                      type="button"
                      onClick={undoVersion}
                      disabled={!canUndo}
                      className="px-2.5 py-1.5 text-[11px] transition"
                      style={{
                        color: canUndo ? "var(--ink)" : "var(--muted-2)",
                        cursor: canUndo ? "pointer" : "not-allowed",
                        opacity: canUndo ? 1 : 0.4,
                        borderRight: "1px solid var(--line)",
                      }}
                      title={
                        canUndo
                          ? `Откатить (${currentVersionIndex}/${versions.length - 1})`
                          : "Нет предыдущих версий"
                      }
                    >
                      ↶
                    </button>
                    <button
                      type="button"
                      onClick={redoVersion}
                      disabled={!canRedo}
                      className="px-2.5 py-1.5 text-[11px] transition"
                      style={{
                        color: canRedo ? "var(--ink)" : "var(--muted-2)",
                        cursor: canRedo ? "pointer" : "not-allowed",
                        opacity: canRedo ? 1 : 0.4,
                      }}
                      title={canRedo ? "Вперёд" : "Нет следующих версий"}
                    >
                      ↷
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition flex items-center gap-2 text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                  style={{ border: "1px solid var(--line)" }}
                  title="Создать новый сайт"
                >
                  <span>+</span>
                  <span className="hidden sm:inline">New</span>
                </button>
                {html && (
                  <button
                    type="button"
                    onClick={downloadHtml}
                    className="px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition flex items-center gap-2"
                    style={{
                      border: "1px solid var(--accent)",
                      color: "var(--accent-glow)",
                    }}
                    title={isBackendArtifact ? "Скачать PHP-проект (⌘D)" : "Скачать HTML (⌘D)"}
                  >
                    <span>↓</span>
                    <span className="hidden sm:inline">{isBackendArtifact ? "Export ZIP" : "HTML"}</span>
                  </button>
                )}
                {html && hasEditableZones && !isBackendArtifact && (
                  <button
                    type="button"
                    onClick={downloadPhp}
                    className="px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition flex items-center gap-2"
                    style={{
                      border: "1px solid var(--acid)",
                      color: "var(--acid)",
                    }}
                    title="Скачать ZIP с PHP-админкой"
                  >
                    <span>↓</span>
                    <span className="hidden sm:inline">PHP</span>
                  </button>
                )}
                {html && auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition flex items-center gap-2"
                    style={{
                      border: "1px solid var(--magenta)",
                      color: "var(--magenta)",
                    }}
                    title="Поделиться публичной ссылкой"
                  >
                    <span>↗</span>
                    <span className="hidden sm:inline">Share</span>
                  </button>
                )}
                {html && auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setSaveTemplateOpen(true)}
                    className="px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition flex items-center gap-2 text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                    style={{ border: "1px solid var(--line)" }}
                    title="Сохранить как переиспользуемый шаблон"
                  >
                    <span>★</span>
                    <span className="hidden sm:inline">Save</span>
                  </button>
                )}
                {auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="hidden sm:flex px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition items-center gap-2 text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                    style={{ border: "1px solid var(--line)" }}
                    title="Мои сайты (⌘H)"
                  >
                    <span>⌘H</span>
                    <span className="hidden md:inline">History</span>
                  </button>
                )}
                {auth.status === "authenticated" && (
                  <button
                    type="button"
                    onClick={() => setTemplatesOpen(true)}
                    className="hidden sm:flex px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition items-center gap-2 text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                    style={{ border: "1px solid var(--line)" }}
                    title="Мои сохранённые шаблоны"
                  >
                    <span>★</span>
                    <span className="hidden md:inline">Templates</span>
                  </button>
                )}
              </>
            )}
            <AuthBadge
              auth={auth}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>

        {/* Mobile tab-switcher (только < md). Split-layout ниже на широких. */}
        <div
          className="md:hidden flex shrink-0"
          style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
        >
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className="flex-1 py-2.5 text-[10px] tracking-[0.2em] uppercase transition"
            style={{
              color: mobileTab === "chat" ? "var(--accent-glow)" : "var(--muted)",
              borderBottom:
                mobileTab === "chat"
                  ? "2px solid var(--accent-glow)"
                  : "2px solid transparent",
            }}
          >
            💬 Chat{chatMessages.length > 0 ? ` · ${chatMessages.length}` : ""}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className="flex-1 py-2.5 text-[10px] tracking-[0.2em] uppercase transition"
            style={{
              color: mobileTab === "preview" ? "var(--accent-glow)" : "var(--muted)",
              borderBottom:
                mobileTab === "preview"
                  ? "2px solid var(--accent-glow)"
                  : "2px solid transparent",
            }}
          >
            👁 Preview
          </button>
        </div>

        {/* Chat (left) + Preview (right) — split на md+, tab-switch ниже */}
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
                    ? "// analyzing prompt..."
                    : currentStep === "template"
                      ? "// selecting template..."
                      : currentStep === "code"
                        ? `// streaming code [${streamingChars} bytes]`
                        : "// working..."
                  : "// applying patch..."
              }
            />
          </div>

          <div
            className={`flex-col overflow-hidden relative ${mobileTab === "preview" ? "flex" : "hidden"} md:flex`}
            style={{ background: "var(--bg-2)" }}
          >
            {previewHtml ? (
              <iframe
                title="preview"
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="nit-preview w-full h-full border-0 bg-white"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[color:var(--muted)]">
                <div
                  className="w-16 h-16 rounded-full mb-6 animate-spin"
                  style={{
                    border: "3px solid var(--line)",
                    borderTopColor: "var(--accent-glow)",
                  }}
                />
                <p className="text-[11px] tracking-[0.2em] uppercase">// initializing tunnel...</p>
                <p className="text-[10px] mt-2 tracking-[0.15em] uppercase" style={{ color: "var(--muted-2)" }}>
                  Preview appears as code streams in
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback (should never reach here — welcome/generating/editing are all
  // handled above)
  return null;
}

/* ─── Local sub-components ──────────────────────────────────── */

function PipeStep({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  const color = active ? "var(--accent-glow)" : done ? "var(--acid)" : "var(--muted-2)";
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
