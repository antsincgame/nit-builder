/**
 * TunnelRegistry — in-memory state for active tunnel connections.
 *
 * Responsibilities:
 * - Track which users have active tunnel connections
 * - Route browser requests to the right tunnel
 * - Match tunnel responses back to the waiting browser
 * - Handle disconnects, timeouts, multi-tab, multi-tunnel per user
 * - Принудительная revocation: revokeUserTunnels / revokeUserBrowsers для
 *   logout-all и regenerate-tunnel-token (без них старая WS остаётся authed
 *   до natural реконнекта, что эффективно отменяет logout-all на минуты-часы)
 *
 * All state is in-memory — on VPS restart, all tunnels must reconnect.
 * This is intentional: keeps the system simple and stateless.
 */

import type { WebSocket } from "ws";
import type {
  ServerToTunnel,
  ServerToBrowser,
  TunnelCapabilities,
  PipelineStep,
} from "@nit/shared";
import { stripCodeFences, stripThinkBlocks } from "~/lib/services/htmlOrchestrator.helpers";
import {
  CONTINUATION_SYSTEM_PROMPT,
  buildContinuationUserMessage,
  extractTail,
  joinPartialAndContinuation,
  MAX_CONTINUATION_ATTEMPTS,
} from "~/lib/services/continuation";
import { recordGeneration } from "~/lib/services/feedbackStore";
import {
  parseTunnelPlan,
  resolveTunnelPlan,
  finalizeTunnelHtml,
  buildTunnelRepairPhase,
  acceptTunnelRepair,
  clampOutputToContext,
  TUNNEL_REPAIR_MAX_TOKENS,
  TUNNEL_REPAIR_TEMPERATURE,
} from "~/lib/services/tunnelPipeline.server";
import { applyExplicitPolishEdits } from "~/lib/utils/polishExplicitEdits";
import { parseAgentPolishOutput } from "~/lib/services/agentPolish";
import { enrichSectionAnchors } from "~/lib/utils/sectionAnchors";
import {
  buildPhpSqliteArtifact,
  renderPhpSqliteArtifactPreview,
} from "~/lib/services/phpSqliteArtifactBuilder";
import {
  buildSectionDesignSystem,
  initSectionFlow,
  startSectionFlow,
  advanceSectionFlow,
  type SectionFlowState,
} from "~/lib/services/sectionAssembly";
import type { Plan } from "~/lib/utils/planSchema";
import type { StylePresetId } from "~/lib/llm/style-presets";
import { classifyModel, tierProfile, type RuntimeStats } from "~/lib/llm/modelTier";

// ─── Types ────────────────────────────────────────────────────────

export type TunnelConnection = {
  /** Unique connection ID (not the same as userId — one user can have multiple tunnels) */
  connectionId: string;
  userId: string;
  /**
   * ID привязанного устройства (per-device токен). Присутствует только если
   * туннель аутентифицировался device-токеном (Cursor-флоу); у legacy
   * per-account токена отсутствует. Нужен для точечного отзыва конкретного
   * устройства (revokeDeviceTunnels) без затрагивания других устройств юзера.
   */
  deviceId?: string;
  ws: WebSocket;
  capabilities: TunnelCapabilities;
  clientVersion: string;
  connectedAt: number;
  lastHeartbeat: number;
  /**
   * Накопленная статистика генераций ЭТОГО соединения для динамической
   * деградации класса: обрывы по длине (когда докрутка не спасла) и битый
   * вывод. Сбрасывается при чистой успешной генерации. Передаётся в
   * classifyModel — если модель по факту не тянет текущий режим, класс
   * понижается на лету. Живёт в рамках соединения; при реконнекте начинается
   * заново (это ок — проблема могла быть временной).
   */
  runtimeStats?: RuntimeStats;
};

export type BrowserSession = {
  sessionId: string;
  userId: string;
  ws: WebSocket;
  connectedAt: number;
  /**
   * sessionVersion из cookie на момент upgrade. На каждом heartbeat сравнивается
   * с current через getUserSessionVersion (кэш TTL 30s). Если current больше —
   * сессия отозвана (logout-all / password change), WS закрывается. Без этого
   * поля старая WS-сессия пережила бы logout-all до естественного реконнекта.
   *
   * Optional: в dev-режиме без Appwrite version не имеет смысла.
   */
  sessionVersion?: number;
};

/** Pending request waiting for tunnel response */
export type PendingRequest = {
  requestId: string;
  userId: string;
  browserSessionId: string;
  tunnelConnectionId: string;
  startedAt: number;
  /** Обновляется при каждом text/start/done — для прогресса и троттлинга. */
  lastActivityAt: number;
  /**
   * Обновляется ТОЛЬКО при реальном контенте (непустой text или старт фазы),
   * НЕ при пустых keepalive-чанках reasoning-модели. Свипер меряет простой по
   * нему: иначе `<think>`-капель раз в &lt;5 мин держала бы висяк бесконечно.
   */
  lastContentAt: number;
  /** Прогресс для UI: накоплено чанков (≈токенов), старт фазы, троттлинг отправки. */
  progressTokens?: number;
  progressStartedAt?: number;
  lastProgressSentAt?: number;
  currentStep: PipelineStep;
  /** Template info set after template_selected event */
  templateId?: string;
  templateName?: string;
  // ─── Контекст для server-driven continuation и feedback ───
  // Сохраняем то, что нужно чтобы (а) переотправить продолжение в туннель
  // если модель оборвалась на maxOutputTokens, (б) записать исход в
  // feedbackStore (раньше туннельные генерации мимо корпуса не попадали).
  /** Исходный промпт пользователя (для continuation prompt + feedback). */
  userMessage?: string;
  /** Режим генерации (create/polish) — для честной feedback-записи. Отсутствие = create. */
  mode?: "create" | "polish";
  /** Эксперимент Agent polish — conversational summary + full rewrite. */
  agentPolish?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  /** Модель/рантайм туннеля (из capabilities) — для feedback-записи. */
  model?: string;
  provider?: string;
  /** Накопленный HTML по всем раундам continuation (склейка без дублей). */
  accumulatedHtml?: string;
  /** Сколько раз уже до-генерировали из-за обрыва по длине. */
  continuationAttempts?: number;
  /**
   * true — докрутка исчерпана (TUNNEL_MAX_CONTINUATIONS), а модель всё ещё
   * обрывалась по длине: финальный HTML мог быть обрезан. Для телеметрии UI.
   */
  truncated?: boolean;
  /** Реальные токены последнего done из usage LM Studio (для телеметрии UI). */
  promptTokens?: number;
  completionTokens?: number;
  // ─── Двухфазный планировщик (tunnelPipeline) ───
  /**
   * Фаза запроса. "plan" — туннель генерит JSON-план (фаза 1), его текст НЕ
   * показывается браузеру; по done сервер парсит план, пробует skeleton и
   * либо финализирует, либо шлёт coder-промпт фазы 2. "code" — туннель генерит
   * HTML (фаза 2 или legacy одношаговый путь). "repair" — опциональная фаза 3
   * (Tier 6): туннель дополняет HTML недостающей админ-разметкой; стрим тоже
   * глотается (это НОВЫЙ полный HTML, дописывание к превью фазы code дало бы
   * кашу), результат принимается через acceptTunnelRepair. Отсутствие = "code".
   */
  phase?: "plan" | "code" | "repair" | "sections";
  /**
   * Backend-режим. Если "php-sqlite" — после plan-фазы (план наполнила модель
   * юзера) сервер собирает PHP+SQLite артефакт детерминированным билдером:
   * безопасный код из LLM-плана, без кодер-фазы.
   */
  artifactMode?: "php-sqlite";
  /**
   * Состояние посекционной генерации (когда phase==="sections"). Чистый
   * редьюсер SectionFlow держит очередь секций, накопленные блоки и ретраи;
   * registry лишь шлёт его шаги в туннель. undefined вне секционного режима.
   */
  sectionFlow?: SectionFlowState;
  /** Стиль-пресет (для resolveTunnelPlan и post-polish финализации). */
  stylePresetId?: StylePresetId;
  /** План, полученный в фазе 1 — нужен для post-polish финализации HTML. */
  plan?: Plan;
  /** Пресет, выбранный при резолюции плана — для финализации фазы code. */
  presetId?: StylePresetId;
  /**
   * HTML фазы кодера на момент запуска repair-фазы. Используется как откат,
   * если repair вернул мусор/обрезок/не улучшил разметку, и как маркер
   * «repair уже пробовали» (один раунд максимум).
   */
  htmlBeforeRepair?: string;
  /** Called when request completes or errors */
  onComplete?: (html: string) => void;
  onError?: (error: string) => void;
};

