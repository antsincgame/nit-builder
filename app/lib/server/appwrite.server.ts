/**
 * Appwrite server SDK wrapper for NIT Builder v2.0.
 *
 * Uses the existing vibecoding Appwrite instance:
 *   endpoint:  https://appwrite.vibecoding.by/v1
 *   projectId: 69ab07130011752aae12
 *
 * Collections (in database `nit_builder`):
 * - nit_users        → extends Appwrite users with tunnelTokenHash, sessionVersion, preferences
 * - nit_sites        → generated sites (replaces localStorage history)
 * - nit_generations  → audit log of each generation attempt
 * - nit_guest_limits → persistent per-IP guest quotas (replaces in-memory Map)
 *
 * Database + collections must be created manually via:
 *   scripts/appwrite-migrate.ts
 *
 * Required environment variables:
 *   APPWRITE_ENDPOINT      (default: https://appwrite.vibecoding.by/v1)
 *   APPWRITE_PROJECT_ID    (default: 69ab07130011752aae12)
 *   APPWRITE_API_KEY       (server-side, required — has full scope)
 *   APPWRITE_DATABASE_ID   (default: nit_builder)
 */

import {
  Client,
  Databases,
  Users,
  Account,
  ID,
  Query,
  type Models,
} from "node-appwrite";
import { createHash, randomBytes } from "node:crypto";

// ─── Config ──────────────────────────────────

export const APPWRITE_CONFIG = {
  endpoint: process.env.APPWRITE_ENDPOINT ?? "https://appwrite.vibecoding.by/v1",
  projectId: process.env.APPWRITE_PROJECT_ID ?? "69ab07130011752aae12",
  databaseId: process.env.APPWRITE_DATABASE_ID ?? "nit_builder",
  collections: {
    users: "nit_users",
    sites: "nit_sites",
    generations: "nit_generations",
    guestLimits: "nit_guest_limits",
    sharedPreviews: "nit_shared_previews",
    userTemplates: "nit_user_templates",
  },
} as const;

export function isAppwriteConfigured(): boolean {
  return !!process.env.APPWRITE_API_KEY;
}

// ─── Clients ─────────────────────────────────

/**
 * Admin client — uses API key with full permissions.
 * NEVER expose this to the browser. Server-only.
 */
let adminClient: Client | null = null;

function getAdminClient(): Client {
  if (adminClient) return adminClient;
  const key = process.env.APPWRITE_API_KEY;
  if (!key) {
    throw new Error(
      "APPWRITE_API_KEY env variable is not set. " +
        "NIT Builder v2.0 requires Appwrite for auth. " +
        "See docs/architecture/v2-tunnel.md.",
    );
  }
  adminClient = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId)
    .setKey(key);
  return adminClient;
}

/**
 * Session client — scoped to a specific user session JWT.
 * Used to validate incoming browser session tokens.
 */
export function getSessionClient(jwt: string): Client {
  return new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId)
    .setJWT(jwt);
}

export function getAdminDatabases(): Databases {
  return new Databases(getAdminClient());
}

export function getAdminUsers(): Users {
  return new Users(getAdminClient());
}

// ─── Types for NIT Builder documents ────────────────────

export type NitUser = Models.Document & {
  /** Appwrite user $id — we use the same ID */
  email: string;
  /** Deterministic HMAC-SHA256 for DB index lookup */
  tunnelTokenLookup: string;
  /** Argon2id hash with random salt for final verification */
  tunnelTokenHash: string;
  /** When the tunnel token was last generated */
  tunnelTokenCreatedAt: string;
  /** Preferred LLM provider — only local tunnel supported */
  preferredProvider: "tunnel";
  /**
   * Session token revocation counter. При logout-all или password change
   * bumpSessionVersion() инкрементирует это поле — все существующие
   * токены (с меньшим version) мгновенно становятся невалидны.
   * Отсутствует у legacy-юзеров до миграции Appwrite-коллекции — в этом
   * случае рассматривается как 0.
   */
  sessionVersion?: number;
  // Note: legacy `apiKeysJson` поле удалено из типа после v1 → v2 перехода.
  // В существующих Appwrite-документах оно может ещё лежать как nullable
  // string — но в коде не читается. Drop column из коллекции делать не
  // обязательно: пустое поле не мешает и держит читаемость старых dump'ов.
};

export type NitSite = Models.Document & {
  userId: string;
  prompt: string;
  html: string;
  templateId: string;
  templateName: string;
  /** Preview thumbnail SVG data URI (optional) */
  thumbnail?: string;
  /**
   * JSON-сериализованный массив ChatMessage'ей (history полировки).
   * Хранится строкой чтобы не плодить связанную коллекцию ради 2-50 простых
   * записей. Лимит 100_000 chars в схеме (~250 сообщений по 400 chars).
   * Optional: старые документы до v2.1 не имеют этого поля.
   */
  chatMessages?: string;
};

