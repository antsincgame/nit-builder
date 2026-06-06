/**
 * Публичный идентификатор юзера для персонального URL: /app/u/:publicId.
 *
 * URL — витрина, не пропуск: авторизация всегда по session cookie,
 * publicId только сверяется с юзером из куки. Поэтому обратный lookup
 * (publicId → userId) не нужен, индексы не нужны, хранение — в Appwrite
 * user prefs (никакой миграции схемы nit_users).
 *
 * Формат: 10 символов base62 (CSPRNG). Не порядковый номер — не палит
 * число юзеров и не перебирается. Не внутренний Appwrite-ID — его в URL
 * не светим. Неизменяем после выдачи — можно закладывать.
 */
import { randomBytes } from "node:crypto";
import { getAdminUsers } from "./appwrite.server";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const LENGTH = 10;

export function generatePublicId(): string {
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

// Кэш userId → publicId. publicId неизменяем после выдачи — TTL не нужен,
// только предохранитель от бесконечного роста памяти.
const cache = new Map<string, string>();
const CACHE_MAX = 10_000;

/**
 * Возвращает publicId юзера; при первом обращении генерирует и пишет
 * в Appwrite user prefs (lazy backfill — никаких скриптов миграции по
 * существующим юзерам).
 *
 * null при сетевой ошибке — caller решает сам (для редиректов правильно
 * оставить юзера на /app, а не ронять запрос).
 */
export async function ensurePublicId(userId: string): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached) return cached;

  try {
    const users = getAdminUsers();
    const user = await users.get(userId);
    const prefs = (user.prefs ?? {}) as Record<string, unknown>;
    let pid =
      typeof prefs.publicId === "string" && prefs.publicId.length > 0
        ? prefs.publicId
        : null;

    if (!pid) {
      pid = generatePublicId();
      await users.updatePrefs(userId, { ...prefs, publicId: pid });
    }

    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(userId, pid);
    return pid;
  } catch (err) {
    console.error("[publicId] ensurePublicId failed:", err);
    return null;
  }
}
