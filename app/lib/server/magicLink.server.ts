/**
 * Magic-link создание + верификация.
 *
 * Хранение: новая Appwrite коллекция `nit_magic_links` со схемой:
 *   - email: string (lowercase)
 *   - tokenHash: string (sha256 hex от plaintext-токена, 64 chars)
 *   - expiresAt: datetime (15 минут от createdAt)
 *   - consumedAt: datetime? (null = не использован; non-null = уже консумирован)
 *
 * Plaintext-токен НЕ хранится в БД — только sha256-хеш. Юзер получает
 * plaintext в письме, мы хешируем при проверке и сравниваем. Это защищает
 * от утечки токенов через БД-дамп (атакующий не сможет залогиниться).
 *
 * Workflow:
 *   1. createMagicLink(email) → создаёт запись + plaintext token → отправить
 *      по email. Перед созданием инвалидирует все pred. неконсумированные
 *      ссылки для этого email (1 активный токен = 1 email одновременно).
 *   2. verifyMagicLink(token) → ищет по tokenHash, проверяет expiresAt и
 *      consumedAt, помечает consumedAt = now. Возвращает email юзера.
 *   3. Caller сам создаёт/находит юзера по email и выписывает session cookie.
 */

import { ID, Query, type Models } from "node-appwrite";
import { createHash, randomBytes } from "node:crypto";
import {
  APPWRITE_CONFIG,
  getAdminDatabases,
} from "./appwrite.server";

// ── Config ────────────────────────────────────────────

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 минут
const TOKEN_BYTES = 32; // 32 bytes = 256 bits энтропии → 64 hex chars

/**
 * Имя коллекции в Appwrite. Должно совпадать с migration script.
 * Не добавляю в APPWRITE_CONFIG.collections чтобы не трогать основной файл.
 */
const MAGIC_LINKS_COLLECTION = "nit_magic_links";

// ── Types ────────────────────────────────────────────

type NitMagicLink = Models.Document & {
  email: string;
  tokenHash: string;
  expiresAt: string;
  consumedAt: string | null;
};

// ── Token utilities ─────────────────────────────────────

/**
 * Генерация криптостойкого токена. 256 bits энтропии — гарантирует
 * отсутствие коллизий и невозможность brute-force.
 */
function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * SHA-256 хеш для хранения в БД. Не используем bcrypt/argon2 — токен сам
 * по себе достаточно длинный (64 hex chars), brute-force нереалистичен,
 * нужна быстрая проверка по индексу.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Public API ─────────────────────────────────────────

/**
 * Создать magic-link для email. Возвращает plaintext token который нужно
 * вложить в URL и отправить юзеру по email.
 *
 * Пред-условие: предыдущие неконсумированные ссылки для этого email
 * инвалидируются (помечаются consumedAt=now). Это гарантирует что
 * одновременно активна максимум одна ссылка — если юзер нажал «отправить»
 * дважды, рабочая будет только последняя.
 *
 * Email нормализуется в lowercase для consistency.
 */
export async function createMagicLink(email: string): Promise<string> {
  const db = getAdminDatabases();
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  // 1. Инвалидируем все предыдущие активные ссылки для этого email
  try {
    const existing = await db.listDocuments<NitMagicLink>(
      APPWRITE_CONFIG.databaseId,
      MAGIC_LINKS_COLLECTION,
      [
        Query.equal("email", normalizedEmail),
        Query.isNull("consumedAt"),
        Query.limit(10),
      ],
    );
    await Promise.allSettled(
      existing.documents.map((doc) =>
        db.updateDocument(
          APPWRITE_CONFIG.databaseId,
          MAGIC_LINKS_COLLECTION,
          doc.$id,
          { consumedAt: now.toISOString() },
        ),
      ),
    );
  } catch (err) {
    // Не критично — продолжаем. Хуже всего что у юзера будет несколько
    // активных ссылок одновременно, но каждая всё равно одноразовая.
    console.warn("[magic-link] failed to invalidate previous links:", err);
  }

  // 2. Создаём новый токен
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_MS).toISOString();

  await db.createDocument<NitMagicLink>(
    APPWRITE_CONFIG.databaseId,
    MAGIC_LINKS_COLLECTION,
    ID.unique(),
    {
      email: normalizedEmail,
      tokenHash,
      expiresAt,
      consumedAt: null,
    },
  );

  return token;
}