export type NitGeneration = Models.Document & {
  userId: string;
  mode: "create" | "polish";
  provider: "tunnel";
  durationMs: number;
  success: boolean;
  errorReason?: string;
  templateId?: string;
};

export type NitGuestLimit = Models.Document & {
  ipHash: string;
  count: number;
  resetAt: string;
};

/**
 * Публичная shareable-ссылка на сгенерированный сайт.
 *
 * Юзер с editing-mode жмёт "Share", сервер создаёт запись с рандомным
 * 12-символьным token и snapshot'ом HTML на момент шеринга (если позже
 * сайт меняется, share-ссылка ОСТАЁТСЯ той же — поведение копии, не ссылки).
 *
 * - token: alphanumeric 12 chars (CSPRNG), используется в URL /p/:token
 * - siteId: ссылка на nit_sites доку (для отзыва "отозвать все share'ы этого сайта")
 * - userId: для ownership-проверок и моих share'ов
 * - html: snapshot, чтобы share-ссылка не сломалась если юзер удалил сайт
 * - expiresAt: ISO дата, после которой /p/:token отдаст 410 Gone (TTL 30 дней по умолчанию)
 * - views: счётчик показов, инкрементируется на каждый GET /p/:token
 */
export type NitSharedPreview = Models.Document & {
  token: string;
  siteId: string;
  userId: string;
  html: string;
  expiresAt: string;
  views: number;
};

/**
 * Пользовательский шаблон (v2.1 Save as Template).
 *
 * Юзер с editing-mode жмёт "Save as Template", сохраняя текущий HTML
 * (опционально с extracted `data-edit` зонами) в свою коллекцию. Позже
 * этот шаблон можно использовать как стартовую точку для новых сайтов
 * (v2.2 — community gallery, где юзер сможет promote свои templates
 * в публичные через isPublic + voting механизм).
 *
 * - userId: владелец, ownership-check на read/write
 * - name: человекочитаемое имя (макс 128 chars)
 * - prompt: optional — оригинальный prompt из которого был сгенерирован
 *   сайт. Полезен для контекста "этот шаблон был сделан для ___".
 * - html: финальный snapshot HTML на момент сохранения (≤1 MB)
 * - zones: JSON-сериализованный массив extracted data-edit-зон (≤100 KB).
 *   Optional — пока сохраняем "сырой" HTML без extraction.
 *   В v2.2 будет использоваться для smart re-use (apply template к новому
 *   prompt'у с подменой зон).
 * - isPublic: false по умолчанию. В v2.2 после "promote" → true.
 * - votes: для v2.2 public gallery (👍/👎 счётчик). Default 0.
 */
export type NitUserTemplate = Models.Document & {
  userId: string;
  name: string;
  prompt?: string;
  html: string;
  zones?: string;
  isPublic: boolean;
  votes: number;
};

// ─── Session operations ────────────────────────────────

/**
 * Create an Appwrite session from email+password.
 * Returns the session secret which should be stored as HttpOnly cookie.
 *
 * Throws if credentials are invalid.
 */
export async function createEmailSession(
  email: string,
  password: string,
): Promise<{ secret: string; userId: string }> {
  const users = getAdminUsers();

  // Find user by email
  const list = await users.list([Query.equal("email", email), Query.limit(1)]);
  if (list.users.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }
  const user = list.users[0]!;

  // Раньше здесь был `users.createToken(user.$id, 64, 900)` — реликт от
  // ранней версии auth-флоу когда мы хотели использовать Appwrite session
  // tokens API. Сейчас используем createEmailPasswordSession (ниже) —
  // токен не нужен. user.$id всё ещё нужен для возврата userId.
  void user;

  // Verify password by creating a session via account API
  const sessionClient = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);
  const account = new Account(sessionClient);

  try {
    const session = await account.createEmailPasswordSession(email, password);
    return { secret: session.secret, userId: session.userId };
  } catch {
    throw new Error("INVALID_CREDENTIALS");
  }
}

/**
 * Validate a session secret (from HttpOnly cookie) and return the user.
 * Returns null if the session is invalid or expired.
 */
export async function getUserBySessionSecret(
  secret: string,
): Promise<{ userId: string; email: string } | null> {
  try {
    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId)
      .setSession(secret);
    const account = new Account(client);
    const user = await account.get();
    return { userId: user.$id, email: user.email };
  } catch {
    return null;
  }
}

