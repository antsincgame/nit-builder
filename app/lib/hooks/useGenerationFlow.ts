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
import { runHttpPipeline, type HttpPipelineEvent } from "~/lib/services/pipelineHttpFallback";
import { saveToHistory, type HistoryEntry } from "~/lib/stores/historyStore";
import { saveRemoteSite, updateRemoteSite } from "~/lib/stores/remoteHistoryStore";
import { toast } from "~/lib/stores/toastStore";
import { inferArtifactModeFromPrompt, type ArtifactMode } from "~/lib/utils/artifactMode";
import { buildAssistantCompletionMessage } from "~/lib/utils/completionMessage";
import { buildPolishCompletionMessage } from "~/lib/utils/polishCompletion";
import { readAgentPolishEnabled } from "~/lib/utils/agentPolishPreference";
import { extractHtmlForPreview } from "~/lib/services/agentPolish";
import { streamingHtmlReady } from "~/lib/utils/previewFrame";
import { uuid } from "~/lib/utils/uuid";
import type { StylePresetId } from "~/lib/llm/style-presets";

// Троттлинг живого превью. iframe ПОЛНОСТЬЮ переразбирает srcDoc на каждое
// обновление; 60fps репарса растущего HTML — главный источник джанка в конце
// генерации. ~80мс (~12fps) визуально достаточно; финальный полный HTML всё
// равно ставится из generate_done / step_complete.
const STREAM_PREVIEW_MIN_INTERVAL_MS = 80;

// Кольцевой буфер версий: каждый snapshot — полный HTML (50-300КБ); держим
// последние N, иначе длинная сессия polish удерживает десятки копий резидентно.
const MAX_VERSIONS = 20;

function looksLikeSalvageableHtml(raw: string): boolean {
  return raw.length > 800 && /<(section|div|main|body|header|h1)/i.test(raw);
}

// ─── Public types ──────────────────────────────────────────────────

export type ViewMode = "welcome" | "generating" | "editing";
export type PipelineStep = "plan" | "template" | "code" | "done";
export type ChatMessage = { role: "user" | "assistant"; text: string };
export type CreateSiteOptions = {
  stylePresetId?: StylePresetId;
  /**
   * Внутреннее: повтор после ошибки/обрыва — всегда fresh create, минуя
   * polish-guard. Иначе «Повторить» на спасённом партиале ушло бы в polish
   * вместо честной перегенерации с нуля (что и обещает подсказка о спасении).
   */
  forceCreate?: boolean;
};

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
    agentPolish?: boolean;
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

/** Живой прогресс генерации (счётчик токенов + таймер) для loading-экрана. */
export type GenerationProgress = {
  phase: "plan" | "thinking" | "code";
  tokens: number;
  elapsedMs: number;
};

