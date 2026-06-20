const DEFAULT_MAX = 20;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_ENTRIES = 50_000;

type Entry = { timestamps: number[] };

// Store + cleanup-таймер на globalThis: при двойной загрузке модуля (tsx-сервер
// + React Router build) иначе было ДВА независимых store — WS-лимитер (tsx) и
// HTTP-роуты (build) считали в разные bucket'ы, вдвое ослабляя лимиты. Тот же
// приём, что у tunnelRegistry/sweeper.
type RateLimitState = { store: Map<string, Entry>; cleanupTimer: ReturnType<typeof setInterval> | null };
const RL_STATE_KEY = "__NIT_RATE_LIMIT_STATE__";

function getState(): RateLimitState {
  const g = globalThis as unknown as Record<string, RateLimitState | undefined>;
  const existing = g[RL_STATE_KEY];
  if (existing) return existing;

  const state: RateLimitState = { store: new Map(), cleanupTimer: null };
  state.cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - DEFAULT_WINDOW_MS * 2;
    for (const [key, entry] of state.store) {
      const latest = entry.timestamps[entry.timestamps.length - 1] ?? 0;
      if (latest < cutoff) state.store.delete(key);
    }
  }, 5 * 60 * 1000);
  state.cleanupTimer.unref?.();

  if (typeof process !== "undefined") {
    const cleanup = () => {
      if (state.cleanupTimer) clearInterval(state.cleanupTimer);
    };
    process.on?.("SIGTERM", cleanup);
    process.on?.("SIGINT", cleanup);
  }

  g[RL_STATE_KEY] = state;
  return state;
}

// ─── Trust-proxy whitelist ──────────────────────────────
//
// Без whitelist любой запрос мог подделать X-Forwarded-For и сбросить
// rate-limit: атакующий шлёт каждый запрос с новым фейковым IP в заголовке,
// и мы кладём каждый в отдельный bucket.
//
// TRUSTED_PROXY_IPS — env var, comma-separated список IP адресов с которых
// мы ДОВЕРЯЕМ прокси-заголовкам (X-Forwarded-For / X-Real-IP / CF-*).
// Обычно это локалхост (nginx на том же сервере) или IPv4/IPv6 reverse proxy.
//
// Если env не задан — сохраняем старое поведение (доверяем всем заголовкам)
// для backward compat. Продакшен должен обязательно задать TRUSTED_PROXY_IPS.

function parseTrustedProxies(): Set<string> | null {
  const raw = process.env.TRUSTED_PROXY_IPS?.trim();
  if (!raw) return null;
  const ips = new Set<string>();
  for (const ip of raw.split(",")) {
    const trimmed = ip.trim();
    if (trimmed) ips.add(trimmed);
  }
  return ips.size > 0 ? ips : null;
}

const TRUSTED_PROXIES = parseTrustedProxies();

function normalizeIp(ip: string): string {
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) → 1.2.3.4 для консистентности с
  // тем что напишет админ в TRUSTED_PROXY_IPS.
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return v4Mapped ? v4Mapped[1]! : ip;
}

function getClientKey(request: Request): string {
  // server.ts кладёт socket remote address в x-request-remote-ip, клиент
  // его подделать не может — мы всегда перезаписываем.
  const remoteRaw = request.headers.get("x-request-remote-ip");
  const remote = remoteRaw ? normalizeIp(remoteRaw.trim()) : null;

  // Если whitelist задан и remote НЕ в whitelist — доверять прокси-заголовкам
  // нельзя, используем сам remote как ключ.
  if (TRUSTED_PROXIES && remote && !TRUSTED_PROXIES.has(remote)) {
    return remote;
  }

  // Либо remote доверенный (nginx), либо whitelist не задан (legacy) —
  // в обоих случаях берём проксированный заголовок как раньше.
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? remote ?? "unknown";
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return remote ?? "unknown";
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
};

/**
 * Sliding-window лимитер по ГОТОВОМУ ключу — без Request. Нужен для контекстов,
 * где Request нет (WebSocket generate keyed by userId).
 */
export function checkRateLimitKey(
  key: string,
  options?: { maxRequests?: number; windowMs?: number },
): RateLimitResult {
  const max = options?.maxRequests ?? DEFAULT_MAX;
  const window = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const { store } = getState();
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    if (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest) store.delete(oldest);
    }
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  const cutoff = now - window;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + window - now),
    };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: max - entry.timestamps.length };
}

export function checkRateLimit(
  request: Request,
  options?: {
    maxRequests?: number;
    windowMs?: number;
    scope?: string;
    /**
     * По умолчанию ключ — `${scope}:${IP клиента}` — стандартный per-IP
     * лимит. Если `false`, IP игнорируется, ключ — только `scope`. Это
     * нужно для per-email/per-user lockout (`scope: "login-email:<email>"`)
     * чтобы атакующий не обходил лимит просто меняя IP.
     */
    useClientKey?: boolean;
  },
): RateLimitResult {
  const scope = options?.scope ?? "default";
  const useClientKey = options?.useClientKey ?? true;
  const key = useClientKey ? `${scope}:${getClientKey(request)}` : scope;
  return checkRateLimitKey(key, {
    maxRequests: options?.maxRequests,
    windowMs: options?.windowMs,
  });
}

/** @internal — сброс in-memory store между тестами. */
export function _resetRateLimitState(): void {
  getState().store.clear();
}
