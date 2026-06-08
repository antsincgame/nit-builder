/**
 * useGenerationFlow — encapsulates generation state and selected style preset.
 *
 * Раньше эта логика жила inline в app/routes/home.tsx (~500 LOC, треть
 * файла) и смешивалась с layout/JSX. Вынос даёт:
 *
 *  - home.tsx становится тонким — только JSX и UI-state (open drawer,
 *    keyboard shortcuts).
 *  - hook покрывается unit-тестами без рендеринга всей home-страницы.
 *  - WebSocket и HTTP-fallback ветки получают единое API: createSite /
 *    polishSite / cancelGeneration. Caller не знает какой path использован.
 *
 * Поведение НЕ изменено vs inline-версии — это refactor, не feature change.
 *
 * Stale-closure fix: раньше `if (!html)` в WS handler читал stale `html`
 * через прямой capture (eslint exhaustive-deps disable comment). Теперь
 * через htmlRef.current — current value читается на момент вызова, без
 * пересоздания callback на каждый setHtml().
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerToBrowser } from "@nit/shared";
import type { ControlSocketStatus, TunnelStatus } from "~/lib/hooks/useControlSocket";
import { runHttpPipeline } from "~/lib/services/pipelineHttpFallback";
import { saveToHistory, type HistoryEntry } from "~/lib/stores/historyStore";
import { saveRemoteSite, updateRemoteSite } from "~/lib/stores/remoteHistoryStore";
import { toast } from "~/lib/stores/toastStore";
import { inferArtifactModeFromPrompt, type ArtifactMode } from "~/lib/utils/artifactMode";
import { uuid } from "~/lib/utils/uuid";
import type { StylePresetId } from "~/lib/llm/style-presets";

// ─── Public types ──────────────────────────────────────────────────

export type ViewMode = "welcome" | "generating" | "editing";
export type PipelineStep = "plan" | "template" | "code" | "done";
export type ChatMessage = { role: "user" | "assistant"; text: string };
export type CreateSiteOptions = { stylePresetId?: StylePresetId };

/** Минимальный shape того что возвращает useControlSocket — чтобы hook не зависел от полного типа. */
export type ControlSocketLike = {
  status: ControlSocketStatus;
  tunnelStatus: TunnelStatus;
  sendGenerate: (params: {
    requestId: string;
    mode: "create" | "polish";
    prompt: string;
    artifactMode?: ArtifactMode;
    stylePresetId?: StylePresetId;
    previousHtml?: string;
  }) => boolean;
  sendAbort: (requestId: string) => void;
};

export type GenerationAuth =
  | { status: "loading" | "unauthenticated" }
  | { status: "authenticated"; userId: string; email: string };

export type UseGenerationFlowOptions = {
  /** Stable, генерируется один раз в caller через useState(uuid). */
  projectId: string;
  /** Auth state — определяет, идти через WS-tunnel или HTTP fallback. */
  auth: GenerationAuth;
  /**
   * Геттер контрол-сокета. Передаётся как функция (не объект) чтобы
   * разорвать круг: useControlSocket ↔ useGenerationFlow.
   * useControlSocket нужен handleWsEvent (получает от этого hook'а),
   * этот hook нужен socket (создаётся useControlSocket'ом). Передавая
   * socket через геттер, caller вызывает useGenerationFlow ДО
   * useControlSocket, а реальный socket читается lazy через ref-внутри
   * useControlSocket'а в caller'е.
   */
  getSocket: () => ControlSocketLike;
};

export type UseGenerationFlow = {
  // ─── State ──────────────────────────────────────────
  mode: ViewMode;
  html: string;
  streamingHtml: string;
  streamingChars: number;
  loading: boolean;
  currentStep: PipelineStep;
  templateName: string;
  lastPrompt: string;
  lastTemplateId: string;
  chatMessages: ChatMessage[];
  /**
   * История версий после polish-каскадов. Каждый успешный create или polish
   * push'ит новую запись. Индекс currentVersionIndex указывает на показанную
   * версию. canUndo/canRedo — производные удобства для UI.
   */
  versions: VersionEntry[];
  currentVersionIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * ID последнего сохранённого сайта в Appwrite. Null если юзер guest
   * или save ещё в полёте. Используется для шеринга (ShareDialog).
   */
  currentSiteId: string | null;

  // ─── Actions ────────────────────────────────────────
  createSite: (prompt: string, createOptions?: CreateSiteOptions) => Promise<void>;
  polishSite: (request: string) => Promise<void>;
  cancelGeneration: () => void;
  /** Используется HistoryPanel при открытии существующего сайта. */
  loadFromHistory: (entry: HistoryEntry) => void;
  reset: () => void;
  /** Откат на предыдущую версию (если есть). */
  undoVersion: () => void;
  /** Возврат к следующей версии (если есть). */
  redoVersion: () => void;

  // ─── Direct setters (для специфичных UI-нужд) ──────
  setMode: (m: ViewMode) => void;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  // ─── WebSocket bridge ───────────────────────────────
  /** Передавать в useControlSocket({ onEvent: handleWsEvent }). */
  handleWsEvent: (event: ServerToBrowser) => void;
};