// ─── Safety caps ──────────────────────────────────────────────────
//
// MAX_CONCURRENT_PER_USER: env-конфигурируется через NIT_MAX_CONCURRENT_PER_USER
// (default 3). Считается по юзеру, не по туннелю — даже если у юзера два
// туннеля (ноут+десктоп), общий cap остаётся.
//
// Без cap-а юзер может DoS'ить собственный туннель (LM Studio подавится
// N параллельных stream'ов).
//
// PENDING_TIMEOUT_MS: если туннель отправил response_start и замолчал
// (LLM завис, gpu crash), pendingRequests висит пока не обнулится
// close-frame'ом. За 5 минут без активности — failим запрос и чистим.

const MAX_CONCURRENT_PER_USER = (() => {
  const raw = process.env.NIT_MAX_CONCURRENT_PER_USER;
  if (!raw) return 3;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : 3;
})();

const PENDING_TIMEOUT_MS = 5 * 60_000;
const PENDING_SWEEP_INTERVAL_MS = 30_000;

// Абсолютный потолок длительности запроса. Idle-свип (PENDING_TIMEOUT_MS по
// lastContentAt) ловит молчащую модель, но НЕ ловит модель, которая бесконечно
// капает токены (reasoning-петля, генерация-в-цикле): lastContentAt у неё всё
// время свежий. Hard-cap по startedAt — бэкстоп против такого «вечного висяка».
// Щедрый дефолт (медленные GPU + continuation-докрутки); env для тонкой крутки.
const PENDING_HARD_TIMEOUT_MS = (() => {
  const raw = process.env.NIT_PENDING_HARD_TIMEOUT_MS;
  if (!raw) return 20 * 60_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 60_000 ? n : 20 * 60_000;
})();

// Прогресс генерации шлём браузеру не чаще раза в N мс (на чанк-токен).
// 400мс — достаточно «живо» для счётчика токенов/таймера и не спамит WS.
const PROGRESS_THROTTLE_MS = 400;

// Сколько раз сервер сам до-генерирует HTML если локальная модель оборвалась
// на maxOutputTokens (finishReason==="length"). По умолчанию — общий лимит
// continuation-пайплайна (3). Конфигурируется через NIT_TUNNEL_MAX_CONTINUATIONS.
// 0 — отключить авто-докрутку (отдавать оборванный результат как раньше).
const TUNNEL_MAX_CONTINUATIONS = (() => {
  const raw = process.env.NIT_TUNNEL_MAX_CONTINUATIONS;
  if (raw === undefined) return MAX_CONTINUATION_ATTEMPTS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : MAX_CONTINUATION_ATTEMPTS;
})();

// ─── Посекционная генерация (опц., для слабых моделей S/M) ──────────
//
// Вместо одного большого HTML-вызова генерим сайт по секциям (hero, features,
// …) отдельными компактными вызовами и детерминированно сшиваем. Слабая 7-9B
// тянет одну секцию качественно, тогда как монолит обрывает. СТРОГО opt-in:
// NIT_TUNNEL_SECTIONS="1" включает. По умолчанию ВЫКЛ — поток генерации
// остаётся прежним (двухфазный plan→code), прод не затронут. Активен только
// для классов S/M (L идёт bespoke artifact, ему дробление не нужно).
// Прод nitgen.org: флаг ВЫКЛЮЧЕН (NIT_TUNNEL_SECTIONS=0). На reasoning-9B
// секционный режим проиграл монолиту: медленно (6 вызовов), нет прогресса
// в UI, слабый план/копирайтинг (hero=промпт, путаница CSS-переменных).
// Код режима оставлен за флагом для будущих сильных моделей.
const TUNNEL_SECTIONS_ENABLED = process.env.NIT_TUNNEL_SECTIONS === "1";
/** Ретраи одной секции при провале валидатора/обрыве (потом берём что есть). */
const SECTION_MAX_RETRIES = 1;
/** Бюджет токенов на одну секцию — она небольшая, монолитный бюджет не нужен. */
const SECTION_MAX_TOKENS = 4000;
/** Минимум секций, чтобы дробление имело смысл (1-2 секции проще монолитом). */
const SECTION_MIN_COUNT = 3;

// ─── State ───────────────────────────────────────────────────────

// ─── Singleton state via globalThis ────────────────────────────────
//
// CRITICAL: This module gets loaded TWICE in production:
//   1. Through tsx in server.ts (imports app/lib/server/wsHandlers.server.ts
//      which imports this file directly via tsx — uses fresh source)
//   2. Through the React Router build (build/server/index.js bundles all
//      route loaders, which import this file too — gets a separate copy)
//
// Without singleton state, registerTunnel() in copy #1 would update one
// `stats` object, and getStats() called from /api/health (copy #2) would
// read a different `stats` object — always zero. This is exactly the
// "tunnel connects but UI shows offline" bug.
//
// Fix: store state on globalThis under a unique key. Both copies of the
// module reach the same global, so state is shared.

type RegistryState = {
  tunnels: Map<string, TunnelConnection[]>;
  browsers: Map<string, BrowserSession>;
  browsersByUser: Map<string, Set<string>>;
  pendingRequests: Map<string, PendingRequest>;
  stats: {
    totalTunnelsRegistered: number;
    totalRequestsRouted: number;
    totalRequestsCompleted: number;
    totalRequestsFailed: number;
    totalRequestsAborted: number;
  };
};

const GLOBAL_KEY = "__NIT_TUNNEL_REGISTRY_STATE__";

function getState(): RegistryState {
  const g = globalThis as unknown as Record<string, RegistryState | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      tunnels: new Map(),
      browsers: new Map(),
      browsersByUser: new Map(),
      pendingRequests: new Map(),
      stats: {
        totalTunnelsRegistered: 0,
        totalRequestsRouted: 0,
        totalRequestsCompleted: 0,
        totalRequestsFailed: 0,
        totalRequestsAborted: 0,
      },
    };
  }
  return g[GLOBAL_KEY]!;
}

const _state = getState();
const tunnels = _state.tunnels;
const browsers = _state.browsers;
const browsersByUser = _state.browsersByUser;
const pendingRequests = _state.pendingRequests;
const stats = _state.stats;

// ─── Tunnel management ────────────────────────────────────────────

