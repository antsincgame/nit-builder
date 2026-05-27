/**
 * appwriteUsers.server.ts — helper для magic-link flow.
 *
 * `findOrCreateUserByEmail(email)`:
 *   1. Ищет юзера в nit_users по email (lowercase normalized)
 *   2. Если есть — возвращает {userId, email}
 *   3. Если нет — создаёт Appwrite account с random password (юзер его не знает,
 *      логин только через magic-link) + nit_users документ
 *
 * Этот helper отдельный от appwrite.server.ts чтобы не трогать 45KB файл и
 * минимизировать конфликты при следующих изменениях.
 */

import { ID, Query, type Models } from "node-appwrite";
import { randomBytes } from "node:crypto";
import {
  APPWRITE_CONFIG,
  getAdminDatabases,
  getAdminUsers,
  type NitUser,
} from "./appwrite.server";

/**
 * Найти юзера по email. Возвращает null если не найден.
 *
 * Email нормализуется в lowercase — Appwrite users.create по умолчанию
 * хранит как есть, но создавать всегда lowercase + сравнение тоже lowercase
 * гарантирует что Vasya@Pochta.RU и vasya@pochta.ru — один юзер.
 */
async function findByEmail(
  email: string,
): Promise<{ userId: string; email: string } | null> {
  const db = getAdminDatabases();
  const normalized = email.toLowerCase().trim();

  try {
    const result = await db.listDocuments<NitUser>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      [Query.equal("email", normalized), Query.limit(1)],
    );
    const doc = result.documents[0];
    if (!doc) return null;
    return { userId: doc.$id, email: doc.email };
  } catch (err) {
    console.error("[appwriteUsers] findByEmail failed:", err);
    return null;
  }
}

/**
 * Создать нового юзера через magic-link flow.
 *
 * Appwrite требует password при создании account — генерим случайный
 * 64-hex (256 bits), юзер его не знает, логин только через magic-link.
 *
 * Также создаём nit_users документ с tunnel-ключом (он понадобится когда
 * юзер захочет настроить tunnel client).
 */
async function createViaMagicLink(
  email: string,
): Promise<{ userId: string; email: string }> {
  const users = getAdminUsers();
  const db = getAdminDatabases();
  const { generateTunnelToken, hashTunnelToken, computeTokenLookup } = await import(
    "./tunnelTokens.server.ts"
  );

  const normalized = email.toLowerCase().trim();
  const accountId = ID.unique();
  // 64 hex chars = 256 bits — сильнее любого пароля который юзер мог бы придумать
  const randomPassword = randomBytes(32).toString("hex");

  // 1. Appwrite account
  await users.create(accountId, normalized, undefined, randomPassword);

  // 2. nit_users документ с tunnel-ключом
  const tunnelToken = generateTunnelToken();
  const tunnelTokenLookup = computeTokenLookup(tunnelToken);
  const tunnelTokenHash = await hashTunnelToken(tunnelToken);

  const userDoc: Omit<NitUser, keyof Models.Document> = {
    email: normalized,
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

  return { userId: accountId, email: normalized };
}

/**
 * Главная функция для magic-link verify-эндпоинта.
 *
 * Идемпотентна: повторный вызов с тем же email вернёт того же юзера, новый
 * не создаст. Гонка между findByEmail и create при concurrent verify одного
 * email теоретически возможна, но Appwrite users.create отдаст 409 на
 * email_unique — в этом случае retry с findByEmail вернёт уже созданного.
 */
export async function findOrCreateUserByEmail(
  email: string,
): Promise<{ userId: string; email: string }> {
  const existing = await findByEmail(email);
  if (existing) return existing;

  try {
    return await createViaMagicLink(email);
  } catch (err) {
    const msg = (err as Error).message;
    // Race: пока мы делали findByEmail и create, другой запрос создал юзера.
    // Делаем повторный lookup — должен найти его.
    if (msg.includes("already exists") || msg.includes("user_already_exists")) {
      const retry = await findByEmail(email);
      if (retry) return retry;
    }
    throw err;
  }
}
