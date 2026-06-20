/**
 * In-memory session memory. Хранит текущий HTML и историю шагов в рамках сессии.
 * При рестарте сервера сессии сбрасываются — для HTML-first это ок,
 * потому что проекты сохраняются в Appwrite отдельно по projectId.
 */

import { createHash } from "node:crypto";
import type { Plan } from "~/lib/utils/planSchema";

/** Контекст для continuation: когда модель упёрлась в лимит токенов. */
export type TruncationContext = {
  mode: "create" | "polish";
  userMessage: string;
  plan?: Plan;
  templateId?: string;
  /** Сырой HTML который успели сгенерировать до обрыва (без stripCodeFences/repair). */
  partialHtml: string;
  /** Сколько раз уже пытались продолжить. Лимит: MAX_CONTINUATION_ATTEMPTS. */
  attempt: number;
  /** Провайдер который использовался для оборванной генерации (для консистентности при continue). */
  providerId: string;
};

export type SessionMemory = {
  sessionId: string;
  projectId: string;
  currentHtml: string;
  planJson: unknown;
  templateId: string;
  createdAt: number;
  updatedAt: number;
  /** Если установлен — есть оборванная генерация, доступен mode="continue". */
  truncation?: TruncationContext;
};

const sessions = new Map<string, SessionMemory>();
const MAX_SESSIONS = 10_000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Префикс ключа по владельцу. Раньше ключом был голый client-supplied
 * sessionId — юзер, подсунув чужой/угаданный sessionId, читал-писал чужой
 * currentHtml/planJson/truncation. Теперь ключ = hash(ownerKey):sessionId, и у
 * разных владельцев один и тот же sessionId не пересекается. Хэшируем, чтобы не
 * светить userId/IP в memory.sessionId (он уходит в feedbackStore и логи).
 */
function ownerScope(ownerKey: string): string {
  return createHash("sha256").update(ownerKey).digest("hex").slice(0, 12);
}

export function getOrCreateSession(
  sessionId: string,
  projectId: string,
  ownerKey: string = "local",
): SessionMemory {
  const key = `${ownerScope(ownerKey)}:${sessionId}`;
  const existing = sessions.get(key);
  if (existing) {
    existing.updatedAt = Date.now();
    return existing;
  }

  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest) sessions.delete(oldest);
  }

  // memory.sessionId = композитный ключ: все хелперы (updateSessionHtml и т.п.)
  // ищут по нему. Клиенту наружу уходит СЫРОЙ sessionId (route.session_init),
  // поэтому эхо-контракт не ломается, а на следующем запросе ключ
  // пересобирается из (ownerKey, сырой sessionId).
  const fresh: SessionMemory = {
    sessionId: key,
    projectId,
    currentHtml: "",
    planJson: null,
    templateId: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(key, fresh);
  return fresh;
}

export function getSession(sessionId: string): SessionMemory | undefined {
  return sessions.get(sessionId);
}

export function updateSessionHtml(sessionId: string, html: string): void {
  const s = sessions.get(sessionId);
  if (s) {
    s.currentHtml = html;
    s.updatedAt = Date.now();
  }
}

export function setTruncation(sessionId: string, truncation: TruncationContext): void {
  const s = sessions.get(sessionId);
  if (s) {
    s.truncation = truncation;
    s.updatedAt = Date.now();
  }
}

export function clearTruncation(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (s) {
    s.truncation = undefined;
    s.updatedAt = Date.now();
  }
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > SESSION_TTL_MS) sessions.delete(id);
  }
}, 60 * 60 * 1000);
cleanupTimer.unref?.();

if (typeof process !== "undefined") {
  process.on?.("SIGTERM", () => clearInterval(cleanupTimer));
  process.on?.("SIGINT", () => clearInterval(cleanupTimer));
}