export function registerTunnel(conn: TunnelConnection): void {
  // Kill stale connections: при нестабильной сети туннель переподключается,
  // а старый WS умирает «тихо» (TCP полузакрыт) — его close-frame доходит
  // только через ping-таймаут (до 30-60с). Всё это окно старое соединение
  // висит в реестре, и getTunnelForUser может зароутить generate именно в
  // него (least-busy: 0 pending) → ws.send уходит в мёртвый сокет, реальный
  // туннель запроса НЕ видит, сайт висит в «Изучаем запрос». Поэтому при
  // новом hello сразу закрываем прежние соединения того же устройства
  // (per-device токен) либо того же юзера (legacy per-account токен).
  // Только per-device токены: legacy per-account токен (без deviceId) может
  // легитимно держать несколько туннелей (ноут + десктоп), их не трогаем —
  // мёртвые там подберёт ping-таймаут keepalive. Для per-device токена
  // дубль того же устройства = гарантированно зомби после реконнекта.
  const prior = tunnels.get(conn.userId) ?? [];
  const stale = conn.deviceId
    ? prior.filter((c) => c.deviceId === conn.deviceId)
    : [];
  for (const c of stale) {
    if (c.connectionId === conn.connectionId) continue;
    try {
      c.ws.close(4002, "Replaced by newer connection");
    } catch {
      // ws уже мёртв — unregisterTunnel ниже всё равно уберёт из реестра
    }
    // Синхронно фейлит pending этого соединения (TUNNEL_DISCONNECTED) и
    // убирает его из реестра, не дожидаясь запоздалого close-события.
    unregisterTunnel(c.connectionId);
  }

  const existing = tunnels.get(conn.userId) ?? [];
  existing.push(conn);
  tunnels.set(conn.userId, existing);
  stats.totalTunnelsRegistered++;

  // Notify all browser sessions of this user
  broadcastTunnelStatus(conn.userId);
}

export function unregisterTunnel(connectionId: string): void {
  for (const [userId, conns] of tunnels.entries()) {
    const filtered = conns.filter((c) => c.connectionId !== connectionId);
    if (filtered.length !== conns.length) {
      if (filtered.length === 0) {
        tunnels.delete(userId);
      } else {
        tunnels.set(userId, filtered);
      }

      // Fail all pending requests routed to this tunnel
      for (const [reqId, req] of pendingRequests.entries()) {
        if (req.tunnelConnectionId === connectionId) {
          const browser = browsers.get(req.browserSessionId);
          if (browser) {
            sendToBrowser(browser.ws, {
              type: "generate_error",
              requestId: reqId,
              error: "Tunnel disconnected during generation",
              code: "TUNNEL_DISCONNECTED",
            });
          }
          pendingRequests.delete(reqId);
          stats.totalRequestsFailed++;
        }
      }

      broadcastTunnelStatus(userId);
      return;
    }
  }
}

/** WebSocket.OPEN === 1. Моки в тестах выставляют readyState: 1. */
function isSocketOpen(ws: WebSocket): boolean {
  return ws.readyState === 1;
}

export function getTunnelForUser(userId: string): TunnelConnection | null {
  const all = tunnels.get(userId);
  if (!all || all.length === 0) return null;

  // Берём только живые сокеты. После обрыва+реконнекта туннеля старая запись
  // может ненадолго остаться в реестре (onClose не успел сработать). least-busy
  // выбрал бы её (0 pending) и отправил generate в мёртвый сокет — туннель
  // «Ожидает запросов», а браузер висит бесконечно. Фильтр по OPEN это чинит.
  const conns = all.filter((c) => isSocketOpen(c.ws));
  if (conns.length === 0) return null;
  if (conns.length === 1) return conns[0]!;

  // Least-busy strategy: считаем pending-requests per connection и выбираем
  // туннель с минимальной нагрузкой. Раньше возвращали conns[0] всегда —
  // если у юзера два туннеля (ноут + десктоп), весь трафик лил на первый,
  // второй простаивал. При равном количестве pending'ов стабильно выбираем
  // первый (детерминированно для тестов).
  const pendingByTunnel = new Map<string, number>();
  for (const req of pendingRequests.values()) {
    if (req.userId !== userId) continue;
    pendingByTunnel.set(
      req.tunnelConnectionId,
      (pendingByTunnel.get(req.tunnelConnectionId) ?? 0) + 1,
    );
  }

  let best = conns[0]!;
  let bestLoad = pendingByTunnel.get(best.connectionId) ?? 0;
  for (let i = 1; i < conns.length; i++) {
    const c = conns[i]!;
    const load = pendingByTunnel.get(c.connectionId) ?? 0;
    if (load < bestLoad) {
      best = c;
      bestLoad = load;
    }
  }
  return best;
}

export function hasTunnelForUser(userId: string): boolean {
  const conns = tunnels.get(userId);
  return !!conns && conns.length > 0;
}

export function getTunnelCount(userId: string): number {
  return tunnels.get(userId)?.length ?? 0;
}

export function updateHeartbeat(connectionId: string): void {
  for (const conns of tunnels.values()) {
    for (const c of conns) {
      if (c.connectionId === connectionId) {
        c.lastHeartbeat = Date.now();
        return;
      }
    }
  }
}

// ─── Browser session management ───────────────────────────────────

export function registerBrowser(session: BrowserSession): void {
  browsers.set(session.sessionId, session);

  let set = browsersByUser.get(session.userId);
  if (!set) {
    set = new Set();
    browsersByUser.set(session.userId, set);
  }
  set.add(session.sessionId);
}

export function unregisterBrowser(sessionId: string): void {
  const session = browsers.get(sessionId);
  if (!session) return;

  browsers.delete(sessionId);
  const set = browsersByUser.get(session.userId);
  if (set) {
    set.delete(sessionId);
    if (set.size === 0) browsersByUser.delete(session.userId);
  }

  // Abort any pending requests from this browser
  for (const [reqId, req] of pendingRequests.entries()) {
    if (req.browserSessionId === sessionId) {
      abortRequest(reqId);
    }
  }
}

function broadcastTunnelStatus(userId: string): void {
  const sessions = browsersByUser.get(userId);
  if (!sessions) return;

  const activeTunnels = getTunnelCount(userId);
  const message: ServerToBrowser = {
    type: "tunnel_status",
    status: activeTunnels > 0 ? "online" : "offline",
    activeTunnels,
  };

  for (const sessionId of sessions) {
    const browser = browsers.get(sessionId);
    if (browser) sendToBrowser(browser.ws, message);
  }
}

// ─── Forced revocation ──────────────────────────────────────────────
//
// Используется при logout-all и regenerate-tunnel-token. Без этого
// старая WS остаётся authed до естественного реконнекта (минуты-часы),
// фактически отменяя ревокацию.

/**
 * Закрывает все активные туннели юзера, возвращает их количество.
 * Применение: regenerate-tunnel-token (новый токен → старые туннели должны
 * переаутентифицироваться).
 */
export function revokeUserTunnels(
  userId: string,
  closeCode: number = 4001,
  reason: string = "Tunnel revoked",
): number {
  const conns = tunnels.get(userId);
  if (!conns || conns.length === 0) return 0;

  // Копия — unregisterTunnel ниже мутирует Map (set с новым массивом).
  // Хотя итерация по conns технически безопасна (conns ссылается на старый
  // массив, не мутируется in-place), копия делает поведение более явным.
  const copy = [...conns];
  let closed = 0;
  for (const c of copy) {
    try {
      c.ws.close(closeCode, reason);
    } catch {
      // ws уже закрыт или недоступен — всё равно убираем из реестра
    }
    unregisterTunnel(c.connectionId);
    closed++;
  }
  return closed;
}

/**
 * Закрывает активные туннели КОНКРЕТНОГО устройства (по deviceId), возвращает
 * количество. Применение: отзыв устройства в настройках — его соединение
 * должно оборваться сразу, не дожидаясь реконнекта. Туннели других устройств
 * юзера не трогаются. Реконнект с отозванным токеном не пройдёт авторизацию.
 */
