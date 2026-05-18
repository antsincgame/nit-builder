/**
 * Client wrapper для /api/user-templates (v2.1 Save as Template).
 *
 * Параллельный к remoteHistoryStore.ts, но для шаблонов:
 *   GET    /api/user-templates       — список (без html)
 *   POST   /api/user-templates       — сохранить новый
 *   GET    /api/user-templates/:id   — один с full html + zones
 *   DELETE /api/user-templates/:id   — удалить (ownership)
 *
 * Использование: SaveAsTemplateDialog → saveMyTemplate(); SettingsDrawer
 * или dedicated "Мои шаблоны" panel → listMyTemplates() + getMyTemplate().
 */

/** Краткое описание шаблона (без html — отдельный запрос на full content). */
export type UserTemplateSummary = {
  id: string;
  name: string;
  prompt: string | null;
  createdAt: string; // ISO
  isPublic: boolean;
  votes: number;
  /** true если у шаблона есть extracted zones (для v2.2 smart re-use). */
  hasZones: boolean;
};

/** Полный шаблон с html и (опционально) zones. */
export type UserTemplateFull = {
  id: string;
  name: string;
  prompt: string | null;
  html: string;
  /** JSON-string (parsed JSON: ZoneEntry[]) или null. */
  zones: string | null;
  isPublic: boolean;
  votes: number;
  createdAt: string;
};

/** Параметры сохранения нового шаблона (см. POST /api/user-templates Zod schema). */
export type SaveTemplateParams = {
  name: string;
  html: string;
  prompt?: string;
  zones?: string;
};

export type SaveTemplateResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code?: "LIMIT_EXCEEDED" | "VALIDATION" };

export async function listMyTemplates(): Promise<UserTemplateSummary[]> {
  const res = await fetch("/api/user-templates", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load templates: ${res.status}`);
  }
  const data = (await res.json()) as { templates: UserTemplateSummary[] };
  return data.templates;
}

export async function getMyTemplate(
  id: string,
): Promise<UserTemplateFull | null> {
  const res = await fetch(
    `/api/user-templates/${encodeURIComponent(id)}`,
    { credentials: "include" },
  );
  if (!res.ok) return null;
  return (await res.json()) as UserTemplateFull;
}

export async function saveMyTemplate(
  params: SaveTemplateParams,
): Promise<SaveTemplateResult> {
  const res = await fetch("/api/user-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (res.ok) {
    const data = (await res.json()) as { id: string };
    return { ok: true, id: data.id };
  }

  // Парсим ошибку для UI (особенно лимит-кейс — там толковый message).
  let errMsg = `HTTP ${res.status}`;
  let code: "LIMIT_EXCEEDED" | "VALIDATION" | undefined;
  try {
    const body = (await res.json()) as {
      error?: string;
      code?: string;
    };
    if (body.error) errMsg = body.error;
    if (body.code === "LIMIT_EXCEEDED") code = "LIMIT_EXCEEDED";
    else if (res.status === 400) code = "VALIDATION";
  } catch {
    // not-JSON body — оставляем дефолтный errMsg
  }
  return { ok: false, error: errMsg, code };
}

export async function deleteMyTemplate(id: string): Promise<boolean> {
  const res = await fetch(
    `/api/user-templates/${encodeURIComponent(id)}`,
    { method: "DELETE", credentials: "include" },
  );
  return res.ok;
}

// ─── Public templates (v2.2 Community gallery) ────────────────────

/**
 * Краткое описание публичного шаблона (для /templates галереи).
 *
 * Отличия от UserTemplateSummary:
 *   - нет isPublic (всегда true — public list)
 *   - нет userId (анонимизация чужих авторов, как у share-ссылок)
 */
export type PublicTemplateSummary = {
  id: string;
  name: string;
  prompt: string | null;
  createdAt: string;
  votes: number;
  hasZones: boolean;
};

export type PublicTemplateFull = {
  id: string;
  name: string;
  prompt: string | null;
  html: string;
  zones: string | null;
  votes: number;
  createdAt: string;
};

/**
 * Список публичных шаблонов из /api/public-templates. Без auth (open
 * endpoint). Бросает при сетевой/HTTP ошибке — caller должен показать
 * понятное сообщение.
 */
export async function listPublicTemplates(): Promise<PublicTemplateSummary[]> {
  const res = await fetch("/api/public-templates");
  if (!res.ok) {
    throw new Error(`Failed to load public templates: ${res.status}`);
  }
  const data = (await res.json()) as { templates: PublicTemplateSummary[] };
  return data.templates;
}

/**
 * Загрузить full template для использования как стартовая точка.
 * Возвращает null если шаблон удалён или больше не публичный.
 */
export async function getPublicTemplate(
  id: string,
): Promise<PublicTemplateFull | null> {
  const res = await fetch(`/api/public-templates/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return (await res.json()) as PublicTemplateFull;
}
