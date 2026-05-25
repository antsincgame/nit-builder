/**
 * OAuth-расширения для Appwrite user model.
 *
 * Не трогает основной appwrite.server.ts (минимизация конфликтов), но
 * использует его экспорт `APPWRITE_CONFIG` и `getAdminUsers/getAdminDatabases`.
 *
 * Схема: в коллекцию nit_users добавлены два опциональных поля:
 *   - googleId?: string  — Google `sub` claim, уникальный
 *   - githubId?: string  — GitHub `id` (число → строка), уникальный
 *
 * Существующие email-password юзеры по умолчанию не имеют этих полей.
 * При OAuth-login юзера с тем же email мы делаем «link» (добавляем
 * googleId/githubId в существующий документ).
 */

import { ID, Query } from "node-appwrite";
import { randomBytes } from "node:crypto";
import {
  APPWRITE_CONFIG,
  getAdminDatabases,
  getAdminUsers,
} from "./appwrite.server";
import type { NitUserWithOAuth } from "./appwrite-types-ext";

export type OAuthProviderId = "google" | "github";

const PROVIDER_FIELD: Record<OAuthProviderId, "googleId" | "githubId"> = {
  google: "googleId",
  github: "githubId",
};

/**
 * Найти существующего юзера по OAuth `externalId` конкретного провайдера.
 * Возвращает userId или null если не найден.
 *
 * Lookup через Query.equal по полю googleId/githubId (в migration создан
 * index). Если у юзера в БД оба провайдера привязаны — это нормально, он
 * может логиниться любым.
 */
export async function findUserByOAuthId(
  provider: OAuthProviderId,
  externalId: string,
): Promise<{ userId: string; email: string } | null> {
  const db = getAdminDatabases();
  const field = PROVIDER_FIELD[provider];
  try {
    const result = await db.listDocuments<NitUserWithOAuth>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      [Query.equal(field, externalId), Query.limit(1)],
    );
    const doc = result.documents[0];
    if (!doc) return null;
    return { userId: doc.$id, email: doc.email };
  } catch (err) {
    console.error(`[oauth] findUserByOAuthId(${provider}) failed:`, err);
    return null;
  }
}

/**
 * Найти юзера по email. Используется для авто-линковки: если человек
 * раньше регистрировался через email+password, потом нажал «Войти через
 * Google» с тем же email — линкуем googleId к существующему аккаунту,
 * а не создаём дубль.
 *
 * Учитывает регистр email (Appwrite сохраняет как есть; обычно lowercase).
 */
export async function findUserByEmail(
  email: string,
): Promise<{ userId: string; email: string } | null> {
  const db = getAdminDatabases();
  try {
    const result = await db.listDocuments<NitUserWithOAuth>(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      [Query.equal("email", email), Query.limit(1)],
    );
    const doc = result.documents[0];
    if (!doc) return null;
    return { userId: doc.$id, email: doc.email };
  } catch (err) {
    console.error("[oauth] findUserByEmail failed:", err);
    return null;
  }
}

/**
 * Привязать OAuth-провайдера к существующему юзеру. Просто проставить
 * googleId/githubId в nit_users документ.
 *
 * Используется когда findUserByEmail нашёл существующего юзера, а
 * findUserByOAuthId — нет.
 */
export async function linkOAuthAccount(
  userId: string,
  provider: OAuthProviderId,
  externalId: string,
): Promise<void> {
  const db = getAdminDatabases();
  const field = PROVIDER_FIELD[provider];
  await db.updateDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.users,
    userId,
    { [field]: externalId },
  );
}

/**
 * Создать юзера через OAuth (нет существующего ни по externalId ни по email).
 *
 * Логика:
 * 1. Создаём Appwrite account с email + случайным password (юзер его не знает —
 *    логин только через OAuth). Это нужно потому что Appwrite требует password.
 *    Юзер может потом сбросить пароль через email (если такая фича появится),
 *    либо просто продолжать логиниться через OAuth.
 * 2. Генерим tunnelToken как при обычной регистрации.
 * 3. Создаём nit_users документ с привязанным провайдером.
 *
 * Возвращает userId и plaintext tunnelToken (показывается юзеру один раз —
 * но в OAuth-flow мы его сейчас не показываем, потому что юзер не запрашивал
 * туннель. Он сможет регенерировать его в настройках если понадобится).
 */
export async function createUserViaOAuth(params: {
  email: string;
  name?: string;
  provider: OAuthProviderId;
  externalId: string;
}): Promise<{ userId: string; tunnelToken: string }> {
  const users = getAdminUsers();
  const db = getAdminDatabases();
  const { generateTunnelToken, hashTunnelToken, computeTokenLookup } = await import(
    "./tunnelTokens.server.js"
  );

  // 1. Создаём Appwrite account. Случайный пароль — юзер его не узнает,
  //    логин только через OAuth. Пароль нужен только чтобы Appwrite принял
  //    создание (он требует password).
  const accountId = ID.unique();
  const randomPassword = randomBytes(32).toString("hex"); // 64 hex chars — заведомо сильнее любого человеческого
  await users.create(accountId, params.email, undefined, randomPassword, params.name);

  // 2. Tunnel token (как в registerUser).
  const tunnelToken = generateTunnelToken();
  const tunnelTokenLookup = computeTokenLookup(tunnelToken);
  const tunnelTokenHash = await hashTunnelToken(tunnelToken);

  // 3. nit_users document с привязанным OAuth-провайдером.
  const field = PROVIDER_FIELD[params.provider];
  const baseDoc = {
    email: params.email,
    tunnelTokenLookup,
    tunnelTokenHash,
    tunnelTokenCreatedAt: new Date().toISOString(),
    preferredProvider: "tunnel" as const,
    sessionVersion: 0,
    [field]: params.externalId,
  };

  await db.createDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.users,
    accountId,
    baseDoc,
  );

  return { userId: accountId, tunnelToken };
}