export function revokeDeviceTunnels(
  deviceId: string,
  closeCode: number = 4001,
  reason: string = "Device revoked",
): number {
  if (!deviceId) return 0;
  const matches: TunnelConnection[] = [];
  for (const conns of tunnels.values()) {
    for (const c of conns) {
      if (c.deviceId === deviceId) matches.push(c);
    }
  }
  let closed = 0;
  for (const c of matches) {
    try {
      c.ws.close(closeCode, reason);
    } catch {
      // ws уже закрыт — всё равно убираем из реестра
    }
    unregisterTunnel(c.connectionId);
    closed++;
  }
  return closed;
}

/**
 * Закрывает все активные browser-сессии юзера, возвращает их количество.
 * Применение: logout-all (sessionVersion bump'нулась → старые WS должны
 * быть отозваны).
 */
export function revokeUserBrowsers(
  userId: string,
  closeCode: number = 4001,
  reason: string = "Session revoked",
): number {
  const sessionIds = browsersByUser.get(userId);
  if (!sessionIds || sessionIds.size === 0) return 0;

  const copy = Array.from(sessionIds);
  let closed = 0;
  for (const sid of copy) {
    const session = browsers.get(sid);
    if (!session) continue;
    try {
      session.ws.close(closeCode, reason);
    } catch {
      // ws уже закрыт — всё равно чистим реестр
    }
    unregisterBrowser(sid);
    closed++;
  }
  return closed;
}

// ─── Request routing ──────────────────────────────────────────────

export type RouteRequestParams = {
  requestId: string;
  userId: string;
  browserSessionId: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  // ─── Двухфазный планировщик ───
  /** "plan" — первый generate это планировщик; "code"/отсутствие — legacy. */
  phase?: "plan" | "code";
  /**
   * Режим генерации для телеметрии/feedback. "polish" — правка существующего
   * сайта (одна code-фаза, без плана). Отсутствие = "create". Раньше туннельный
   * исход всегда писался как "create", из-за чего feedback-корпус врал по polish.
   */
  mode?: "create" | "polish";
  /** Исходное сообщение юзера (в plan-фазе prompt = planner-промпт, не оно). */
  originalPrompt?: string;
  /** Стиль-пресет для резолюции плана + post-polish. */
  stylePresetId?: StylePresetId;
  /** Бюджет токенов фазы кодера/continuation (initial send юзает maxOutputTokens). */
  codeMaxOutputTokens?: number;
  /** "php-sqlite" — после plan-фазы собрать backend-артефакт вместо кодера. */
  artifactMode?: "php-sqlite";
  /** Эксперимент Agent polish — conversational summary + full rewrite. */
  agentPolish?: boolean;
};

/**
 * Route a generation request from a browser to the user's tunnel.
 * Returns false if no tunnel is available or user hit concurrent cap.
 */
export function routeRequest(params: RouteRequestParams): boolean {
  // Дедуп: повторный generate с тем же requestId (ретрай / дабл-клик / баг
  // клиента) раньше перезаписывал pendingRequests[requestId] — первый запрос
  // осиротевал на туннеле (GPU продолжал жечь), и sweeper его не подбирал
  // (ключ был перетёрт). Игнорируем дубликат: запрос уже в полёте.
  if (pendingRequests.has(params.requestId)) return false;

  // Cap: сколько одновременных generate в полёте у юзера.
  const active = countPendingByUser(params.userId);
  if (active >= MAX_CONCURRENT_PER_USER) return false;

  const tunnel = getTunnelForUser(params.userId);
  if (!tunnel) return false;

  // Зажимаем output-бюджет под реальный контекст пира. Для create первый send —
  // plan-фаза (короткий промпт), а code-бюджет переустановится после plan-done
  // (там зажимается против реального code-промпта). Для polish промпт здесь УЖЕ
  // code-промпт, поэтому зажим точный. No-op при неизвестном/большом контексте.
  const ctxWindow = tunnel.capabilities.contextWindow;
  const promptChars = params.system.length + params.prompt.length;
  const firstSendMax = clampOutputToContext(ctxWindow, promptChars, params.maxOutputTokens);
  const storedMax = clampOutputToContext(
    ctxWindow,
    promptChars,
    params.codeMaxOutputTokens ?? params.maxOutputTokens,
  );

  const now = Date.now();
  const pending: PendingRequest = {
    requestId: params.requestId,
    userId: params.userId,
    browserSessionId: params.browserSessionId,
    tunnelConnectionId: tunnel.connectionId,
    startedAt: now,
    lastActivityAt: now,
    lastContentAt: now,
    currentStep: params.phase === "plan" ? "plan" : "code",
    // userMessage — всегда исходное сообщение юзера (в plan-фазе params.prompt
    // это planner-промпт, поэтому берём originalPrompt). Нужен для coder-фазы,
    // continuation и feedback.
    userMessage: params.originalPrompt ?? params.prompt,
    mode: params.mode,
    // maxOutputTokens хранится как бюджет ФАЗЫ КОДЕРА (и continuation). Первый
    // send ниже использует params.maxOutputTokens (в plan-фазе — короткий
    // plan-бюджет), а на фазу code переключаемся уже с code-бюджетом.
    // storedMax = зажатый под контекст code-бюджет.
    maxOutputTokens: storedMax,
    temperature: params.temperature,
    model: tunnel.capabilities.model,
    provider: `tunnel:${tunnel.capabilities.runtime}`,
    accumulatedHtml: "",
    continuationAttempts: 0,
    phase: params.phase ?? "code",
    artifactMode: params.artifactMode,
    stylePresetId: params.stylePresetId,
    progressTokens: 0,
    progressStartedAt: now,
    lastProgressSentAt: 0,
    agentPolish: params.agentPolish,
  };
  pendingRequests.set(params.requestId, pending);
  stats.totalRequestsRouted++;

  const msg: ServerToTunnel = {
    type: "generate",
    requestId: params.requestId,
    system: params.system,
    prompt: params.prompt,
    maxOutputTokens: firstSendMax,
    temperature: params.temperature,
  };

  try {
    tunnel.ws.send(JSON.stringify(msg));
    return true;
  } catch {
    pendingRequests.delete(params.requestId);
    stats.totalRequestsFailed++;
    return false;
  }
}

function countPendingByUser(userId: string): number {
  let n = 0;
  for (const req of pendingRequests.values()) {
    if (req.userId === userId) n++;
  }
  return n;
}

/**
 * Отменяет запрос. Возвращает false, если pending не найден — например, abort
 * пришёл, пока generate ещё строил planner-промпт и не успел зарегистрировать
 * запрос (см. abortedEarly в wsHandlers). Тогда вызывающий запоминает отмену и
 * применяет её сразу после routeRequest, чтобы запрос не осиротел на туннеле.
 */
export function abortRequest(requestId: string, callerSessionId?: string): boolean {
  const req = pendingRequests.get(requestId);
  if (!req) return false;

  // Ownership: браузер отменяет ТОЛЬКО свои запросы. Без этой проверки любой
  // залогиненный юзер, зная чужой requestId, ронял чужую генерацию (ABORTED).
  // callerSessionId НЕ передают доверенные внутренние вызовы (unregisterBrowser,
  // early-abort своего же запроса) — для них проверка пропускается.
  if (callerSessionId !== undefined && req.browserSessionId !== callerSessionId) {
    return false;
  }

  // Tell the tunnel to abort
  const tunnel = findTunnelByConnectionId(req.tunnelConnectionId);
  if (tunnel) {
    try {
      tunnel.ws.send(JSON.stringify({ type: "abort", requestId } satisfies ServerToTunnel));
    } catch {
      // Tunnel already disconnected — ignore
    }
  }

  // Уведомляем браузер (если ещё на связи). Раньше abortRequest молча удалял
  // pending — если отмена пришла не от самого браузера, его UI оставался в
  // состоянии "генерация идёт" навсегда. Если браузер уже отключился
  // (unregisterBrowser удалил его ДО вызова abortRequest) — get вернёт
  // undefined и мы ничего не шлём, что корректно.
  const browser = browsers.get(req.browserSessionId);
  if (browser) {
    sendToBrowser(browser.ws, {
      type: "generate_error",
      requestId,
      error: "Generation aborted",
      code: "ABORTED",
    });
  }

  pendingRequests.delete(requestId);
  stats.totalRequestsAborted++;
  return true;
}

