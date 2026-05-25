/**
 * OAuth-конфигурация и helpers для exchange code → user info.
 *
 * Поддерживаются Google и GitHub. Архитектура:
 * - /api/auth/oauth/{provider}/start    → редирект на authorize-endpoint провайдера
 *                                         со state-cookie (CSRF protection)
 * - /api/auth/oauth/{provider}/callback → проверка state, обмен code → token,
 *                                         token → userinfo, далее lookup/link/create
 *                                         юзера и выставление session cookie.
 *
 * Все секреты читаются из ENV. Если ENV не сконфигурирован для провайдера —
 * isProviderConfigured(p) возвращает false и start-эндпоинт отдаёт 503.
 * Это позволяет деплоить код без секретов и включать провайдеров по очереди.
 */

import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

export type OAuthProvider = "google" | "github";

export type OAuthUserInfo = {
  /** Уникальный ID юзера у провайдера (string, как пришёл от API). */
  externalId: string;
  /** Email юзера. Может быть null если у GitHub приватный email и нет publik primary. */
  email: string | null;
  /** Имя для отображения (опционально). */
  name?: string;
};

/**
 * Конфигурация одного провайдера. Все секреты — из ENV; этот объект
 * не должен экспортироваться за пределы server-кода.
 */
type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
};

/**
 * База для redirect_uri. В проде должно быть https://nit.vibecoding.by;
 * в dev — http://localhost:3000. Задаётся через OAUTH_REDIRECT_BASE.
 *
 * Без trailing slash. Финальный redirect_uri собирается как
 * `${base}/api/auth/oauth/${provider}/callback`.
 */
export function getOAuthRedirectBase(): string {
  const fromEnv = process.env.OAUTH_REDIRECT_BASE;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Fallback на прод-домен — лучше чем кидать ошибку при загрузке модуля.
  return "https://nit.vibecoding.by";
}

export function buildRedirectUri(provider: OAuthProvider): string {
  return `${getOAuthRedirectBase()}/api/auth/oauth/${provider}/callback`;
}

function getProviderConfig(provider: OAuthProvider): ProviderConfig | null {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "openid email profile",
    };
  }
  if (provider === "github") {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scope: "read:user user:email",
    };
  }
  return null;
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return getProviderConfig(provider) !== null;
}

export function isValidProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "github";
}

/**
 * Сборка authorize-URL'а на который мы редиректим юзера.
 *
 * state — opaque random string (CSRF protection). Сервер ставит его в
 * httpOnly cookie с TTL 10 мин; в callback проверяем что `state` из
 * query совпадает с cookie. Если нет — кто-то подменил redirect.
 */
export function buildAuthorizeUrl(provider: OAuthProvider, state: string): string {
  const config = getProviderConfig(provider);
  if (!config) {
    throw new Error(`OAuth provider '${provider}' is not configured`);
  }
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", buildRedirectUri(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  if (provider === "google") {
    // Чтобы Google возвращал email и refresh-token (refresh нам не нужен сейчас,
    // но access_type=online ставится по умолчанию — оставляем как есть).
    url.searchParams.set("prompt", "select_account");
  }
  return url.toString();
}

/**
 * Обмен authorization code на access_token. Каждый провайдер имеет свой
 * формат — Google требует `application/x-www-form-urlencoded`, GitHub
 * по умолчанию отвечает `text/plain` и требует `Accept: application/json`.
 */
async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
): Promise<string> {
  const config = getProviderConfig(provider);
  if (!config) throw new Error(`OAuth provider '${provider}' is not configured`);

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: buildRedirectUri(provider),
    grant_type: "authorization_code",
  });

  const resp = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Token exchange failed: ${resp.status} ${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { access_token?: string; error?: string };
  if (data.error) throw new Error(`Token exchange error: ${data.error}`);
  if (!data.access_token) throw new Error("Token exchange: no access_token in response");
  return data.access_token;
}

/**
 * Получить user-info от провайдера по access token.
 *
 * Для Google — один запрос к userinfo endpoint.
 * Для GitHub — два запроса (`/user` для имени+id, `/user/emails` чтобы
 * получить primary verified email, так как у /user email может быть null
 * при приватном email).
 */
async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string,
): Promise<OAuthUserInfo> {
  if (provider === "google") {
    const resp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      throw new Error(`Google userinfo failed: ${resp.status}`);
    }
    const data = (await resp.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!data.sub) throw new Error("Google userinfo: missing sub");
    return {
      externalId: data.sub,
      email: data.email && data.email_verified ? data.email : null,
      name: data.name,
    };
  }

  if (provider === "github") {
    const [userResp, emailsResp] = await Promise.all([
      fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "nitgen-oauth",
        },
      }),
      fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "nitgen-oauth",
        },
      }),
    ]);
    if (!userResp.ok) throw new Error(`GitHub /user failed: ${userResp.status}`);
    const user = (await userResp.json()) as {
      id?: number;
      login?: string;
      name?: string | null;
      email?: string | null;
    };
    if (!user.id) throw new Error("GitHub /user: missing id");

    let email: string | null = user.email ?? null;
    if (emailsResp.ok) {
      const emails = (await emailsResp.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      if (primary) email = primary.email;
    }

    return {
      externalId: String(user.id),
      email,
      name: user.name ?? user.login ?? undefined,
    };
  }

  throw new Error(`Unknown OAuth provider: ${provider as string}`);
}

/**
 * High-level helper: code → user info. Один вызов закрывает оба шага.
 */
export async function resolveOAuthCode(
  provider: OAuthProvider,
  code: string,
): Promise<OAuthUserInfo> {
  const accessToken = await exchangeCodeForToken(provider, code);
  return fetchUserInfo(provider, accessToken);
}

// ─── State (CSRF) cookie ─────────────────────────────────

/**
 * Генерация state — 32 случайных байта в hex.
 *
 * Используется как opaque token для CSRF-защиты OAuth flow.
 * Хранится в httpOnly cookie со коротким TTL (10 минут) — достаточно
 * чтобы юзер успел пройти редирект, но не настолько долго, чтобы
 * украденный state можно было переиспользовать.
 */
export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}

const STATE_COOKIE_NAME = "nit_oauth_state" as const;
const STATE_MAX_AGE = 600; // 10 минут

export function buildStateCookie(state: string, isProduction: boolean): string {
  const parts = [
    `${STATE_COOKIE_NAME}=${state}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${STATE_MAX_AGE}`,
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearStateCookie(isProduction: boolean): string {
  const parts = [
    `${STATE_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function parseStateCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split("=");
    if (name === STATE_COOKIE_NAME) {
      const value = valueParts.join("=");
      return value || null;
    }
  }
  return null;
}

/**
 * Constant-time сравнение state. Защищает от timing-атак при сравнении
 * cookie-state с query-state.
 */
export function constantTimeStateEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Хелпер, который мог бы понадобиться если в будущем мы захотим
 * подписывать state HMAC'ом (например для embedding redirect-target внутрь
 * state). Сейчас не используется, но оставлен для расширения.
 */
export function signOAuthState(payload: string): string {
  const secret = process.env.NIT_TOKEN_LOOKUP_SECRET ?? "";
  return createHmac("sha256", secret).update(payload).digest("hex");
}