/**
 * Запись в истории версий внутри сессии (НЕ путать с HistoryEntry —
 * полные сохранённые сайты в Appwrite/localStorage).
 *
 * Хранится только в памяти; теряется при reload — это намеренно, чтобы
 * undo/redo был лёгким и не плодил persisted state.
 */
export type VersionEntry = {
  html: string;
  /** Какой prompt привёл к этой версии. Для UI-подсказок при undo. */
  prompt: string;
  /** "create" — стартовая версия после первой генерации, "polish" — каскад. */
  kind: "create" | "polish";
  /** Unix ms, для отображения «N мин назад». */
  timestamp: number;
};

// ─── Implementation ────────────────────────────────────────────────

export function useGenerationFlow(
  options: UseGenerationFlowOptions,
): UseGenerationFlow {
  const { projectId, auth, getSocket } = options;

  // Pipeline state
  const [mode, setMode] = useState<ViewMode>("welcome");
  const [html, setHtml] = useState("");
  const [streamingHtml, setStreamingHtml] = useState("");
  const [streamingChars, setStreamingChars] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep>("plan");
  const [templateName, setTemplateName] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [lastTemplateId, setLastTemplateId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // ID последнего сохранённого в Appwrite сайта — нужен для шеринга
  // (ShareDialog требует siteId). Null если юзер guest или save ещё в полёте.
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);

  // ─── Polish undo/redo ────────────────────────────────────────────
  // Версии копятся при каждом успешном create / polish. currentVersionIndex
  // указывает на актуальную (отображаемую) версию; undo/redo двигают индекс
  // не трогая массив (то есть undo не теряет «будущее» — пока не сделан
  // новый polish, после которого redo-«хвост» сбрасывается).
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);

  // Helper — атомарно добавить новую версию. Если мы стояли НЕ на конце
  // (после undo пользователь сделал новый polish), отбрасываем «redo-хвост»
  // и кладём новую версию поверх — стандартное undo/redo поведение.
  const pushVersion = useCallback(
    (entry: VersionEntry) => {
      setVersions((prev) => {
        const head = prev.slice(0, currentVersionIndex + 1);
        return [...head, entry];
      });
      setCurrentVersionIndex((idx) => idx + 1);
    },
    [currentVersionIndex],
  );

  // Refs (state мы не кладём сюда — useState даёт реактивность; refs только
  // для значений которые не должны вызывать пересоздание callback'ов)
  const sessionIdRef = useRef<string | undefined>(undefined);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingHtmlRef = useRef<string>("");
  const rafIdRef = useRef<number | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);

  // Stale-closure fix: handleWsEvent читает текущий html (для решения
  // stay-on-split vs bounce-to-welcome при error) — но не должен
  // пересоздаваться на каждом setHtml() (иначе useControlSocket
  // переподпишется и потеряет in-flight генерацию).
  const htmlRef = useRef(html);
  useEffect(() => {
    htmlRef.current = html;
  }, [html]);

  // auth ref — для long-lived callback'ов без recreate.
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  // lastPromptRef — handleWsEvent читает lastPrompt при сохранении в
  // history. Объявлен здесь (выше handleWsEvent) для читаемости — раньше
  // был ниже и работал через TDZ + временной gap (callback вызывается
  // только после mount). Так понятнее.
  const lastPromptRef = useRef(lastPrompt);
  useEffect(() => {
    lastPromptRef.current = lastPrompt;
  }, [lastPrompt]);

  // chatMessagesRef — handleWsEvent на generate_done определяет это
  // create или polish (по наличию assistant-сообщения от прошлых
  // итераций), не вызывая пересоздание callback при каждом setChatMessages.
  const chatMessagesRef = useRef(chatMessages);
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  // currentSiteIdRef — на момент успешного polish'а нужен актуальный
  // id сайта для PATCH /api/sites/:id. Не хотим пересоздавать callback
  // через deps — поэтому ref.
  const currentSiteIdRef = useRef(currentSiteId);
  useEffect(() => {
    currentSiteIdRef.current = currentSiteId;
  }, [currentSiteId]);

  // getSocket-ref: caller передаёт стабильную функцию-геттер, мы сохраняем
  // её и читаем актуальный socket на каждый action. Это разрывает
  // зависимостный круг useControlSocket ↔ useGenerationFlow.
  const getSocketRef = useRef(getSocket);
  useEffect(() => {
    getSocketRef.current = getSocket;
  }, [getSocket]);

  // RAF-throttled iframe updates чтобы не блокировать main thread на
  // больших HTML стримах.
  const scheduleIframeUpdate = useCallback((htmlStr: string, chars: number) => {
    pendingHtmlRef.current = htmlStr;
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      setStreamingHtml(pendingHtmlRef.current);
      setStreamingChars(chars);
      rafIdRef.current = null;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      abortCtrlRef.current?.abort();
    };
  }, []);

  // ─── WebSocket event handler ──────────────────────────────────────
  // Нет deps кроме scheduleIframeUpdate — все читаемые значения через
  // refs выше. Это устраняет необходимость в eslint-disable который был
  // в inline-версии в home.tsx.
  const handleWsEvent = useCallback(
    (event: ServerToBrowser) => {
      switch (event.type) {
        case "generate_step": {
          if (event.step === "plan") setCurrentStep("plan");
          else if (event.step === "template") {
            setCurrentStep("template");
            if (event.templateName) setTemplateName(event.templateName);
            if (event.templateId) setLastTemplateId(event.templateId);
          } else if (event.step === "code") setCurrentStep("code");
          else if (event.step === "done") setCurrentStep("done");
          break;
        }
        case "generate_text": {
          const next = (pendingHtmlRef.current || "") + event.text;
          scheduleIframeUpdate(next, next.length);
          break;
        }
        case "generate_done": {
          setHtml(event.html);
          setStreamingHtml(event.html);
          setMode("editing");
          setLoading(false);
          setCurrentStep("done");
          activeRequestIdRef.current = null;

          // Polish undo/redo: новая версия в стек. Различаем create vs
          // polish по наличию assistant-сообщения в chat (proxy для того
          // что это уже не первая генерация в сессии).
          const isPolish = chatMessagesRef.current.some(
            (m) => m.role === "assistant",
          );
          pushVersion({
            html: event.html,
            prompt: lastPromptRef.current,
            kind: isPolish ? "polish" : "create",
            timestamp: Date.now(),
          });

          // Собираем актуальные сообщения чата (включая только что
          // добавленный assistant-ответ) — на момент здесь setChatMessages
          // ещё не application-state'нулся, поэтому собираем "ручками"
          // из ref + новый.
          const assistantText = `Готово ✨ Шаблон: ${event.templateName}. Сгенерировано за ${(event.durationMs / 1000).toFixed(1)}s. Опиши правки — применю.`;
          const updatedMessages: ChatMessage[] = [
            ...chatMessagesRef.current,
            { role: "assistant", text: assistantText },
          ];

          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", text: assistantText },
          ]);

          // Save to history (local + remote если authed)
          try {
            const entry: HistoryEntry = {
              id: uuid(),
              createdAt: Date.now(),
              prompt: lastPromptRef.current,
              templateId: event.templateId,
              templateName: event.templateName,
              html: event.html,
            };
            saveToHistory(entry);
            const serializedChat = JSON.stringify(updatedMessages);
            // На polish — PATCH существующего сайта (не плодим копии).
            // На create — POST нового сайта.
            if (isPolish && currentSiteIdRef.current) {
              void updateRemoteSite(currentSiteIdRef.current, {
                html: event.html,
                chatMessages: serializedChat,
              });
            } else {
              void saveRemoteSite({
                prompt: lastPromptRef.current,
                html: event.html,
                templateId: event.templateId,
                templateName: event.templateName,
                chatMessages: serializedChat,
              }).then((id) => {
                if (id) setCurrentSiteId(id);
              });
            }
          } catch {
            // ignore storage failures
          }
          toast.success(`Сайт готов за ${(event.durationMs / 1000).toFixed(1)}s`);
          break;
        }
        case "generate_error": {
          setLoading(false);
          activeRequestIdRef.current = null;

          // ABORTED — это эхо нашего же abort: юзер нажал «отмена», и
          // cancelGeneration уже показал warning-тост и сбросил вид. Живой
          // браузер получает ABORTED только так (disconnect/revoke-пути
          // абортят уже после закрытия сокета). Не плодим второй (к тому же
          // англоязычный) error-тост и красный чат-бабл.
          if (event.code === "ABORTED") break;

          let msg = event.error;
          if (event.code === "NO_TUNNEL") {
            msg = "Твой туннель не подключён. Запусти NIT Tunnel клиент.";
          } else if (event.code === "TUNNEL_DISCONNECTED") {
            msg = "Туннель отключился во время генерации. Попробуй снова.";
          } else if (event.code === "RATE_LIMITED") {
            msg = "Слишком много параллельных генераций. Дождись завершения.";
          }
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", text: `❌ ${msg}` },
          ]);
          // Stay on split view if we already have a site, otherwise bounce
          // back to welcome. Через ref — не пересоздаём callback на каждый
          // setHtml.
          if (!htmlRef.current) {
            setMode("welcome");
          }
          toast.error(msg);
          break;
        }
      }
    },
    [scheduleIframeUpdate, pushVersion],
  );

  // ─── Actions ──────────────────────────────────────────────────────

  const createSite = useCallback(
    async (prompt: string, createOptions: CreateSiteOptions = {}) => {
      const currentSocket = getSocketRef.current();
      const currentAuth = authRef.current;

      if (currentAuth.status === "authenticated" && currentSocket.tunnelStatus !== "online") {
        const msg = "NIT Tunnel не подключён. Скачайте клиент и запустите его на компьютере с LM Studio.";
        setChatMessages([{ role: "user", text: prompt }, { role: "assistant", text: `❌ ${msg}` }]);
        setMode("welcome");
        setLoading(false);
        toast.error(msg);
        return;
      }

      // Авторизованный юзер генерит ТОЛЬКО через туннель (HTTP-fallback ниже —
      // для гостей). Помимо живого туннеля требуем authed control-сокет: без
      // этого при моргнувшей сети (сокет реконнектится, а tunnelStatus ещё
      // «online» из устаревшего стейта) запрос проваливался в HTTP мимо
      // туннеля — туннель его не видел, а сайт висел в «Изучаем запрос».
      if (currentAuth.status === "authenticated" && currentSocket.status !== "authed") {
        const msg = "Соединение с сервером восстанавливается — повтори через пару секунд.";
        setChatMessages([{ role: "user", text: prompt }, { role: "assistant", text: `❌ ${msg}` }]);
        setMode("welcome");
        setLoading(false);
        toast.error(msg);
        return;
      }

      setMode("generating");
      setLoading(true);
      setStreamingHtml("");
      setTemplateName("");
      setStreamingChars(0);
      setCurrentStep("plan");
      setLastPrompt(prompt);
      pendingHtmlRef.current = "";
      const artifactMode = inferArtifactModeFromPrompt(prompt);

      // Seed chat с первым сообщением юзера для split-view.
      setChatMessages([{ role: "user", text: prompt }]);

      // WebSocket tunnel path (preferred если authed + tunnel online).
      if (
        currentAuth.status === "authenticated" &&
        currentSocket.status === "authed" &&
        currentSocket.tunnelStatus === "online"
      ) {
        const requestId = `req-${uuid()}`;
        activeRequestIdRef.current = requestId;
        const sent = currentSocket.sendGenerate({
          requestId,
          mode: "create",
          prompt,
          artifactMode,
          ...(createOptions.stylePresetId ? { stylePresetId: createOptions.stylePresetId } : {}),
        });
        if (!sent) {
          toast.error("Туннель не готов. Попробуй ещё раз.");
          setLoading(false);
          setMode("welcome");
          return;
        }
        return; // Response handled via handleWsEvent
      }

      // HTTP fallback
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      try {
        const result = await runHttpPipeline({
          mode: "create",
          projectId,
          prompt,
          sessionId: sessionIdRef.current,
          artifactMode,
          stylePresetId: createOptions.stylePresetId,
          signal: ctrl.signal,
          onEvent: (event) => {
            switch (event.type) {
              case "session_init":
                sessionIdRef.current = event.sessionId;
                break;
              case "plan_ready":
                setCurrentStep("template");
                break;
              case "template_selected":
                setTemplateName(event.templateName);
                setCurrentStep("template");
                break;
              case "step_start":
                if (event.roleName === "Кодер" || event.roleName === "Backend builder") setCurrentStep("code");
                break;
              case "text_delta":
                scheduleIframeUpdate(event.accumulated, event.accumulated.length);
                break;
              case "step_complete":
              case "error":
                break;
            }
          },
        });

        setCurrentStep("done");
        setHtml(result.finalHtml);
        setStreamingHtml("");
        setLastTemplateId(result.templateId);

        // Polish undo/redo: новая версия в стек (HTTP fallback path).
        pushVersion({
          html: result.finalHtml,
          prompt,
          kind: "create",
          timestamp: Date.now(),
        });

        if (result.finalHtml && result.templateId) {
          saveToHistory({
            prompt,
            html: result.finalHtml,
            templateId: result.templateId,
            templateName: result.templateName,
          });
          if (currentAuth.status === "authenticated") {
            void saveRemoteSite({
              prompt,
              html: result.finalHtml,
              templateId: result.templateId,
              templateName: result.templateName,
            }).then((id) => {
              if (id) setCurrentSiteId(id);
            });
          }
          toast.success("Сайт создан и сохранён в истории");
        }

        setMode("editing");
      } catch (err) {
        const msg = (err as Error).message;
        if ((err as Error).name !== "AbortError") {
          toast.error(`Ошибка: ${msg}`);
        }
        setMode("welcome");
      } finally {
        setLoading(false);
        abortCtrlRef.current = null;
      }
    },
    [projectId, scheduleIframeUpdate, pushVersion],
  );

  const polishSite = useCallback(
    async (request: string) => {
      setChatMessages((prev) => [...prev, { role: "user", text: request }]);
      setLoading(true);

      const currentSocket = getSocketRef.current();
      const currentAuth = authRef.current;
      if (currentAuth.status === "authenticated" && currentSocket.tunnelStatus !== "online") {
        const msg = "NIT Tunnel не подключён. Запустите клиент, чтобы применить правки через ваш GPU.";
        setChatMessages((prev) => [...prev, { role: "assistant", text: `❌ ${msg}` }]);
        setLoading(false);
        toast.error(msg);
        return;
      }

      if (currentAuth.status === "authenticated" && currentSocket.status !== "authed") {
        const msg = "Соединение с сервером восстанавливается — повтори через пару секунд.";
        setChatMessages((prev) => [...prev, { role: "assistant", text: `❌ ${msg}` }]);
        setLoading(false);
        toast.error(msg);
        return;
      }

      if (
        currentAuth.status === "authenticated" &&
        currentSocket.status === "authed" &&
        currentSocket.tunnelStatus === "online"
      ) {
        const requestId = `req-${uuid()}`;
        activeRequestIdRef.current = requestId;
        pendingHtmlRef.current = "";
        setStreamingHtml("");
        const sent = currentSocket.sendGenerate({
          requestId,
          mode: "polish",
          prompt: request,
          previousHtml: htmlRef.current,
        });
        if (!sent) {
          toast.error("Туннель не готов. Попробуй ещё раз.");
          setLoading(false);
          return;
        }
        return;
      }

      // HTTP fallback
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      try {
        const result = await runHttpPipeline({
          mode: "polish",
          projectId,
          prompt: request,
          sessionId: sessionIdRef.current,
          signal: ctrl.signal,
          onEvent: (event) => {
            switch (event.type) {
              case "session_init":
                sessionIdRef.current = event.sessionId;
                break;
              case "text_delta":
                scheduleIframeUpdate(event.accumulated, event.accumulated.length);
                break;
              default:
                break;
            }
          },
        });

        setHtml(result.finalHtml);
        setStreamingHtml("");
        pushVersion({
          html: result.finalHtml,
          prompt: request,
          kind: "polish",
          timestamp: Date.now(),
        });
        const updatedMessages: ChatMessage[] = [
          ...chatMessagesRef.current,
          { role: "assistant", text: "Готово ✨" },
        ];
        setChatMessages((prev) => [...prev, { role: "assistant", text: "Готово ✨" }]);
        // Persist на remote если есть siteId. На HTTP-path polish мог
        // быть и для guest'а (без siteId) — тогда просто пропускаем.
        if (currentSiteIdRef.current) {
          void updateRemoteSite(currentSiteIdRef.current, {
            html: result.finalHtml,
            chatMessages: JSON.stringify(updatedMessages),
          });
        }
        toast.success("Правки применены");
      } catch (err) {
        const msg = (err as Error).message;
        if ((err as Error).name !== "AbortError") {
          setChatMessages((prev) => [...prev, { role: "assistant", text: `Ошибка: ${msg}` }]);
          toast.error(`Ошибка правки: ${msg}`);
        }
        setStreamingHtml("");
      } finally {
        setLoading(false);
        abortCtrlRef.current = null;
      }
    },
    [projectId, scheduleIframeUpdate, pushVersion],
  );

  const cancelGeneration = useCallback(() => {
    abortCtrlRef.current?.abort();
    if (activeRequestIdRef.current) {
      getSocketRef.current().sendAbort(activeRequestIdRef.current);
      activeRequestIdRef.current = null;
    }
    setLoading(false);
    toast.warning("Генерация отменена");
    setMode("welcome");
  }, []);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setHtml(entry.html);
    setStreamingHtml("");
    setLastPrompt(entry.prompt);
    setLastTemplateId(entry.templateId);
    setTemplateName(entry.templateName);

    // v2.1 Continue from history: если есть сохранённый chat — восстанавливаем
    // его, чтобы юзер мог продолжить полировку с того места где остановился.
    // Парсинг безопасный: если JSON.parse упадёт или формат не совпадёт —
    // откатимся на пустой массив (как было до v2.1).
    let restoredChat: ChatMessage[] = [];
    if (entry.chatMessages) {
      try {
        const parsed: unknown = JSON.parse(entry.chatMessages);
        if (Array.isArray(parsed)) {
          restoredChat = parsed.filter(
            (m): m is ChatMessage =>
              typeof m === "object" &&
              m !== null &&
              "role" in m &&
              "text" in m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.text === "string",
          );
        }
      } catch {
        // невалидный JSON — silently fallback на пустой chat
      }
    }
    setChatMessages(restoredChat);

    setMode("editing");
    // entry.id — id из Appwrite (для remote-источника) или uuid (для local).
    // ShareDialog проверяет на этот id; если это local-id (uuid),
    // server вернёт 404 на /api/share, что корректно (нельзя расшарить
    // сайт которого нет в облаке).
    setCurrentSiteId(entry.id);
    // Стек версий сбрасываем — открытие сайта из истории это новая
    // «сессия» с точки зрения undo/redo. Версии прошлых полировок не
    // переносятся (сохраняется только final HTML + chat для контекста).
    setVersions([
      { html: entry.html, prompt: entry.prompt, kind: "create", timestamp: Date.now() },
    ]);
    setCurrentVersionIndex(0);
  }, []);

  const reset = useCallback(() => {
    setMode("welcome");
    setHtml("");
    setStreamingHtml("");
    setChatMessages([]);
    setTemplateName("");
    setStreamingChars(0);
    setCurrentStep("plan");
    setVersions([]);
    setCurrentVersionIndex(-1);
    setCurrentSiteId(null);
    sessionIdRef.current = undefined;
  }, []);

  // Undo/redo — двигаем индекс, восстанавливаем html. Не дёргаем сеть,
  // не пишем в history (это та же сессия, не новый сайт).
  const undoVersion = useCallback(() => {
    setCurrentVersionIndex((idx) => {
      if (idx <= 0) return idx;
      const target = idx - 1;
      const entry = versions[target];
      if (entry) {
        setHtml(entry.html);
        setStreamingHtml("");
      }
      return target;
    });
  }, [versions]);

  const redoVersion = useCallback(() => {
    setCurrentVersionIndex((idx) => {
      if (idx >= versions.length - 1) return idx;
      const target = idx + 1;
      const entry = versions[target];
      if (entry) {
        setHtml(entry.html);
        setStreamingHtml("");
      }
      return target;
    });
  }, [versions]);

  return {
    mode,
    html,
    streamingHtml,
    streamingChars,
    loading,
    currentStep,
    templateName,
    lastPrompt,
    lastTemplateId,
    chatMessages,
    versions,
    currentVersionIndex,
    canUndo: currentVersionIndex > 0,
    canRedo: currentVersionIndex < versions.length - 1,
    currentSiteId,
    createSite,
    polishSite,
    cancelGeneration,
    loadFromHistory,
    reset,
    undoVersion,
    redoVersion,
    setMode,
    setChatMessages,
    handleWsEvent,
  };
}