function findTunnelByConnectionId(connectionId: string): TunnelConnection | null {
  for (const conns of tunnels.values()) {
    for (const c of conns) {
      if (c.connectionId === connectionId) return c;
    }
  }
  return null;
}

/**
 * Патчит runtimeStats соединения (для динамической деградации класса).
 * No-op если соединение уже отвалилось.
 */
function updateTunnelRuntimeStats(
  connectionId: string,
  patch: (s: RuntimeStats) => void,
): void {
  const tunnel = findTunnelByConnectionId(connectionId);
  if (!tunnel) return;
  if (!tunnel.runtimeStats) tunnel.runtimeStats = {};
  patch(tunnel.runtimeStats);
}

// ─── Tunnel response forwarding ───────────────────────────────────

/**
 * Called by tunnel WebSocket handler when it receives a response message.
 * Forwards to the waiting browser as SSE-style events.
 */
export function handleTunnelResponse(
  requestId: string,
  event:
    | { type: "start" }
    | { type: "text"; text: string }
    | { type: "done"; fullText: string; durationMs: number; finishReason?: "stop" | "length" | "unknown"; promptTokens?: number; completionTokens?: number; model?: string }
    | { type: "error"; error: string },
): void {
  const req = pendingRequests.get(requestId);
  if (!req) return; // browser already disconnected or aborted

  req.lastActivityAt = Date.now();

  const browser = browsers.get(req.browserSessionId);
  if (!browser) {
    pendingRequests.delete(requestId);
    return;
  }

  switch (event.type) {
    case "start":
      req.lastContentAt = Date.now(); // старт фазы — реальный прогресс
      if (req.phase === "plan") {
        req.currentStep = "plan";
        sendToBrowser(browser.ws, { type: "generate_step", requestId, step: "plan" });
      } else {
        req.currentStep = "code";
        sendToBrowser(browser.ws, { type: "generate_step", requestId, step: "code" });
      }
      break;

    case "text": {
      // ─── Прогресс генерации (живой счётчик токенов/таймер) ───
      // Считаем чанки во ВСЕХ фазах, включая plan/repair/sections, где
      // контент в превью не идёт. В plan-фазе крупная модель молчит в
      // превью минутами — без этого кажется, что «зависло». Шлём с
      // троттлингом PROGRESS_THROTTLE_MS. Пустой text — keepalive
      // reasoning-модели (<think>), считаем его тиком фазы thinking.
      const nowTs = req.lastActivityAt; // = Date.now(), выставлен выше
      // Непустой text — реальный контент: двигаем lastContentAt (по нему свипер
      // меряет простой). Пустой keepalive (<think>) НЕ двигает — иначе висяк
      // маскируется бесконечно.
      if (event.text) {
        req.progressTokens = (req.progressTokens ?? 0) + 1;
        req.lastContentAt = nowTs;
      }
      if (nowTs - (req.lastProgressSentAt ?? 0) >= PROGRESS_THROTTLE_MS) {
        req.lastProgressSentAt = nowTs;
        const progressPhase: "plan" | "thinking" | "code" = !event.text
          ? "thinking"
          : req.phase === "plan"
            ? "plan"
            : "code";
        sendToBrowser(browser.ws, {
          type: "generate_progress",
          requestId,
          phase: progressPhase,
          tokens: req.progressTokens ?? 0,
          elapsedMs: nowTs - (req.progressStartedAt ?? nowTs),
        });
      }

      // Пустой text — keepalive: прогресс-тик уже ушёл, контент не шлём.
      if (!event.text) break;
      // В plan-фазе туннель стримит JSON-план — его НЕ показываем браузеру
      // (иначе сырой JSON попадёт в превью как «сайт»). В repair-фазе туннель
      // стримит НОВЫЙ полный HTML — дописывание его к превью фазы code дало
      // бы кашу из двух документов. sections — аналогично. Глотаем; браузер
      // получит финальный HTML в generate_done.
      if (req.phase === "plan" || req.phase === "repair" || req.phase === "sections") break;
      sendToBrowser(browser.ws, {
        type: "generate_text",
        requestId,
        text: event.text,
      });
      break;
    }

    case "done": {
      // Reasoning-модели (Qwen3 GGUF и т.п.) шлют размышления <think>...</think>
      // прямо в content — без среза они ломают JSON-парсер плана и попадают
      // в финальный HTML. Срезаем один раз для всех фаз (plan/code/repair).
      const piece = stripThinkBlocks(event.fullText ?? "");

      // Реальные токены из usage (последний done — финальная code/continuation/
      // repair-фаза, самая репрезентативная по занятости контекста).
      if (typeof event.promptTokens === "number") req.promptTokens = event.promptTokens;
      if (typeof event.completionTokens === "number") req.completionTokens = event.completionTokens;
      // Имя модели, реально обработавшей запрос (из response_done туннеля).
      // Заменяет статичный capabilities.model (момент hello): он мог устареть
      // или оказаться эмбеддером при мульти-модельном LM Studio. Последний done
      // (финальная фаза) — самый репрезентативный, как и с токенами выше.
      if (typeof event.model === "string" && event.model) req.model = event.model;

      // ─── Фаза 1 (planner) ───
      // Туннель вернул JSON-план. Парсим, выбираем шаблон. Если skeleton-
      // injection заполнила слоты — отдаём готовый HTML без второго LLM-вызова.
      // Иначе шлём coder-промпт фазы 2 в туннель.
      if (req.phase === "plan") {
        const tunnel = findTunnelByConnectionId(req.tunnelConnectionId);
        // Класс модели туннеля определяет режим (skeleton/coder/artifact) и
        // бюджет токенов фазы кодера. Без туннеля (отвалился) — безопасный S.
        // runtimeStats понижает класс на лету, если модель по факту не тянет
        // текущий режим (обрывы по длине / битый вывод в прошлых генерациях).
        const tier = tunnel ? classifyModel(tunnel.capabilities, tunnel.runtimeStats) : "S";
        try {
          const plan = parseTunnelPlan(piece, req.userMessage ?? "");

          // ─── Гибрид backend (php-sqlite) ───
          // План наполнила модель юзера (бизнес, каталог/услуги, тексты, FAQ),
          // а безопасный детерминированный билдер собирает из него PHP+SQLite —
          // без кодер-фазы. Так наполнение осмысленное по запросу, а исполняемый
          // код остаётся проверенным (PDO prepared, экранирование, CSRF, auth).
          if (req.artifactMode === "php-sqlite") {
            // Случайный seed вариативности (как в HTTP-пайплайне): каждая генерация —
            // новый вид (палитра, структура, тип героя), даже при одинаковом запросе.
            // Один seeded-план идёт и в билдер, и в превью — CSS и разметка не разойдутся.
            const seededPlan = { ...plan, variantSeed: Math.floor(Math.random() * 0xffffffff) };
            const artifact = buildPhpSqliteArtifact({ plan: seededPlan, userMessage: req.userMessage ?? "" });
            const previewHtml = renderPhpSqliteArtifactPreview({
              artifact,
              plan: seededPlan,
              userMessage: req.userMessage ?? "",
            });
            req.plan = seededPlan;
            req.templateId = "php-sqlite-app";
            req.templateName = "PHP + SQLite backend";
            sendToBrowser(browser.ws, {
              type: "generate_step",
              requestId,
              step: "template",
              templateId: "php-sqlite-app",
              templateName: "PHP + SQLite backend",
            });
            sendToBrowser(browser.ws, {
              type: "generate_done",
              requestId,
              html: previewHtml,
              templateId: "php-sqlite-app",
              templateName: "PHP + SQLite backend",
              durationMs: event.durationMs,
            });
            if (req.onComplete) req.onComplete(previewHtml);
            recordTunnelOutcome(req, "success", "tunnel-php-sqlite", "coder");
            pendingRequests.delete(requestId);
            stats.totalRequestsCompleted++;
            break;
          }

          const resolution = resolveTunnelPlan(plan, req.userMessage ?? "", req.stylePresetId, tier);
          req.plan = plan;
          req.templateId = resolution.templateId;
          req.templateName = resolution.templateName;
          sendToBrowser(browser.ws, {
            type: "generate_step",
            requestId,
            step: "template",
            templateId: resolution.templateId,
            templateName: resolution.templateName,
          });

          if (resolution.kind === "skeleton") {
            // HTML уже финальный (stripCodeFences внутри resolveTunnelPlan).
            sendToBrowser(browser.ws, {
              type: "generate_done",
              requestId,
              html: resolution.html,
              templateId: resolution.templateId,
              templateName: resolution.templateName,
              durationMs: event.durationMs,
            });
            if (req.onComplete) req.onComplete(resolution.html);
            recordTunnelOutcome(req, "success", "tunnel-skeleton", "skeleton");
            pendingRequests.delete(requestId);
            stats.totalRequestsCompleted++;
            break;
          }

          // Coder-фаза: нужен второй generate в туннель.
          if (!tunnel) {
            sendToBrowser(browser.ws, {
              type: "generate_error",
              requestId,
              error: "Tunnel disconnected during generation",
              code: "TUNNEL_DISCONNECTED",
            });
            if (req.onError) req.onError("tunnel_gone_after_plan");
            recordTunnelOutcome(req, "error", "tunnel_gone_after_plan");
            pendingRequests.delete(requestId);
            stats.totalRequestsFailed++;
            break;
          }

          // Посекционный режим (опц., классы S/M): дробим сайт на секции
          // вместо монолитного HTML. tier!=="L" — L идёт bespoke artifact,
          // ему дробление не нужно (и resolution.system был бы artifact-
          // промптом, не coder). Строго opt-in через NIT_TUNNEL_SECTIONS.
          if (
            TUNNEL_SECTIONS_ENABLED &&
            tier !== "L" &&
            plan.sections.length >= SECTION_MIN_COUNT
          ) {
            const design = buildSectionDesignSystem(plan);
            const flow = initSectionFlow(plan, design);
            const first = startSectionFlow(flow);
            if (first.kind === "generate") {
              req.sectionFlow = flow;
              req.phase = "sections";
              req.presetId = resolution.presetId;
              req.accumulatedHtml = "";
              req.continuationAttempts = 0;
              req.currentStep = "code";
              sendToBrowser(browser.ws, { type: "generate_step", requestId, step: "code" });
              tunnel.ws.send(
                JSON.stringify({
                  type: "generate",
                  requestId,
                  system: first.system,
                  prompt: first.prompt,
                  maxOutputTokens: SECTION_MAX_TOKENS,
                  temperature: req.temperature ?? 0.4,
                } satisfies ServerToTunnel),
              );
              return; // ждём done первой секции
            }
            // first.kind==="done" (секций нет) маловероятно при length>=MIN —
            // безопасно проваливаемся в обычный coder ниже.
          }

          req.phase = "code";
          req.presetId = resolution.presetId;
          // Бюджет токенов фазы кодера/continuation — по классу модели:
          // S=16000, M=12000, L=16000. Repair ниже берёт
          // min(этот бюджет, TUNNEL_REPAIR_MAX_TOKENS), так что L не урезается.
          // Зажимаем под реальный контекст пира (clampOutputToContext): на модели
          // с малым окном фикс-бюджет переполнял контекст; continuation добьёт хвост.
          req.maxOutputTokens = clampOutputToContext(
            tunnel.capabilities.contextWindow,
            resolution.system.length + resolution.prompt.length,
            tierProfile(tier).codeMaxTokens,
          );
          req.accumulatedHtml = "";
          req.continuationAttempts = 0;
          req.currentStep = "code";
          sendToBrowser(browser.ws, { type: "generate_step", requestId, step: "code" });
          tunnel.ws.send(
            JSON.stringify({
              type: "generate",
              requestId,
              system: resolution.system,
              prompt: resolution.prompt,
              maxOutputTokens: req.maxOutputTokens ?? 8000,
              temperature: req.temperature ?? 0.4,
            } satisfies ServerToTunnel),
          );
          return; // ждём response_done фазы code
        } catch (err) {
          // Резолюция плана упала (редко) — честная ошибка вместо зависания.
          sendToBrowser(browser.ws, {
            type: "generate_error",
            requestId,
            error: `Ошибка планировщика: ${(err as Error).message}`,
            code: "LLM_ERROR",
          });
          if (req.onError) req.onError("plan_resolution_failed");
          recordTunnelOutcome(req, "error", `plan_resolution: ${(err as Error).message}`);
          pendingRequests.delete(requestId);
          stats.totalRequestsFailed++;
          break;
        }
      }

      // ─── Done секционной фазы (опц., за флагом NIT_TUNNEL_SECTIONS) ───
      // Прогоняем чистый редьюсер: либо шлём следующую секцию (или ретрай
      // текущей), либо финализируем собранный документ. Обрыв по длине
      // передаём как truncated — редьюсер решает, ретраить или принять.
      if (req.phase === "sections" && req.sectionFlow) {
        const adv = advanceSectionFlow(req.sectionFlow, piece, {
          maxRetries: SECTION_MAX_RETRIES,
          truncated: event.finishReason === "length",
        });
        req.sectionFlow = adv.state;

        if (adv.step.kind === "done") {
          // Собранный документ финализируем тем же путём, что и монолит:
          // req.plan+presetId выставлены → finalizeTunnelHtml (strip +
          // post-polish + премиум-слой).
          finalizeTunnelDone(req, browser.ws, adv.step.html, event.durationMs);
          break;
        }

        // Нужен ещё один generate (следующая секция либо ретрай текущей).
        const sectionTunnel = findTunnelByConnectionId(req.tunnelConnectionId);
        if (sectionTunnel) {
          req.currentStep = "code";
          try {
            sectionTunnel.ws.send(
              JSON.stringify({
                type: "generate",
                requestId,
                system: adv.step.system,
                prompt: adv.step.prompt,
                maxOutputTokens: SECTION_MAX_TOKENS,
                temperature: req.temperature ?? 0.4,
              } satisfies ServerToTunnel),
            );
            return; // ждём done следующей секции
          } catch {
            // отправка не удалась — обрабатываем как обрыв туннеля ниже
          }
        }
        sendToBrowser(browser.ws, {
          type: "generate_error",
          requestId,
          error: "Tunnel disconnected during generation",
          code: "TUNNEL_DISCONNECTED",
        });
        if (req.onError) req.onError("tunnel_gone_during_sections");
        recordTunnelOutcome(req, "error", "tunnel_gone_during_sections");
        pendingRequests.delete(requestId);
        stats.totalRequestsFailed++;
        break;
      }

      // ─── Done repair-фазы (Tier 6) ───
      // Обрыв по токенам ловим по finishReason: текстовых следов обрыва после
      // strip-слоя не остаётся (stripCodeFences дописывает </html>,
      // repairTruncatedHtml дочинивает теги), поэтому при "length" — молчаливый
      // откат к HTML фазы кодера без траты continuation. Старые туннель-клиенты
      // finishReason не шлют (undefined) — тогда полагаемся на аудит-сравнение
      // внутри acceptTunnelRepair (приём только при уменьшении промахов).
      if (req.phase === "repair" && req.plan) {
        if (event.finishReason === "length") {
          finalizeTunnelDone(req, browser.ws, req.htmlBeforeRepair ?? "", event.durationMs);
          break;
        }
        const best = acceptTunnelRepair(req.htmlBeforeRepair ?? "", piece, req.plan);
        finalizeTunnelDone(req, browser.ws, best, event.durationMs);
        break;
      }

      // ─── Фаза code (continuation + финализация) ───
      const attempts = req.continuationAttempts ?? 0;
      const merged =
        attempts > 0 ? joinPartialAndContinuation(req.accumulatedHtml ?? "", piece) : piece;

      // Server-driven continuation: модель оборвалась на maxOutputTokens
      // (finishReason==="length") и есть бюджет докрутки → копим хвост и
      // шлём в туннель запрос "продолжи с точки обрыва". Для браузера это
      // прозрачно (доп. generate_text + финальный generate_done с целым HTML).
      // Старые клиенты туннеля finishReason не шлют → ветка не срабатывает,
      // поведение прежнее.
      if (event.finishReason === "length" && attempts < TUNNEL_MAX_CONTINUATIONS) {
        const tunnel = findTunnelByConnectionId(req.tunnelConnectionId);
        if (tunnel) {
          req.accumulatedHtml = merged;
          req.continuationAttempts = attempts + 1;
          req.currentStep = "code";
          const tail = extractTail(merged);
          try {
            tunnel.ws.send(
              JSON.stringify({
                type: "generate",
                requestId,
                system: CONTINUATION_SYSTEM_PROMPT,
                prompt: buildContinuationUserMessage({
                  userMessage: req.userMessage ?? "",
                  tail,
                }),
                maxOutputTokens: req.maxOutputTokens ?? 8000,
                temperature: req.temperature ?? 0.4,
              } satisfies ServerToTunnel),
            );
            return; // ждём следующий response_done, не финализируем
          } catch {
            // туннель отвалился при отправке — финализируем тем что накопили
          }
        }
        // туннеля нет — финализируем накопленным (ниже)
      }

      // Докрутка исчерпана, а модель всё ещё обрывается по длине — сильный
      // сигнал «не тянет объём текущего режима». Копим для динамической
      // деградации: на следующей генерации classifyModel понизит класс.
      if (event.finishReason === "length" && attempts >= TUNNEL_MAX_CONTINUATIONS) {
        req.truncated = true;
        updateTunnelRuntimeStats(req.tunnelConnectionId, (s) => {
          s.lengthTruncations = (s.lengthTruncations ?? 0) + 1;
        });
      }

      // ─── Tier 6: запуск repair-фазы (зеркало pipelineCreate) ───
      // Только двухфазный путь (есть план) и только один раунд
      // (htmlBeforeRepair служит маркером). merged здесь — полный HTML
      // фазы кодера: length-ветка выше уже отработала.
      if (req.plan && !req.htmlBeforeRepair) {
        const repairPhase = buildTunnelRepairPhase(merged, req.plan);
        if (repairPhase) {
          const repairTunnel = findTunnelByConnectionId(req.tunnelConnectionId);
          if (repairTunnel) {
            req.htmlBeforeRepair = merged;
            req.phase = "repair";
            req.currentStep = "code";
            try {
              repairTunnel.ws.send(
                JSON.stringify({
                  type: "generate",
                  requestId,
                  system: repairPhase.system,
                  prompt: repairPhase.prompt,
                  maxOutputTokens: Math.min(
                    req.maxOutputTokens ?? 8000,
                    TUNNEL_REPAIR_MAX_TOKENS,
                  ),
                  temperature: TUNNEL_REPAIR_TEMPERATURE,
                } satisfies ServerToTunnel),
              );
              return; // ждём response_done repair-фазы
            } catch {
              // туннель отвалился при отправке — финализируем HTML фазы кодера
              req.phase = "code";
              req.htmlBeforeRepair = undefined;
            }
          }
        }
      }

      finalizeTunnelDone(req, browser.ws, merged, event.durationMs);
      break;
    }

    case "error":
      // Repair-фаза best-effort (зеркало серверного repair): ошибка туннеля
      // на починке не роняет генерацию — финализируем HTML фазы кодера.
      if (req.phase === "repair" && req.htmlBeforeRepair && req.plan) {
        finalizeTunnelDone(
          req,
          browser.ws,
          req.htmlBeforeRepair,
          Date.now() - req.startedAt,
        );
        break;
      }
      sendToBrowser(browser.ws, {
        type: "generate_error",
        requestId,
        error: event.error,
        code: "LLM_ERROR",
      });
      if (req.onError) req.onError(event.error);
      recordTunnelOutcome(req, "error", `tunnel: ${event.error}`);
      pendingRequests.delete(requestId);
      stats.totalRequestsFailed++;
      break;
  }
}