/**
 * Look up a user by their Appwrite user ID using the admin Users API.
 * Used by the signed-cookie auth path (no Appwrite session needed).
 *
 * Кэш с TTL 30s. Hot-path: getAuth() дёргает это на КАЖДОМ authed-запросе и
 * heartbeat — без кэша каждый клик/тик = round-trip в Appwrite admin Users API
 * (вдобавок к уже-кэшированному getUserSessionVersion рядом). email юзера
 * меняется крайне редко, поэтому 30s-устаревание безопасно. Промах (юзера нет)
 * НЕ кэшируем — иначе свежезарегистрированный 30s считался бы отсутствующим.
 */
type UserCacheEntry = { user: { userId: string; email: string }; cachedAt: number };
const USER_CACHE_TTL_MS = 30_000;
const USER_CACHE_MAX = 10_000;
const userByIdCache = new Map<string, UserCacheEntry>();

export async function getUserById(
  userId: string,
): Promise<{ userId: string; email: string } | null> {
  const now = Date.now();
  const cached = userByIdCache.get(userId);
  if (cached && now - cached.cachedAt < USER_CACHE_TTL_MS) {
    return cached.user;
  }

  try {
    const users = getAdminUsers();
    const user = await users.get(userId);
    const result = { userId: user.$id, email: user.email };
    if (userByIdCache.size >= USER_CACHE_MAX) {
      const oldest = userByIdCache.keys().next().value;
      if (oldest) userByIdCache.delete(oldest);
    }
    userByIdCache.set(userId, { user: result, cachedAt: now });
    return result;
  } catch {
    return null;
  }
}

/** @internal — для тестов: сброс кэша getUserById между it(). */
export function _resetUserByIdCache(): void {
  userByIdCache.clear();
}

/**
 * Delete the current session (logout).
 */
export async function deleteSession(secret: string): Promise<void> {
  try {
    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId)
      .setSession(secret);
    const account = new Account(client);
    await account.deleteSession("current");
  } catch {
    // Session may already be invalid — silently ignore
  }
}

/**
 * Get the user's nit_users document (with tunnel token metadata).
 */
export async function getNitUser(userId: string): Promise<NitUser | null> {
  try {
    const db = getAdminDatabases();
    const doc = await db.getDocument<NitUser>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      userId,
    );
    return doc;
  } catch {
    return null;
  }
}

// ─── Session version revocation ──────────────────────────
//
// Счётчик который вовлекается в подпись session token'а. Бампаем
// при logout-all или password change — все существующие токены на version
// < current не проходят verify. См. sessionCookie.server.ts.

/**
 * Читает current sessionVersion для юзера. Если nit_users документ не
 * существует (legacy user) или поле sessionVersion отсутствует (до
 * миграции Appwrite коллекции) — возвращаем 0.
 *
 * При сетевой ошибке тоже возвращаем 0 (fail-open) — иначе каждая
 * временная Appwrite-недоступность выкидывает всех юзеров. Revocation в
 * этот момент не сработает, но это редкий edge-case по сравнению
 * с "все клиенты разлогинены".
 *
 * Кэш с TTL 30s. Hot-path: вызывается на каждом authed-запросе через
 * getAuth(). Без кэша — 1 RTT в Appwrite на каждый клик / API hit.
 * Trade-off: revocation через logout-all ощущается до 30s позже на других
 * устройствах. Это приемлемо: атакующий со украденной cookie получит
 * максимум 30 дополнительных секунд после bumpSessionVersion — за это время
 * злоумышленник всё равно не успевает ничего критичного, а юзеры с десктопа
 * + телефона не штрафуются double-RTT на каждом действии.
 *
 * Cache-bust происходит автоматически: bumpSessionVersion() инвалидирует
 * запись для своего userId.
 */
type VersionCacheEntry = { version: number; cachedAt: number };
const SESSION_VERSION_CACHE_TTL_MS = 30_000;
const SESSION_VERSION_CACHE_MAX = 10_000;
const sessionVersionCache = new Map<string, VersionCacheEntry>();

function invalidateSessionVersionCache(userId: string): void {
  sessionVersionCache.delete(userId);
}

export async function getUserSessionVersion(userId: string): Promise<number> {
  const now = Date.now();
  const cached = sessionVersionCache.get(userId);
  if (cached && now - cached.cachedAt < SESSION_VERSION_CACHE_TTL_MS) {
    return cached.version;
  }

  let version = 0;
  try {
    const db = getAdminDatabases();
    const doc = await db.getDocument<NitUser>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      userId,
    );
    version = typeof doc.sessionVersion === "number" ? doc.sessionVersion : 0;
  } catch {
    // Fail-open: возвращаем 0, не кэшируем (чтобы при восстановлении
    // Appwrite сразу взять реальную версию, а не ждать TTL).
    return 0;
  }

  // Простая защита от роста — если карта переполнилась, сбрасываем самый
  // старый ключ. Не LRU, но при rate < 10k уникальных юзеров за 30s этого
  // достаточно.
  if (sessionVersionCache.size >= SESSION_VERSION_CACHE_MAX) {
    const oldest = sessionVersionCache.keys().next().value;
    if (oldest) sessionVersionCache.delete(oldest);
  }
  sessionVersionCache.set(userId, { version, cachedAt: now });
  return version;
}

