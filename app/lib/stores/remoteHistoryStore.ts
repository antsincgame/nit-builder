/**
 * Remote history store — Appwrite-backed "Мои сайты" for authenticated users.
 *
 * Parallel to historyStore.ts (localStorage, guest-only).
 * HistoryPanel picks which one to use based on useAuth() status.
 *
 * API contract:
 *   GET    /api/sites            → list user's sites (without HTML)
 *   POST   /api/sites            → save a new site
 *   GET    /api/sites/:id        → fetch one site with full HTML
 *   PATCH  /api/sites/:id        → partial update (v2.1)
 *   DELETE /api/sites/:id        → delete a site
 */

import { loadHistory, type HistoryEntry } from "./historyStore";

/** Site summary returned by GET /api/sites (no HTML) */
export type RemoteSiteSummary = {
  id: string;
  createdAt: string; // ISO
  updatedAt: string;
  prompt: string;
  templateId: string;
  templateName: string;
  thumbnail: string | null;
};

export async function listRemoteSites(): Promise<RemoteSiteSummary[]> {
  const res = await fetch("/api/sites", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load sites: ${res.status}`);
  }
  const data = (await res.json()) as { sites: RemoteSiteSummary[] };
  return data.sites;
}

export async function getRemoteSite(id: string): Promise<HistoryEntry | null> {
  const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id: string;
    createdAt: string;
    prompt: string;
    html: string;
    templateId: string;
    templateName: string;
    thumbnail: string | null;
    chatMessages: string | null;
  };
  return {
    id: data.id,
    createdAt: new Date(data.createdAt).getTime(),
    prompt: data.prompt,
    html: data.html,
    templateId: data.templateId,
    templateName: data.templateName,
    thumbnail: data.thumbnail ?? undefined,
    chatMessages: data.chatMessages ?? undefined,
  };
}

export async function saveRemoteSite(params: {
  prompt: string;
  html: string;
  templateId: string;
  templateName: string;
  thumbnail?: string;
  /**
   * JSON-сериализованный chat-history (v2.1 Continue from history).
   * Клиент сам сериализует через JSON.stringify(chatMessages) перед
   * передачей. Сервер не валидирует содержимое, только размер ≤100_000.
   */
  chatMessages?: string;
}): Promise<string | null> {
  const res = await fetch("/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function deleteRemoteSite(id: string): Promise<boolean> {
  const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

/**
 * PATCH /api/sites/:id — partial update сайта.
 *
 * Используется в v2.1 Continue from history: после каждой polish-итерации
 * клиент шлёт (fire-and-forget) обновлённый html + сериализованный
 * chatMessages, чтобы при повторном открытии сайта из истории
 * восстановить весь диалог.
 *
 * Контракт совпадает с серверным PatchSiteSchema (html, chatMessages,
 * thumbnail — все optional). Пустой patch → 200 без действий.
 */
export async function updateRemoteSite(
  id: string,
  patch: {
    html?: string;
    chatMessages?: string;
    thumbnail?: string;
  },
): Promise<boolean> {
  if (Object.keys(patch).length === 0) return true;
  const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });
  return res.ok;
}

// ─── Migration helper ──────────────────────────────────

const MIGRATION_FLAG_KEY = "nit:history-migrated";

/**
 * Migrate localStorage history → Appwrite once per user.
 * Called by HistoryPanel when user logs in for the first time.
 * Sets a per-user flag to prevent re-migration.
 *
 * Флаг per-user (а не глобальный): на общем браузере второй аккаунт раньше НЕ
 * мигрировал свою гостевую историю, потому что глобальный nit:history-migrated
 * уже был выставлен первым аккаунтом.
 */
export async function migrateLocalHistoryIfNeeded(userId: string): Promise<number> {
  if (typeof window === "undefined") return 0;
  const flagKey = `${MIGRATION_FLAG_KEY}:${userId}`;
  if (localStorage.getItem(flagKey)) return 0;

  const local = loadHistory();
  if (local.length === 0) {
    localStorage.setItem(flagKey, "1");
    return 0;
  }

  let migrated = 0;
  for (const entry of local) {
    const id = await saveRemoteSite({
      prompt: entry.prompt,
      html: entry.html,
      templateId: entry.templateId,
      templateName: entry.templateName,
      thumbnail: entry.thumbnail,
    });
    if (id) migrated++;
  }

  localStorage.setItem(flagKey, "1");
  return migrated;
}