/** Used by orchestrator to set template info mid-pipeline (before Coder step) */
export function setRequestTemplate(
  requestId: string,
  templateId: string,
  templateName: string,
): void {
  const req = pendingRequests.get(requestId);
  if (!req) return;
  req.templateId = templateId;
  req.templateName = templateName;

  const browser = browsers.get(req.browserSessionId);
  if (browser) {
    sendToBrowser(browser.ws, {
      type: "generate_step",
      requestId,
      step: "template",
      templateId,
      templateName,
    });
  }
}

// ─── Utilities ────────────────────────────────────────────────────

// Порог буфера сокета, выше которого роняем косметические прогресс-тики.
const BROWSER_BACKPRESSURE_BYTES = 4 * 1024 * 1024;

function sendToBrowser(ws: WebSocket, msg: ServerToBrowser): void {
  // Backpressure: медленный браузер (плохая сеть, фоновая вкладка) не успевает
  // читать → буфер сокета растёт и жрёт память сервера. generate_progress —
  // чисто косметический тик счётчика токенов; под высоким буфером дропаем его
  // (следующий тик или generate_done восстановят счётчик). Всё остальное —
  // текст превью, done, ошибки, статус — шлём всегда.
  if (msg.type === "generate_progress" && ws.bufferedAmount > BROWSER_BACKPRESSURE_BYTES) {
    return;
  }
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // Silently drop — browser disconnected
  }
}

