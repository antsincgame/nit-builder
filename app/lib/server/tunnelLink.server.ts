/**
 * In-memory store одноразовых «pending link» грантов для Cursor-style
 * привязки устройств.
 *
 * Поток: десктоп открывает /link с PKCE code_challenge → юзер аппрувит в
 * браузере → сервер кладёт сюда грант под одноразовый code и редиректит на
 * loopback десктопа с этим code → десктоп меняет code+verifier на device-токен
 * через /api/auth/tunnel/exchange.
 *
 * Хранилище in-memory (как tunnelRegistry): грант живёт 90 секунд, теряется
 * при рестарте процесса — это ОК, юзер просто повторит привязку. Если появится
 * горизонтальное масштабирование WS — это и tunnelRegistry переедут в общий стор.
 *
 * Code одноразовый: consumeGrant удаляет его при первом обращении (независимо
 * от исхода PKCE-проверки — чтобы нельзя было брутить verifier по одному коду).
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type PendingGrant = {
  userId: string;
  deviceName: string;
  /** PKCE code_challenge (base64url(sha256(verifier)), S256). */
  challenge: string;
  expiresAt: number;
};

type GrantStore = Map<string, PendingGrant>;

// Singleton через globalThis — переживает HMR/повторную загрузку модуля в dev.
const GLOBAL_KEY = "__nitTunnelLinkGrants__";
const globalRef = globalThis as unknown as Record<string, GrantStore | undefined>;
const grants: GrantStore = globalRef[GLOBAL_KEY] ?? (globalRef[GLOBAL_KEY] = new Map());

const GRANT_TTL_MS = 90_000;

function sweep(): void {
  const now = Date.now();
  for (const [code, grant] of grants) {
    if (grant.expiresAt <= now) grants.delete(code);
  }
}

/** base64url без padding. */
function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Проверка формата PKCE-challenge: base64url, S256 → 43 символа. */
export function isValidChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(challenge);
}

/**
 * Создать одноразовый код-грант. Возвращает code (передаётся в браузер →
 * loopback десктопа).
 */
export function createGrant(params: {
  userId: string;
  deviceName: string;
  challenge: string;
}): string {
  sweep();
  const code = base64url(randomBytes(32));
  grants.set(code, {
    userId: params.userId,
    deviceName: params.deviceName,
    challenge: params.challenge,
    expiresAt: Date.now() + GRANT_TTL_MS,
  });
  return code;
}

/**
 * Обменять code+verifier на грант. Одноразово: при любом исходе удаляет запись.
 * Проверяет PKCE: base64url(sha256(verifier)) === challenge (constant-time).
 * Возвращает { userId, deviceName } или null.
 */
export function consumeGrant(
  code: string,
  verifier: string,
): { userId: string; deviceName: string } | null {
  sweep();
  const grant = grants.get(code);
  if (!grant) return null;

  // Код одноразовый независимо от исхода.
  grants.delete(code);

  if (grant.expiresAt <= Date.now()) return null;

  const computed = base64url(createHash("sha256").update(verifier).digest());
  const a = Buffer.from(computed);
  const b = Buffer.from(grant.challenge);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) return null;

  return { userId: grant.userId, deviceName: grant.deviceName };
}