export type UseGenerationFlow = {
  // ─── State ──────────────────────────────────────────
  mode: ViewMode;
  html: string;
  streamingHtml: string;
  streamingChars: number;
  /** Живой прогресс от туннеля (null когда не генерим). */
  generationProgress: GenerationProgress | null;
  /** Доступен ли повтор после ошибки/обрыва. */
  retryAvailable: boolean;
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
  /** Повторить последнюю генерацию после ошибки/обрыва (тот же промпт+стиль). */
  retryGeneration: () => void;
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
  // Живой прогресс генерации (токены/таймер из туннеля) + промпт для повтора
  // после ошибки/обрыва.
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [retryablePrompt, setRetryablePrompt] = useState<string | null>(null);

  // ID последнего сохранённого в Appwrite сайта — нужен для шеринга
  // (ShareDialog требует siteId). Null если юзер guest или save ещё в полёте.
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);

  // ─── Polish undo/redo ────────────────────────────────────────────
  // Версии копятся при каждом успешном create / polish. currentVersionIndex
  // указывает на актуальную (отображаемую) версию; undo/redo двигают индекс
  // не трогая массив (то есть undo не теряет «будущее» — пока не сделан
  // новый polish, после которого redo-«хвост» сбрасывается).
  // versions + index в ОДНОМ state: pushVersion обновляет его одним
  // функциональным апдейтом (батч-безопасно, без устаревания index), а стек
  // капится кольцевым буфером (MAX_VERSIONS).
  const [versionStack, setVersionStack] = useState<{
    entries: VersionEntry[];
    index: number;
  }>({ entries: [], index: -1 });
  const versions = versionStack.entries;
  const currentVersionIndex = versionStack.index;
  // Синхронное зеркало для undo/redo — клики не батчатся, ref всегда актуален.
  const versionStackRef = useRef(versionStack);
  useEffect(() => {
    versionStackRef.current = versionStack;
  }, [versionStack]);

  // Helper — атомарно добавить новую версию. Если мы стояли НЕ на конце
  // (после undo пользователь сделал новый polish), отбрасываем «redo-хвост»
  // и кладём новую версию поверх — стандартное undo/redo поведение.
  const pushVersion = useCallback((entry: VersionEntry) => {
    setVersionStack((prev) => {
      const head = prev.entries.slice(0, prev.index + 1); // отрезаем redo-хвост
      let entries = [...head, entry];
      let index = entries.length - 1;
      if (entries.length > MAX_VERSIONS) {
        const drop = entries.length - MAX_VERSIONS;
        entries = entries.slice(drop);
        index -= drop;
      }
      return { entries, index };
    });
  }, []);

  // Refs (state мы не кладём сюда — useState даёт реактивность; refs только
  // для значений которые не должны вызывать пересоздание callback'ов)
  const sessionIdRef = useRef<string | undefined>(undefined);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingHtmlRef = useRef<string>("");
  // Время последнего «признака жизни» генерации (step/text/progress). Watchdog
  // ниже будит зависший loading, если туннель долго молчит (мёртвый сокет,
  // потерянный запрос) — иначе веб висит бесконечно.
  const lastAliveAtRef = useRef<number>(0);
  // Стиль последней генерации — для повтора с тем же пресетом.
  const lastStyleRef = useRef<StylePresetId | undefined>(undefined);
  const rafIdRef = useRef<number | null>(null);
  // Последнее значение chars + время последнего коммита превью — для троттлинга.
  const pendingCharsRef = useRef<number>(0);
  const lastPreviewCommitMsRef = useRef<number>(0);
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

  // polishSite через ref: createSite (объявлен раньше polishSite) делегирует
  // ему, если в памяти уже есть готовый сайт. Ref разрывает порядок объявления
  // и не тянет polishSite в deps createSite.
  const polishSiteRef = useRef<((request: string) => Promise<void>) | null>(null);

  // RAF-throttled iframe updates чтобы не блокировать main thread на
  // больших HTML стримах.
  const scheduleIframeUpdate = useCallback(
    (htmlStr: string, chars: number, opts?: { keepPending?: boolean; reschedule?: boolean }) => {
      if (!opts?.keepPending) pendingHtmlRef.current = htmlStr;
      pendingCharsRef.current = chars;
      const commitPreview = () => {
        if (Date.now() - lastPreviewCommitMsRef.current < STREAM_PREVIEW_MIN_INTERVAL_MS) {
          if (opts?.reschedule !== false) {
            window.setTimeout(commitPreview, STREAM_PREVIEW_MIN_INTERVAL_MS);
          }
          return;
        }
        lastPreviewCommitMsRef.current = Date.now();
        setStreamingHtml(pendingHtmlRef.current || htmlStr);
        setStreamingChars(pendingCharsRef.current);
      };
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        commitPreview();
      });
    },
    [],
  );

  /** true пока идёт polish (WS или HTTP). */
  const polishInFlightRef = useRef(false);
  /** true пока идёт Agent polish — превью показываем только после <!DOCTYPE html>. */
  const agentPolishActiveRef = useRef(false);

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
      // Любое событие хода генерации = «жива» (для watchdog ниже).
      if (
        event.type === "generate_step" ||
        event.type === "generate_text" ||
        event.type === "generate_progress"
      ) {
        lastAliveAtRef.current = Date.now();
      }
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
          pendingHtmlRef.current = next;
          if (polishInFlightRef.current || agentPolishActiveRef.current) {
            const preview = extractHtmlForPreview(next);
            if (preview && streamingHtmlReady(preview)) {
              scheduleIframeUpdate(preview, preview.length, { keepPending: true });
            }
          } else {
            scheduleIframeUpdate(next, next.length);
          }
          break;
        }
        case "generate_progress": {
          // Живой прогресс из туннеля: счётчик токенов + таймер фазы. Снимает
          // ощущение «зависло», пока крупная модель молчит в plan-фазе.
          setGenerationProgress({
            phase: event.phase,
            tokens: event.tokens,
            elapsedMs: event.elapsedMs,
          });
          break;
        }
        case "generate_done": {
          const previousHtml = htmlRef.current || undefined;
          setHtml(event.html);
          setStreamingHtml(event.html);
          setMode("editing");
          setLoading(false);
          setCurrentStep("done");
          setGenerationProgress(null);
          setRetryablePrompt(null);
          activeRequestIdRef.current = null;
          agentPolishActiveRef.current = false;

          const isPolish =
            event.generationMode === "polish" || polishInFlightRef.current;
          polishInFlightRef.current = false;

          pushVersion({
            html: event.html,
            prompt: lastPromptRef.current,
            kind: isPolish ? "polish" : "create",
            timestamp: Date.now(),
          });

          const assistantText =
            isPolish && previousHtml
              ? buildPolishCompletionMessage({
                  html: event.html,
                  previousHtml,
                  userPrompt: lastPromptRef.current,
                  durationMs: event.durationMs,
                  agentSummary: event.assistantSummary,
                  telemetry: event.telemetry,
                  explicitApplied: event.explicitApplied,
                  explicitMissed: event.explicitMissed,
                })
              : buildAssistantCompletionMessage({
                  html: event.html,
                  previousHtml: isPolish ? previousHtml : undefined,
                  userPrompt: lastPromptRef.current,
                  isPolish,
                  durationMs: event.durationMs,
                  telemetry: event.telemetry,
                });
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
          if (event.telemetry?.truncated) {
            toast.warning(
              "Сайт мог получиться обрезанным — модель упёрлась в лимит токенов. Упрости запрос или нажми «Повторить».",
            );
          }
          break;
        }
        case "generate_error": {
          setLoading(false);
          setGenerationProgress(null);
          activeRequestIdRef.current = null;
          agentPolishActiveRef.current = false;
          polishInFlightRef.current = false;

          // ABORTED — эхо нашего abort (юзер нажал «отмена»): cancelGeneration
          // уже показал тост и сбросил вид. Не плодим второй бабл.
          if (event.code === "ABORTED") break;

          let msg = event.error;
          if (event.code === "NO_TUNNEL") {
            msg = "Твой туннель не подключён. Запусти NIT Tunnel клиент.";
          } else if (event.code === "TUNNEL_DISCONNECTED") {
            msg =
              "Связь с твоим компьютером прервалась. NIT Tunnel переподключается сам — когда статус вверху снова «Подключён», нажми «Повторить».";
          } else if (event.code === "RATE_LIMITED") {
            msg = "Слишком много параллельных генераций. Дождись завершения.";
          } else if (/no models? loaded/i.test(event.error)) {
            msg =
              "Модель в LM Studio выгрузилась (так бывает после простоя). Открой LM Studio и загрузи свою модель заново — или включи Just-In-Time загрузку в настройках сервера — затем нажми «Повторить».";
          } else if (/lm studio|400 bad request|invalid_request_error|no model/i.test(event.error)) {
            msg =
              "LM Studio вернул ошибку при генерации. Проверь, что модель загружена и сервер запущен на localhost:1234, затем нажми «Повторить».";
          }

          // Промпт для кнопки «Повторить» (кроме abort, обработанного выше).
          setRetryablePrompt(lastPromptRef.current || null);

          // ─── Спасение накопленного HTML ───
          // На первой генерации сервер не успевает отдать generate_done, но
          // клиент уже накопил стрим в pendingHtmlRef. Раньше всё терялось
          // (setMode("welcome") + чат не сохранялся). Теперь: если успели
          // собрать заметный кусок — показываем его как результат и сохраняем,
          // чтобы минуты ожидания и труд модели не пропали. Iframe дорисует
          // незакрытые теги сам.
          const salvaged = pendingHtmlRef.current || "";
          const looksLikeHtml = looksLikeSalvageableHtml(salvaged);

          if (looksLikeHtml && !htmlRef.current) {
            setHtml(salvaged);
            setStreamingHtml(salvaged);
            setMode("editing");
            setCurrentStep("done");
            pushVersion({
              html: salvaged,
              prompt: lastPromptRef.current,
              kind: "create",
              timestamp: Date.now(),
            });
            const note =
              `⚠️ Генерация прервалась, но я сохранил то, что успел собрать — ` +
              `${salvaged.length.toLocaleString("ru")} символов. Доработай правками справа ` +
              `или нажми «Повторить», чтобы сгенерировать заново.`;
            const updated: ChatMessage[] = [
              ...chatMessagesRef.current,
              { role: "assistant", text: note },
            ];
            setChatMessages((prev) => [...prev, { role: "assistant", text: note }]);
            try {
              saveToHistory({
                prompt: lastPromptRef.current,
                templateId: "",
                templateName: "",
                html: salvaged,
              });
              if (authRef.current.status === "authenticated") {
                void saveRemoteSite({
                  prompt: lastPromptRef.current,
                  html: salvaged,
                  templateId: "",
                  templateName: "",
                  chatMessages: JSON.stringify(updated),
                })
                  .then((id) => {
                    if (id) setCurrentSiteId(id);
                  })
                  .catch(() => {});
              }
            } catch {
              // ignore storage failures
            }
            toast.error("Генерация прервалась — показал, что успел собрать.");
            break;
          }

          // Спасать нечего (обрыв на plan-фазе / пустой стрим): сообщение +
          // повтор. Сайт уже есть (polish-ошибка) — остаёмся в split-view.
          // Чистим накопленный partial неудачной генерации, иначе превью и
          // «Скачать» (streamingHtml || html) показывали бы оборванный кусок
          // вместо последней рабочей версии (№6).
          setStreamingHtml("");
          pendingHtmlRef.current = "";
          setChatMessages((prev) => [...prev, { role: "assistant", text: `❌ ${msg}` }]);
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

  // Watchdog: если loading идёт, но туннель долго молчит (нет step/text/
  // progress дольше порога) — генерация зависла (мёртвый сокет, потерянный
  // запрос). Будим UI тем же путём, что обрыв связи: спасаем накопленный HTML
  // либо показываем ошибку + «Повторить». Без него веб висел в loading
  // бесконечно с накручивающимся таймером, хотя запрос до туннеля не дошёл.
  useEffect(() => {
    if (!loading) return;
    const STALL_MS = 90_000;
    const id = setInterval(() => {
      if (lastAliveAtRef.current && Date.now() - lastAliveAtRef.current > STALL_MS) {
        handleWsEvent({
          type: "generate_error",
          requestId: "",
          error: "Генерация зависла — туннель не отвечает",
          code: "TUNNEL_DISCONNECTED",
        });
      }
    }, 5000);
    return () => clearInterval(id);
  }, [loading, handleWsEvent]);

  // ─── Actions ──────────────────────────────────────────────────────

  const createSite = useCallback(
    async (prompt: string, createOptions: CreateSiteOptions = {}) => {
      // Guard «доделать, а не потерять»: если в памяти уже есть готовый сайт,
      // запрос из главного поля — это правка, а не новый сайт. Раньше повторный
      // промпт молча стирал сайт новой генерацией (память терялась). «Новый сайт»
      // идёт через reset() (html очищен) → сюда попадает с пустым html → create.
      // forceCreate (повтор после ошибки) минует guard — там нужен fresh create.
      if (!createOptions.forceCreate && htmlRef.current.trim() && polishSiteRef.current) {
        await polishSiteRef.current(prompt);
        return;
      }

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
      setGenerationProgress(null);
      setRetryablePrompt(null);
      lastStyleRef.current = createOptions.stylePresetId;
      pendingHtmlRef.current = "";
      lastAliveAtRef.current = Date.now();
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
        // Обработчик событий SSE. На create-раунде стримим партиал в iframe
        // (event.accumulated — растущий HTML). На continue-раундах accumulated
        // содержит ТОЛЬКО хвост (новый кусок), показ которого = битый фрагмент,
        // поэтому на докрутке превью не трогаем — обновим полным HTML между
        // раундами (см. ниже). isContinue разводит эти два случая.
        const makeHttpOnEvent = (isContinue: boolean) => (event: HttpPipelineEvent) => {
          switch (event.type) {
            case "session_init":
              sessionIdRef.current = event.sessionId;
              break;
            case "plan_ready":
              if (!isContinue) setCurrentStep("template");
              break;
            case "template_selected":
              if (!isContinue) {
                setTemplateName(event.templateName);
                setCurrentStep("template");
              }
              break;
            case "step_start":
              if (event.roleName === "Кодер" || event.roleName === "Backend builder") setCurrentStep("code");
              break;
            case "text_delta":
              if (!isContinue) scheduleIframeUpdate(event.accumulated, event.accumulated.length);
              break;
            case "truncated":
            case "step_complete":
            case "error":
              break;
          }
        };

        let result = await runHttpPipeline({
          mode: "create",
          projectId,
          prompt,
          sessionId: sessionIdRef.current,
          artifactMode,
          stylePresetId: createOptions.stylePresetId,
          signal: ctrl.signal,
          onEvent: makeHttpOnEvent(false),
        });

        // template_selected приходит только на create-раунде, поэтому шаблон
        // фиксируем сразу — continue-раунды его не переотдают (иначе после
        // докрутки templateId затёрся бы пустым и сайт не сохранился).
        const templateId = result.templateId;
        const templateName = result.templateName;

        // Докрутка на HTTP-пути. create-генерация при finishReason=length себя
        // не дозаправляет: сервер кладёт partial в session memory и отдаёт
        // truncated, ожидая mode=continue (на WS-пути это делает сам сервер).
        // Крутим, пока сервер разрешает (attemptsLeft>0); step_complete каждого
        // раунда несёт уже склеенный ПОЛНЫЙ HTML — берём свежий result.finalHtml
        // и продвигаем превью. continueGuard — страховка от расхождения с
        // серверным лимитом MAX_CONTINUATION_ATTEMPTS.
        let continueGuard = 0;
        while (result.truncated && (result.attemptsLeft ?? 0) > 0 && continueGuard < 6) {
          continueGuard++;
          setCurrentStep("code");
          result = await runHttpPipeline({
            mode: "continue",
            projectId,
            prompt,
            sessionId: sessionIdRef.current,
            signal: ctrl.signal,
            onEvent: makeHttpOnEvent(true),
          });
          scheduleIframeUpdate(result.finalHtml, result.finalHtml.length);
        }
        if (result.truncated) {
          toast.warning(
            "Сайт мог получиться обрезанным — модель упёрлась в лимит токенов. Нажми «Повторить» или упрости запрос (меньше блоков).",
          );
        }

        setCurrentStep("done");
        setHtml(result.finalHtml);
        setStreamingHtml("");
        setLastTemplateId(templateId);

        // Polish undo/redo: новая версия в стек (HTTP fallback path).
        pushVersion({
          html: result.finalHtml,
          prompt,
          kind: "create",
          timestamp: Date.now(),
        });

        if (result.finalHtml && templateId) {
          saveToHistory({
            prompt,
            html: result.finalHtml,
            templateId,
            templateName,
          });
          if (currentAuth.status === "authenticated") {
            void saveRemoteSite({
              prompt,
              html: result.finalHtml,
              templateId,
              templateName,
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
          setRetryablePrompt(lastPromptRef.current || prompt);
          const salvaged = pendingHtmlRef.current || "";
          if (looksLikeSalvageableHtml(salvaged) && !htmlRef.current) {
            setHtml(salvaged);
            setStreamingHtml(salvaged);
            setMode("editing");
            setCurrentStep("done");
            pushVersion({
              html: salvaged,
              prompt,
              kind: "create",
              timestamp: Date.now(),
            });
            toast.error("Генерация прервалась — показал, что успел собрать.");
          } else {
            toast.error(`Ошибка: ${msg}`);
            setMode("welcome");
          }
        } else {
          setMode("welcome");
        }
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
      setCurrentStep("code");
      polishInFlightRef.current = true;
      lastAliveAtRef.current = Date.now();

      const currentSocket = getSocketRef.current();
      const currentAuth = authRef.current;
      if (currentAuth.status === "authenticated" && currentSocket.tunnelStatus !== "online") {
        const msg = "NIT Tunnel не подключён. Запустите клиент, чтобы применить правки через ваш GPU.";
        setChatMessages((prev) => [...prev, { role: "assistant", text: `❌ ${msg}` }]);
        setLoading(false);
        polishInFlightRef.current = false;
        toast.error(msg);
        return;
      }

      if (currentAuth.status === "authenticated" && currentSocket.status !== "authed") {
        const msg = "Соединение с сервером восстанавливается — повтори через пару секунд.";
        setChatMessages((prev) => [...prev, { role: "assistant", text: `❌ ${msg}` }]);
        setLoading(false);
        polishInFlightRef.current = false;
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
        const agentPolish = readAgentPolishEnabled();
        agentPolishActiveRef.current = agentPolish;
        lastPromptRef.current = request;
        setLastPrompt(request);
        const sent = currentSocket.sendGenerate({
          requestId,
          mode: "polish",
          prompt: request,
          previousHtml: htmlRef.current,
          agentPolish,
        });
        if (!sent) {
          toast.error("Туннель не готов. Попробуй ещё раз.");
          setLoading(false);
          polishInFlightRef.current = false;
          return;
        }
        return;
      }

      // HTTP fallback
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      const beforeHtml = htmlRef.current || "";
      const polishStartMs = Date.now();
      const agentPolish = readAgentPolishEnabled();
      agentPolishActiveRef.current = agentPolish;
      lastPromptRef.current = request;
      setLastPrompt(request);
      let agentSummary: string | undefined;
      try {
        let result = await runHttpPipeline({
          mode: "polish",
          projectId,
          prompt: request,
          sessionId: sessionIdRef.current,
          previousHtml: htmlRef.current,
          agentPolish,
          signal: ctrl.signal,
          onEvent: (event) => {
            lastAliveAtRef.current = Date.now();
            switch (event.type) {
              case "session_init":
                sessionIdRef.current = event.sessionId;
                break;
              case "agent_summary":
                agentSummary = event.summary;
                break;
              case "text_delta":
                pendingHtmlRef.current = event.accumulated;
                if (polishInFlightRef.current || agentPolish) {
                  const preview = extractHtmlForPreview(event.accumulated);
                  if (preview && streamingHtmlReady(preview)) {
                    scheduleIframeUpdate(preview, preview.length, { keepPending: true });
                  }
                } else {
                  scheduleIframeUpdate(event.accumulated, event.accumulated.length);
                }
                break;
              default:
                break;
            }
          },
        });

        let continueGuard = 0;
        while (result.truncated && (result.attemptsLeft ?? 0) > 0 && continueGuard < 6) {
          continueGuard++;
          result = await runHttpPipeline({
            mode: "continue",
            projectId,
            prompt: request,
            sessionId: sessionIdRef.current,
            signal: ctrl.signal,
            onEvent: (event) => {
              lastAliveAtRef.current = Date.now();
              if (event.type === "text_delta") {
                pendingHtmlRef.current = event.accumulated;
              }
            },
          });
        }
        if (result.truncated) {
          toast.warning(
            "Правки могли обрезаться — модель упёрлась в лимит токенов. Упрости запрос или повтори.",
          );
        }

        agentPolishActiveRef.current = false;
        polishInFlightRef.current = false;

        setHtml(result.finalHtml);
        setStreamingHtml("");
        pushVersion({
          html: result.finalHtml,
          prompt: request,
          kind: "polish",
          timestamp: Date.now(),
        });
        const assistantText = buildPolishCompletionMessage({
          html: result.finalHtml,
          previousHtml: beforeHtml,
          userPrompt: request,
          durationMs: Date.now() - polishStartMs,
          agentSummary: agentSummary ?? result.assistantSummary,
          explicitApplied: result.explicitApplied,
          explicitMissed: result.explicitMissed,
        });
        const updatedMessages: ChatMessage[] = [
          ...chatMessagesRef.current,
          { role: "assistant", text: assistantText },
        ];
        setChatMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);
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
        agentPolishActiveRef.current = false;
        polishInFlightRef.current = false;
        const msg = (err as Error).message;
        if ((err as Error).name !== "AbortError") {
          setRetryablePrompt(request);
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

  // createSite делегирует сюда, если сайт уже есть (см. guard выше).
  useEffect(() => {
    polishSiteRef.current = polishSite;
  }, [polishSite]);

  const cancelGeneration = useCallback(() => {
    abortCtrlRef.current?.abort();
    if (activeRequestIdRef.current) {
      getSocketRef.current().sendAbort(activeRequestIdRef.current);
      activeRequestIdRef.current = null;
    }
    setLoading(false);
    toast.warning("Генерация отменена");
    // Отмена полировки готового сайта не должна выкидывать в welcome — html
    // живой. Чистим оборванный partial и остаёмся в редактировании; в welcome
    // уходим только если сайта ещё нет (отмена самой первой генерации) (№24).
    if (htmlRef.current) {
      setStreamingHtml("");
      pendingHtmlRef.current = "";
      setMode("editing");
    } else {
      setMode("welcome");
    }
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
    // currentSiteId должен быть Appwrite doc id — по нему идут share (/api/share)
    // и polish-PATCH (/api/sites/:id). Локальная история хранит id вида "h-..."
    // / "ssr" (historyStore) — это НЕ Appwrite-документ: share по нему даёт 404,
    // а PATCH молча уходит в никуда, и пользователю нечего открыть кроме адреса
    // кабинета. Для таких id — null, чтобы Share честно показал «ещё не
    // сохранён», а не выдал битую ссылку. Appwrite-id никогда не начинается с "h-".
    const isLocalId = /^h-/.test(entry.id) || entry.id === "ssr";
    setCurrentSiteId(isLocalId ? null : entry.id);
    // Стек версий сбрасываем — открытие сайта из истории это новая
    // «сессия» с точки зрения undo/redo. Версии прошлых полировок не
    // переносятся (сохраняется только final HTML + chat для контекста).
    setVersionStack({
      entries: [
        { html: entry.html, prompt: entry.prompt, kind: "create", timestamp: Date.now() },
      ],
      index: 0,
    });
  }, []);

  const reset = useCallback(() => {
    setMode("welcome");
    setHtml("");
    setStreamingHtml("");
    setChatMessages([]);
    setTemplateName("");
    setStreamingChars(0);
    setCurrentStep("plan");
    setVersionStack({ entries: [], index: -1 });
    setCurrentSiteId(null);
    sessionIdRef.current = undefined;
  }, []);

  // Undo/redo — двигаем индекс, восстанавливаем html. Не дёргаем сеть,
  // не пишем в history (это та же сессия, не новый сайт).
  const undoVersion = useCallback(() => {
    const { entries, index } = versionStackRef.current;
    if (index <= 0) return;
    const entry = entries[index - 1];
    if (entry) {
      setHtml(entry.html);
      setStreamingHtml("");
    }
    setVersionStack((prev) => (prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev));
  }, []);

  const redoVersion = useCallback(() => {
    const { entries, index } = versionStackRef.current;
    if (index >= entries.length - 1) return;
    const entry = entries[index + 1];
    if (entry) {
      setHtml(entry.html);
      setStreamingHtml("");
    }
    setVersionStack((prev) =>
      prev.index < prev.entries.length - 1 ? { ...prev, index: prev.index + 1 } : prev,
    );
  }, []);

  // Повтор последней генерации после ошибки/обрыва — тот же промпт и стиль.
  const retryGeneration = useCallback(() => {
    const prompt = retryablePrompt;
    if (!prompt) return;
    setRetryablePrompt(null);
    void createSite(prompt, { stylePresetId: lastStyleRef.current, forceCreate: true });
  }, [retryablePrompt, createSite]);

  return {
    mode,
    html,
    streamingHtml,
    streamingChars,
    generationProgress,
    retryAvailable: retryablePrompt !== null,
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
    retryGeneration,
    loadFromHistory,
    reset,
    undoVersion,
    redoVersion,
    setMode,
    setChatMessages,
    handleWsEvent,
  };
}