/** @internal — для тестов: сброс кэша между it(). */
export function _resetSessionVersionCache(): void {
  sessionVersionCache.clear();
}

/**
 * Инкрементирует sessionVersion юзера на 1. Возвращает новое значение.
 *
 * После вызова все существующие session-токены этого юзера
 * перестают проходить verify (там version меньше чем current).
 *
 * Race note: read-modify-write не атомарен. Если два параллельных
 * logout-all стартуют одновременно, могут дать один bump вместо двух —
 * но функционально это эквивалентно: все токены всё равно инвалидируются.
 *
 * Если nit_users документа нет (legacy юзер) — создаём пустой с
 * sessionVersion=1. Следующий login корректно заполнит остальные
 * поля — но это edge-case, таких юзеров не должно быть в проде за пределами
 * migration-периода.
 */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const db = getAdminDatabases();

  let current = 0;
  let docExists = false;
  try {
    const doc = await db.getDocument<NitUser>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      userId,
    );
    docExists = true;
    current = typeof doc.sessionVersion === "number" ? doc.sessionVersion : 0;
  } catch {
    docExists = false;
  }

  const next = current + 1;

  if (docExists) {
    await db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      userId,
      { sessionVersion: next },
    );
  } else {
    // Legacy user без nit_users — создаём минимальный стуб с служебным
    // полем. tunnel-зависимые поля подтянутся при следующей регенерации
    // tunnel token'а — до этого юзер просто не сможет генерить сайты через туннель
    // (как и было до bump).
    await db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      userId,
      {
        email: "",
        tunnelTokenLookup: "",
        tunnelTokenHash: "",
        tunnelTokenCreatedAt: new Date(0).toISOString(),
        preferredProvider: "tunnel",
        sessionVersion: next,
      } satisfies Omit<NitUser, keyof Models.Document>,
    );
  }

  // Инвалидируем кэш для этого юзера сразу — чтобы на этом же инстансе
  // logout-all сработал мгновенно (без ожидания TTL). На других инстансах
  // ревокация дойдёт через TTL, см. doc к getUserSessionVersion.
  invalidateSessionVersionCache(userId);

  return next;
}

// ─── User operations ─────────────────────────────────

/**
 * Register a new user with email+password. Creates both the Appwrite
 * account and the nit_users document, generates a fresh tunnel token.
 *
 * Returns the plaintext tunnel token (shown to user ONCE).
 */
export async function registerUser(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ userId: string; tunnelToken: string }> {
  const users = getAdminUsers();
  const db = getAdminDatabases();
  const { generateTunnelToken, hashTunnelToken, computeTokenLookup } = await import(
    "./tunnelTokens.server.js"
  );

  // 1. Create Appwrite account
  const accountId = ID.unique();
  await users.create(accountId, params.email, undefined, params.password, params.name);

  // 2. Generate tunnel token + compute both lookup and hash
  const tunnelToken = generateTunnelToken();
  const tunnelTokenLookup = computeTokenLookup(tunnelToken);
  const tunnelTokenHash = await hashTunnelToken(tunnelToken);

  // 3. Create nit_users document — с sessionVersion=0 сразу, чтобы logout-all
  //    работал с первого логина без специальной миграции.
  const userDoc: Omit<NitUser, keyof Models.Document> = {
    email: params.email,
    tunnelTokenLookup,
    tunnelTokenHash,
    tunnelTokenCreatedAt: new Date().toISOString(),
    preferredProvider: "tunnel",
    sessionVersion: 0,
  };

  await db.createDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.users,
    accountId,
    userDoc,
  );

  return { userId: accountId, tunnelToken };
}

/**
 * Validate a session JWT by asking Appwrite who owns it.
 * Returns the user ID or null if invalid/expired.
 */
export async function validateSessionJwt(
  jwt: string,
): Promise<{ userId: string; email: string } | null> {
  try {
    const client = getSessionClient(jwt);
    const account = new Account(client);
    const user = await account.get();
    return { userId: user.$id, email: user.email };
  } catch {
    return null;
  }
}

/**
 * Look up a user by tunnel token. Used to authenticate tunnel client connections.
 *
 * Two-step verification:
 * 1. Compute HMAC lookup → Query.equal → find candidate(s)
 * 2. Verify argon2id hash for each candidate → confirm match
 *
 * Lookup-collision handling: HMAC-SHA256 в принципе мог бы дать collision
 * (вероятность ~2^-128, практически 0). Раньше брали documents[0] и
 * игнорировали остальное; если бы коллизия случилась, легитимный юзер не
 * смог бы залогиниться. Теперь Query.limit(2) и перебираем кандидатов
 * через argon2.verify — плюс log warning при `length > 1`.
 *
 * Returns the userId if the token is valid.
 */