// ─── Tunnel done finalization ─────────────────────────────────────

/** Базовая проверка что туннель вернул осмысленный HTML, а не пустоту/отказ. */
function isUsableHtml(html: string): boolean {
  const t = html.trim();
  if (t.length === 0) return false;
  // Раньше пропускали любой текст с одним "<" — отказ модели или мусор с единой
  // угловой скобкой уходил юзеру «как готовый сайт». Теперь требуем минимальную
  // структуру: закрывающий тег ЛИБО узнаваемый структурный/контентный элемент.
  const lower = t.toLowerCase();
  return /<\//.test(t) || /<(html|body|div|section|main|header|h1|h2|p|ul|article|nav)\b/.test(lower);
}

/**
 * Записывает исход туннельной генерации в feedbackStore. Раньше туннельный
 * путь (основной для BYO-GPU) мимо корпуса не попадал — петля самообучения
 * RAG и метрики видели только серверные/HTTP генерации. Fire-and-forget,
 * gated через NIT_FEEDBACK_ENABLED.
 */
function recordTunnelOutcome(
  req: PendingRequest,
  outcome: "success" | "error",
  note?: string,
  injectMethod: "skeleton" | "coder" = "coder",
): void {
  recordGeneration({
    sessionId: req.browserSessionId,
    mode: req.mode ?? "create",
    outcome,
    provider: req.provider ?? "tunnel",
    model: req.model ?? "unknown",
    durationMs: Date.now() - req.startedAt,
    userMessage: req.userMessage ?? "",
    templateId: req.templateId,
    injectMethod,
    ...(outcome === "error" ? { errorReason: note } : note ? { note } : {}),
  });
}

