/**
 * Per-device tunnel tokens (Cursor-style привязка устройств).
 *
 * В отличие от единственного tunnelToken в nit_users (один на аккаунт),
 * здесь по строке на каждое устройство в коллекции nit_tunnel_tokens — можно
 * видеть список устройств и отзывать каждое по отдельности.
 *
 * Тот же two-field scheme что и per-account токен: HMAC-SHA256 lookup
 * (детерминированный индекс) + argon2id hash (финальная проверка).
 * Переиспользуем крипто-утилиты из tunnelTokens.server.
 */

import { ID, Query, type Models } from "node-appwrite";
import { APPWRITE_CONFIG, getAdminDatabases } from "./appwrite.server";
import {
  generateTunnelToken,
  computeTokenLookup,
  hashTunnelToken,
  verifyTunnelTokenHash,
  isTunnelTokenFormat,
} from "./tunnelTokens.server";

// Коллекция создаётся в scripts/appwrite-migrate.ts.
const COLLECTION = "nit_tunnel_tokens";

export type NitTunnelToken = Models.Document & {
  userId: string;
  /** HMAC-SHA256(token) — детерминированный lookup-индекс */
  tokenLookup: string;
  /** argon2id hash с random salt — финальная проверка */
  tokenHash: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt?: string;
  revoked: boolean;
};

/** Безопасное имя устройства — обрезаем до лимита схемы (128). */
function sanitizeDeviceName(name: string | undefined | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Неизвестное устройство";
  return trimmed.slice(0, 128);
}

/**
 * Создать новый device-токен для юзера. Возвращает plaintext-токен (уходит в
 * десктоп по защищённому exchange, юзеру в глаза не попадает) и id записи.
 */
export async function createDeviceToken(params: {
  userId: string;
  deviceName?: string;
}): Promise<{ token: string; deviceId: string }> {
  const db = getAdminDatabases();
  const token = generateTunnelToken();
  const tokenLookup = computeTokenLookup(token);
  const tokenHash = await hashTunnelToken(token);
  const nowIso = new Date().toISOString();

  const doc = await db.createDocument<NitTunnelToken>(
    APPWRITE_CONFIG.databaseId,
    COLLECTION,
    ID.unique(),
    {
      userId: params.userId,
      tokenLookup,
      tokenHash,
      deviceName: sanitizeDeviceName(params.deviceName),
      createdAt: nowIso,
      lastSeenAt: nowIso,
      revoked: false,
    },
  );
  return { token, deviceId: doc.$id };
}

/**
 * Найти юзера по device-токену. Lookup по HMAC → перебор кандидатов через
 * argon2 → проверка revoked. При успехе best-effort обновляет lastSeenAt.
 * Возвращает { userId, deviceId } или null.
 */
export async function findUserByDeviceToken(
  token: string,
): Promise<{ userId: string; deviceId: string } | null> {
  if (!isTunnelTokenFormat(token)) return null;

  const lookup = computeTokenLookup(token);
  const db = getAdminDatabases();

  try {
    const result = await db.listDocuments<NitTunnelToken>(
      APPWRITE_CONFIG.databaseId,
      COLLECTION,
      [Query.equal("tokenLookup", lookup), Query.limit(5)],
    );
    if (result.documents.length === 0) return null;

    for (const candidate of result.documents) {
      if (candidate.revoked) continue;
      const valid = await verifyTunnelTokenHash(token, candidate.tokenHash);
      if (!valid) continue;

      // best-effort lastSeenAt — не ломаем авторизацию если апдейт упал
      void db
        .updateDocument(APPWRITE_CONFIG.databaseId, COLLECTION, candidate.$id, {
          lastSeenAt: new Date().toISOString(),
        })
        .catch(() => {});

      return { userId: candidate.userId, deviceId: candidate.$id };
    }
    return null;
  } catch {
    return null;
  }
}

/** Список устройств юзера (для UI «Устройства»). Свежие сверху. */
export async function listUserDevices(userId: string): Promise<NitTunnelToken[]> {
  const db = getAdminDatabases();
  try {
    const result = await db.listDocuments<NitTunnelToken>(
      APPWRITE_CONFIG.databaseId,
      COLLECTION,
      [Query.equal("userId", userId), Query.orderDesc("$createdAt"), Query.limit(100)],
    );
    return result.documents;
  } catch {
    return [];
  }
}

/**
 * Отозвать устройство (по id записи) с ownership-проверкой. Помечает
 * revoked=true (не удаляем — чтобы lastSeenAt/история остались). Следующий
 * hello с этим токеном провалится. Мгновенный kill живого WS конкретного
 * устройства — отдельный фоллоуап (нужен deviceId в TunnelConnection).
 */
export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  const db = getAdminDatabases();
  try {
    const doc = await db.getDocument<NitTunnelToken>(
      APPWRITE_CONFIG.databaseId,
      COLLECTION,
      deviceId,
    );
    if (doc.userId !== userId) return false;
    await db.updateDocument(APPWRITE_CONFIG.databaseId, COLLECTION, deviceId, {
      revoked: true,
    });
    return true;
  } catch {
    return false;
  }
}