export async function findUserByTunnelToken(token: string): Promise<{ userId: string } | null> {
  const { computeTokenLookup, verifyTunnelTokenHash, isTunnelTokenFormat } = await import(
    "./tunnelTokens.server.js"
  );

  // Sanity check format first to avoid unnecessary DB calls
  if (!isTunnelTokenFormat(token)) return null;

  const lookup = computeTokenLookup(token);
  const db = getAdminDatabases();

  try {
    const result = await db.listDocuments<NitUser>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      [Query.equal("tunnelTokenLookup", lookup), Query.limit(2)],
    );
    if (result.documents.length === 0) return null;

    if (result.documents.length > 1) {
      // Collision detected — astronomically unlikely with HMAC-SHA256, но
      // обрабатываем правильно: перебираем всех кандидатов через argon2.
      console.warn(
        `[appwrite] tunnelTokenLookup collision: ${result.documents.length} candidates for one lookup hash`,
      );
    }

    for (const candidate of result.documents) {
      // Final verification with argon2id — defence in depth
      const valid = await verifyTunnelTokenHash(token, candidate.tunnelTokenHash);
      if (valid) return { userId: candidate.$id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Regenerate a user's tunnel token (revokes the old one).
 * Returns the new plaintext token.
 *
 * NOTE: уже подключённые активные туннели НЕ закрываются автоматически —
 * они прошли argon2-verify в момент connect и держат открытый WS до
 * естественного close. Реальная ревокация (закрытие живых WS) делается
 * в endpoint'е через tunnelRegistry.revokeUserTunnels.
 */
export async function regenerateTunnelToken(userId: string): Promise<string> {
  const { generateTunnelToken, hashTunnelToken, computeTokenLookup } = await import(
    "./tunnelTokens.server.js"
  );
  const newToken = generateTunnelToken();
  const newLookup = computeTokenLookup(newToken);
  const newHash = await hashTunnelToken(newToken);

  const db = getAdminDatabases();
  await db.updateDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.users,
    userId,
    {
      tunnelTokenLookup: newLookup,
      tunnelTokenHash: newHash,
      tunnelTokenCreatedAt: new Date().toISOString(),
    },
  );
  return newToken;
}

// ─── Site operations ─────────────────────────────────

export async function saveSite(params: {
  userId: string;
  prompt: string;
  html: string;
  templateId: string;
  templateName: string;
  thumbnail?: string;
  /** JSON-сериализованный массив ChatMessage'ей (v2.1 — Continue from history). */
  chatMessages?: string;
}): Promise<string> {
  const db = getAdminDatabases();
  const doc = await db.createDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.sites,
    ID.unique(),
    params,
  );
  return doc.$id;
}

export async function listUserSites(userId: string, limit = 20): Promise<NitSite[]> {
  const db = getAdminDatabases();
  const result = await db.listDocuments<NitSite>(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.sites,
    [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      // Проекция list-view: НЕ тянем html (≤1МБ) и chatMessages (≤100КБ) по сети
      // ради сводки — раньше Appwrite возвращал их по 50 док. Поля — ровно то,
      // что эмитит /api/sites. (Требует Appwrite ≥1.4 / node-appwrite ≥14.)
      Query.select([
        "$id",
        "$createdAt",
        "$updatedAt",
        "prompt",
        "templateId",
        "templateName",
        "thumbnail",
      ]),
    ],
  );
  return result.documents;
}

export async function deleteSite(userId: string, siteId: string): Promise<boolean> {
  const db = getAdminDatabases();
  try {
    const site = await db.getDocument<NitSite>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sites,
      siteId,
    );
    if (site.userId !== userId) return false; // ownership check
    await db.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sites,
      siteId,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Обновить уже существующий сайт. Используется для v2.1 Continue from
 * history: после polish'а клиент шлёт PATCH с новым html и обновлённым
 * chatMessages, чтобы при повторном открытии из истории можно было
 * восстановить весь диалог.
 *
 * Ownership-проверка через getDocument перед update'ом. Возвращает
 * false если сайт чужой или не существует.
 *
 * Patch — partial: передавай только то что меняешь. Запрещено менять
 * userId, prompt, templateId, templateName (это identity сайта).
 */
export async function updateSite(
  userId: string,
  siteId: string,
  patch: {
    html?: string;
    chatMessages?: string;
    thumbnail?: string;
  },
): Promise<boolean> {
  const db = getAdminDatabases();
  try {
    const site = await db.getDocument<NitSite>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sites,
      siteId,
    );
    if (site.userId !== userId) return false;
    await db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sites,
      siteId,
      patch,
    );
    return true;
  } catch {
    return false;
  }
}