/**
 * Финализирует туннельную генерацию: чистит markdown-обёртки через
 * stripCodeFences (как серверный путь), валидирует, шлёт браузеру
 * generate_done либо generate_error, пишет feedback.
 */
function finalizeTunnelDone(
  req: PendingRequest,
  browserWs: WebSocket,
  rawHtml: string,
  durationMs: number,
): void {
  const agentParsed = req.agentPolish ? parseAgentPolishOutput(rawHtml) : null;

  // Двухфазный путь: есть план+пресет → stripCodeFences + post-polish (как
  // серверный путь). Legacy одношаговый путь → только stripCodeFences.
  const htmlBase =
    req.plan && req.presetId
      ? finalizeTunnelHtml(rawHtml, req.plan, req.presetId)
      : agentParsed
        ? agentParsed.html
        : stripCodeFences(rawHtml);

  const explicitEdits =
    req.mode === "polish" && req.userMessage
      ? applyExplicitPolishEdits(htmlBase, req.userMessage)
      : null;
  const finalizedRaw = explicitEdits?.html ?? htmlBase;
  const finalized =
    req.mode === "polish" ? enrichSectionAnchors(finalizedRaw) : finalizedRaw;

  if (!isUsableHtml(finalized)) {
    // Локальная модель вернула пустоту/мусор/отказ — раньше это уходило
    // юзеру «как готовый сайт». Теперь — честная ошибка.
    // Метим вывод битым для динамической деградации класса.
    updateTunnelRuntimeStats(req.tunnelConnectionId, (s) => {
      s.lastOutputInvalid = true;
    });
    sendToBrowser(browserWs, {
      type: "generate_error",
      requestId: req.requestId,
      error:
        "Модель вернула пустой или невалидный результат. Попробуй ещё раз или уточни запрос.",
      code: "LLM_ERROR",
    });
    if (req.onError) req.onError("empty_or_invalid_html");
    recordTunnelOutcome(req, "error", "empty_or_invalid_html");
    pendingRequests.delete(req.requestId);
    stats.totalRequestsFailed++;
    return;
  }

  const tunnel = findTunnelByConnectionId(req.tunnelConnectionId);
  sendToBrowser(browserWs, {
    type: "generate_done",
    requestId: req.requestId,
    html: finalized,
    templateId: req.templateId ?? "unknown",
    templateName: req.templateName ?? "Unknown",
      durationMs,
      ...(req.mode === "polish" ? { generationMode: "polish" as const } : {}),
      ...(agentParsed?.summary ? { assistantSummary: agentParsed.summary } : {}),
      ...(explicitEdits?.applied.length
        ? { explicitApplied: explicitEdits.applied }
        : {}),
      ...(explicitEdits?.missed.length ? { explicitMissed: explicitEdits.missed } : {}),
    telemetry: {
      model: req.model,
      contextWindow: tunnel?.capabilities.contextWindow,
      continuationRounds: req.continuationAttempts ?? 0,
      truncated: req.truncated ?? false,
      repaired: !!req.htmlBeforeRepair,
      promptTokens: req.promptTokens,
      completionTokens: req.completionTokens,
    },
  });
  // Чистая успешная генерация — сбрасываем счётчики деградации, чтобы
  // единичный прошлый сбой не топил класс навсегда (самовосстановление).
  updateTunnelRuntimeStats(req.tunnelConnectionId, (s) => {
    s.lengthTruncations = 0;
    s.lastOutputInvalid = false;
  });
  if (req.onComplete) req.onComplete(finalized);
  recordTunnelOutcome(
    req,
    "success",
    req.htmlBeforeRepair
      ? "tunnel-repaired"
      : (req.continuationAttempts ?? 0) > 0
        ? "tunnel-continued"
        : undefined,
  );
  pendingRequests.delete(req.requestId);
  stats.totalRequestsCompleted++;
}

export function getStats() {
  return {
    ...stats,
    activeTunnels: Array.from(tunnels.values()).reduce((sum, arr) => sum + arr.length, 0),
    activeBrowsers: browsers.size,
    pendingRequests: pendingRequests.size,
    uniqueUsersWithTunnel: tunnels.size,
    maxConcurrentPerUser: MAX_CONCURRENT_PER_USER,
  };
}

/** For tests */
export function resetRegistry(): void {
  tunnels.clear();
  browsers.clear();
  browsersByUser.clear();
  pendingRequests.clear();
  stats.totalTunnelsRegistered = 0;
  stats.totalRequestsRouted = 0;
  stats.totalRequestsCompleted = 0;
  stats.totalRequestsFailed = 0;
  stats.totalRequestsAborted = 0;
}

// ─── Stale-pending sweeper ────────────────────────────────────────
//
// Если туннель отвечает start'ом и потом затих (GPU crash, LLM deadlock,
// OOM у клиента), запись в pendingRequests висит пока не сработает close
// WS — а WS-close случится только когда сервер отрубит keepalive (минуты).
// Явный sweeper по lastActivityAt делает поведение предсказуемым.
//
// Храним таймер в globalThis тоже — иначе при двойной загрузке модуля
// (tsx + React Router build) запустится два sweeper'а.

type SweeperState = { timer: NodeJS.Timeout | null };
const SWEEPER_KEY = "__NIT_TUNNEL_REGISTRY_SWEEPER__";

function ensureSweeper(): void {
  const g = globalThis as unknown as Record<string, SweeperState | undefined>;
  if (g[SWEEPER_KEY]?.timer) return;

  const state: SweeperState = { timer: null };
  state.timer = setInterval(() => {
    const now = Date.now();
    for (const [reqId, req] of pendingRequests.entries()) {
      const idleExpired = now - req.lastContentAt > PENDING_TIMEOUT_MS;
      const hardExpired = now - req.startedAt > PENDING_HARD_TIMEOUT_MS;
      if (!idleExpired && !hardExpired) continue;

      const browser = browsers.get(req.browserSessionId);
      if (browser) {
        sendToBrowser(browser.ws, {
          type: "generate_error",
          requestId: reqId,
          error: hardExpired
            ? "Generation exceeded max duration — stopped"
            : "Generation timed out — tunnel stopped responding",
          code: "TUNNEL_DISCONNECTED",
        });
      }
      pendingRequests.delete(reqId);
      stats.totalRequestsFailed++;
    }
  }, PENDING_SWEEP_INTERVAL_MS);

  // unref — не мешаем процессу завершиться
  state.timer.unref?.();
  g[SWEEPER_KEY] = state;

  if (typeof process !== "undefined") {
    const cleanup = () => {
      if (state.timer) clearInterval(state.timer);
    };
    process.on?.("SIGTERM", cleanup);
    process.on?.("SIGINT", cleanup);
  }
}

ensureSweeper();