/**
 * Проверить magic-link токен. Возвращает email юзера если токен валидный
 * (формат, существует в БД, не истёк, не использован), null иначе.
 *
 * При успехе помечает токен consumedAt=now — повторно использовать нельзя.
 * Атомарность: read-modify-write неатомарен, при concurrent verify одного
 * токена возможен race (оба запроса увидят consumedAt=null, оба зайдут).
 * Это пренебрежимый риск для magic-link — токен одноразовый по дизайну,
 * но даже если race случится, оба login'а будут для одного юзера.
 */
export async function verifyMagicLink(
  token: string,
): Promise<{ email: string } | null> {
  // Базовая sanity-проверка формата — 64 hex chars
  if (!/^[a-f0-9]{64}$/.test(token)) return null;

  const db = getAdminDatabases();
  const tokenHash = hashToken(token);

  try {
    const result = await db.listDocuments<NitMagicLink>(
      APPWRITE_CONFIG.databaseId,
      MAGIC_LINKS_COLLECTION,
      [Query.equal("tokenHash", tokenHash), Query.limit(1)],
    );
    const doc = result.documents[0];
    if (!doc) return null;

    if (doc.consumedAt) {
      console.warn(`[magic-link] token already consumed: ${doc.$id}`);
      return null;
    }

    const now = Date.now();
    if (new Date(doc.expiresAt).getTime() < now) {
      console.warn(`[magic-link] token expired: ${doc.$id}`);
      return null;
    }

    // Помечаем как consumed
    await db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      MAGIC_LINKS_COLLECTION,
      doc.$id,
      { consumedAt: new Date(now).toISOString() },
    );

    return { email: doc.email };
  } catch (err) {
    console.error("[magic-link] verify failed:", err);
    return null;
  }
}

/**
 * Очистка устаревших magic-links (cron job).
 *
 * Удаляет все записи где expiresAt < now (просроченные) или consumedAt
 * старше 7 дней (использованные но висят в БД). Защита от роста БД.
 *
 * Рекомендуется cron 1 раз в сутки.
 */
export async function cleanupExpiredMagicLinks(): Promise<{
  scanned: number;
  deleted: number;
}> {
  const db = getAdminDatabases();
  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let scanned = 0;
  let deleted = 0;

  // Истекшие
  try {
    const expired = await db.listDocuments<NitMagicLink>(
      APPWRITE_CONFIG.databaseId,
      MAGIC_LINKS_COLLECTION,
      [Query.lessThan("expiresAt", now), Query.limit(100)],
    );
    scanned += expired.documents.length;
    const settled = await Promise.allSettled(
      expired.documents.map((doc) =>
        db.deleteDocument(
          APPWRITE_CONFIG.databaseId,
          MAGIC_LINKS_COLLECTION,
          doc.$id,
        ),
      ),
    );
    deleted += settled.filter((s) => s.status === "fulfilled").length;
  } catch (err) {
    console.warn("[magic-link] cleanup expired failed:", err);
  }

  // Использованные старше 7 дней
  try {
    const consumed = await db.listDocuments<NitMagicLink>(
      APPWRITE_CONFIG.databaseId,
      MAGIC_LINKS_COLLECTION,
      [Query.lessThan("consumedAt", sevenDaysAgo), Query.limit(100)],
    );
    scanned += consumed.documents.length;
    const settled = await Promise.allSettled(
      consumed.documents.map((doc) =>
        db.deleteDocument(
          APPWRITE_CONFIG.databaseId,
          MAGIC_LINKS_COLLECTION,
          doc.$id,
        ),
      ),
    );
    deleted += settled.filter((s) => s.status === "fulfilled").length;
  } catch (err) {
    console.warn("[magic-link] cleanup consumed failed:", err);
  }

  return { scanned, deleted };
}