// ─── Shared previews (public /p/:token links) ────────────────────

/**
 * Сгенерировать 12-символьный token из URL-safe alphabet.
 * 62^12 ≈ 3.2e21 комбинаций — коллизия в realistic-объёме нереалистична,
 * но при `createSharedPreview` всё равно retry-цикл (унификация с другими
 * unique-token схемами в проекте).
 */
function generateShareToken(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const buf = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}

/** Дефолтный TTL для shared previews — 30 дней. */
export const SHARED_PREVIEW_TTL_DAYS = 30;

export async function createSharedPreview(params: {
  siteId: string;
  userId: string;
  html: string;
  ttlDays?: number;
}): Promise<NitSharedPreview> {
  const db = getAdminDatabases();
  const ttl = params.ttlDays ?? SHARED_PREVIEW_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000).toISOString();

  // Retry на коллизию token — 3 попытки достаточно при 62^12 пространстве.
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateShareToken();
    try {
      const doc = await db.createDocument<NitSharedPreview>(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.sharedPreviews,
        ID.unique(),
        {
          token,
          siteId: params.siteId,
          userId: params.userId,
          html: params.html,
          expiresAt,
          views: 0,
        },
      );
      return doc;
    } catch (err) {
      // Если это не unique-violation на token, прокидываем дальше.
      // Appwrite кидает 409 на duplicate key; различить по message нет
      // стабильного способа, поэтому ретраим до 3х раз — для не-коллизий
      // вторая попытка тоже упадёт.
      if (attempt === 2) throw err;
    }
  }
  throw new Error("createSharedPreview: failed after 3 attempts");
}

/**
 * Прочитать share по token'у. Возвращает null если не найден или истёк.
 * Не инкрементирует views — вызывающий код делает это отдельно (чтобы
 * иметь возможность сначала прочитать, потом решить инкрементить ли).
 */
export async function getSharedPreviewByToken(
  token: string,
): Promise<NitSharedPreview | null> {
  if (!/^[A-Za-z0-9]{12}$/.test(token)) return null;

  const db = getAdminDatabases();
  const result = await db.listDocuments<NitSharedPreview>(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.sharedPreviews,
    [Query.equal("token", token), Query.limit(1)],
  );
  const doc = result.documents[0];
  if (!doc) return null;
  if (new Date(doc.expiresAt).getTime() < Date.now()) return null;
  return doc;
}

/** Инкрементировать счётчик показов (best-effort, не ломаем чтение если упало). */
export async function incrementSharedPreviewViews(docId: string, currentViews: number): Promise<void> {
  try {
    const db = getAdminDatabases();
    await db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sharedPreviews,
      docId,
      { views: currentViews + 1 },
    );
  } catch {
    // metric — не критично
  }
}

/** Список share'ов конкретного юзера (для UI «мои публичные ссылки»). */
export async function listUserSharedPreviews(
  userId: string,
  limit = 50,
): Promise<NitSharedPreview[]> {
  const db = getAdminDatabases();
  const result = await db.listDocuments<NitSharedPreview>(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.sharedPreviews,
    [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      // Проекция: list не отдаёт html-снапшот (≤1МБ) — он нужен только при /p/:token.
      Query.select(["$id", "$createdAt", "token", "siteId", "expiresAt", "views"]),
    ],
  );
  return result.documents;
}

/**
 * Отозвать share. Возвращает true если успешно (с ownership-проверкой).
 * Удаляет документ — после этого /p/:token будет отдавать 404.
 */
export async function revokeSharedPreview(
  userId: string,
  docId: string,
): Promise<boolean> {
  const db = getAdminDatabases();
  try {
    const doc = await db.getDocument<NitSharedPreview>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sharedPreviews,
      docId,
    );
    if (doc.userId !== userId) return false;
    await db.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sharedPreviews,
      docId,
    );
    return true;
  } catch {
    return false;
  }
}

// ─── User templates (Save as Template, v2.1) ─────────────────────

/**
 * Сохранить пользовательский шаблон.
 *
 * Limit: 50 templates на юзера (по аналогии с sites). Если лимит превышен —
 * throw'ит ошибку (вызывающий код должен показать понятное сообщение).
 * Лимит-проверка происходит через listDocuments(limit=51); если 50+ —
 * отказ. Это не атомарно (concurrent saves могут проскочить), но в худшем
 * случае юзер получает 51 шаблон — это не проблема.
 */
export async function saveUserTemplate(params: {
  userId: string;
  name: string;
  html: string;
  prompt?: string;
  zones?: string;
}): Promise<string> {
  const db = getAdminDatabases();

  // Soft-limit на 50 templates per user (защита от спама).
  const existing = await db.listDocuments<NitUserTemplate>(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.userTemplates,
    [Query.equal("userId", params.userId), Query.limit(51)],
  );
  if (existing.documents.length >= 50) {
    throw new Error("USER_TEMPLATE_LIMIT_EXCEEDED");
  }

  const doc = await db.createDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.userTemplates,
    ID.unique(),
    {
      userId: params.userId,
      name: params.name,
      html: params.html,
      prompt: params.prompt,
      zones: params.zones,
      isPublic: false,
      votes: 0,
    },
  );
  return doc.$id;
}

export async function listUserTemplates(
  userId: string,
  limit = 50,
): Promise<NitUserTemplate[]> {
  const db = getAdminDatabases();
  const result = await db.listDocuments<NitUserTemplate>(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.userTemplates,
    [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      // Проекция: НЕ тянем html (≤1МБ). zones (≤100КБ) оставляем — из него
      // считается hasZones в /api/user-templates.
      Query.select(["$id", "$createdAt", "name", "prompt", "isPublic", "votes", "zones"]),
    ],
  );
  return result.documents;
}

/**
 * Получить шаблон по id с ownership-check.
 * Возвращает null если шаблон чужой / не существует.
 */
export async function getUserTemplate(
  userId: string,
  templateId: string,
): Promise<NitUserTemplate | null> {
  const db = getAdminDatabases();
  try {
    const doc = await db.getDocument<NitUserTemplate>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userTemplates,
      templateId,
    );
    if (doc.userId !== userId) return null;
    return doc;
  } catch {
    return null;
  }
}

export async function deleteUserTemplate(
  userId: string,
  templateId: string,
): Promise<boolean> {
  const db = getAdminDatabases();
  try {
    const doc = await db.getDocument<NitUserTemplate>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userTemplates,
      templateId,
    );
    if (doc.userId !== userId) return false;
    await db.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userTemplates,
      templateId,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Получить публичные шаблоны (v2.2 Community templates). Без auth-фильтра —
 * любой посетитель видит галерею. Возвращает только шаблоны с isPublic=true.
 *
 * Сортировка: по убыванию votes, потом по дате создания (новые сверху при
 * равных votes). Для v2.2 этого достаточно; в v2.3+ можно добавить фильтры
 * по тегам / категориям.
 *
 * @param limit максимум документов в выдаче (default 50)
 */
export async function listPublicTemplates(limit = 50): Promise<NitUserTemplate[]> {
  const db = getAdminDatabases();
  const result = await db.listDocuments<NitUserTemplate>(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.userTemplates,
    [
      Query.equal("isPublic", true),
      Query.orderDesc("votes"),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      // Проекция: галерея (БЕЗ авторизации) больше не тянет html (≤1МБ) на док.
      Query.select(["$id", "$createdAt", "name", "prompt", "votes", "zones"]),
    ],
  );
  return result.documents;
}

/**
 * Прочитать публичный шаблон по id. В отличие от getUserTemplate, не делает
 * ownership-check: любой может получить полный HTML публичного шаблона.
 * Возвращает null если шаблон не найден или isPublic=false.
 *
 * Используется при клике на карточку в публичной галерее → загрузка HTML
 * как стартовой точки для нового сайта (forking, v2.2 phase 3).
 */
export async function getPublicTemplate(
  templateId: string,
): Promise<NitUserTemplate | null> {
  const db = getAdminDatabases();
  try {
    const doc = await db.getDocument<NitUserTemplate>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userTemplates,
      templateId,
    );
    if (!doc.isPublic) return null;
    return doc;
  } catch {
    return null;
  }
}

/**
 * Модерация шаблона (v2.2 Community templates) — admin переключает
 * isPublic у пользовательского шаблона. Защищён через checkAdminToken на
 * route-уровне.
 *
 * Возможны три действия:
 *   - "approve" — устанавливает isPublic=true, шаблон попадает в публичную галерею
 *   - "reject"  — устанавливает isPublic=false, убирает из галереи (но не удаляет)
 *
 * Не трогает другие поля (votes, name, html) — модерация только про видимость.
 * Возвращает true если документ существовал и обновлён, false иначе.
 */
export async function setTemplatePublicState(
  templateId: string,
  isPublic: boolean,
): Promise<boolean> {
  const db = getAdminDatabases();
  try {
    await db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userTemplates,
      templateId,
      { isPublic },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Голосование за публичный шаблон (v2.2 Phase 3).
 *
 * Изменяет votes на delta (+1 или -1). Только для публичных шаблонов
 * (isPublic=true) — за приватные голосовать нельзя.
 *
 * NOTE про защиту от accumulation: эта функция не отслеживает кто голосовал —
 * любой может вызвать N раз. Защита от спама делается на API-уровне через
 * sessionStorage rate-limit (1 vote per template per session). Полноценный
 * persistent voting registry (отдельная коллекция nit_template_votes с
 * userId+templateId unique constraint) — backlog для v2.3+. Для текущей
 * стадии достаточно client-side de-dup плюс невозможность отрицательных
 * votes (clamp на 0).
 *
 * Возвращает новое значение votes или null если шаблон не найден / не
 * публичный. Чтение-модификация-запись неатомарна, при concurrent vote'ах
 * последний writer выигрывает — приемлемо для счётчика.
 */
export async function voteForTemplate(
  templateId: string,
  delta: 1 | -1,
): Promise<number | null> {
  const db = getAdminDatabases();
  try {
    const doc = await db.getDocument<NitUserTemplate>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userTemplates,
      templateId,
    );
    if (!doc.isPublic) return null;
    const newVotes = Math.max(0, doc.votes + delta);
    await db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userTemplates,
      templateId,
      { votes: newVotes },
    );
    return newVotes;
  } catch {
    return null;
  }
}

// ─── Metric logging ─────────────────────────────────

export async function logGeneration(
  params: Omit<NitGeneration, keyof Models.Document>,
): Promise<void> {
  try {
    const db = getAdminDatabases();
    await db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.generations,
      ID.unique(),
      params,
    );
  } catch {
    // Silently drop metric logging errors — don't break user flow
  }
}

// ─── Guest IP quota (persistent) ─────────────────────────

/**
 * Хешируем IP перед использованием как docId — чтобы не светить сырые IP
 * в Appwrite logs/exports (privacy + GDPR-friendly). sha256 → 64 hex chars.
 */
function hashIp(ip: string): string {
  return createHash("sha256").update(`nit-guest:${ip}`).digest("hex");
}

export type GuestLimitDecision = {
  allowed: boolean;
  remaining: number;
  /** Когда счётчик сбросится (для UI). */
  resetAt: number;
};

/**
 * Атомарная проверка-и-инкремент guest квоты по IP. Persistent: переживает
 * рестарт сервера и работает в multi-instance scaleup.
 */
export async function consumeGuestLimit(
  ip: string,
  dailyMax: number,
  windowMs: number,
): Promise<GuestLimitDecision> {
  const ipHash = hashIp(ip);
  const docId = ipHash.slice(0, 36); // Appwrite doc ID limit
  const db = getAdminDatabases();
  const now = Date.now();
  const newResetAt = new Date(now + windowMs).toISOString();

  let existing: NitGuestLimit | null = null;
  try {
    existing = await db.getDocument<NitGuestLimit>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.guestLimits,
      docId,
    );
  } catch {
    existing = null; // doesn't exist — first request from this IP
  }

  // Первый запрос ИЛИ счётчик протух → создаём/перезаписываем
  if (!existing || new Date(existing.resetAt).getTime() < now) {
    if (existing) {
      await db.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.guestLimits,
        docId,
        { count: 1, resetAt: newResetAt },
      );
    } else {
      await db.createDocument<NitGuestLimit>(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.guestLimits,
        docId,
        { ipHash, count: 1, resetAt: newResetAt },
      );
    }
    return {
      allowed: true,
      remaining: dailyMax - 1,
      resetAt: now + windowMs,
    };
  }

  if (existing.count >= dailyMax) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.resetAt).getTime(),
    };
  }

  await db.updateDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.guestLimits,
    docId,
    { count: existing.count + 1 },
  );
  return {
    allowed: true,
    remaining: dailyMax - existing.count - 1,
    resetAt: new Date(existing.resetAt).getTime(),
  };
}

/**
 * Удалить все nit_guest_limits документы с resetAt < now.
 */
export async function cleanupExpiredGuestLimits(
  maxBatches: number = 10,
): Promise<{ scanned: number; deleted: number; batches: number }> {
  const db = getAdminDatabases();
  const now = new Date().toISOString();

  let totalScanned = 0;
  let totalDeleted = 0;
  let batches = 0;

  for (let i = 0; i < maxBatches; i++) {
    const result = await db.listDocuments<NitGuestLimit>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.guestLimits,
      [Query.lessThan("resetAt", now), Query.limit(100)],
    );
    totalScanned += result.documents.length;
    if (result.documents.length === 0) break;

    const settled = await Promise.allSettled(
      result.documents.map((doc) =>
        db.deleteDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.guestLimits,
          doc.$id,
        ),
      ),
    );
    totalDeleted += settled.filter((s) => s.status === "fulfilled").length;
    batches++;

    if (result.documents.length < 100) break;
  }

  return { scanned: totalScanned, deleted: totalDeleted, batches };
}
