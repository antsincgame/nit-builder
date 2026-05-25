import type { LoaderFunctionArgs } from "react-router";
import {
  isValidProvider,
  isProviderConfigured,
  resolveOAuthCode,
  parseStateCookie,
  constantTimeStateEqual,
  buildClearStateCookie,
} from "~/lib/server/oauth.server";
import {
  findUserByOAuthId,
  findUserByEmail,
  linkOAuthAccount,
  createUserViaOAuth,
} from "~/lib/server/appwrite-oauth.server";
import {
  buildSessionCookie,
  createSessionToken,
  isProduction,
} from "~/lib/server/sessionCookie.server";

/**
 * GET /api/auth/oauth/:provider/callback?code=...&state=...
 *
 * Завершение OAuth flow:
 *   1. Валидируем provider + наличие ENV
 *   2. Проверяем `state` (CSRF — должен совпасть с cookie)
 *   3. Обмениваем `code` на access_token, затем на user-info
 *   4. lookup by oauthId → если есть, логиним
 *   5. lookup by email → если есть, линкуем oauthId к существующему
 *   6. иначе создаём нового юзера
 *   7. Выписываем session cookie и редиректим на /app
 *
 * На любую ошибку — редиректим на /login?error=oauth_failed (без деталей,
 * чтобы не давать атакующему signal). Детали — в логах.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const provider = params.provider;
  if (!provider || !isValidProvider(provider)) {
    return redirectToLoginWithError("invalid_provider");
  }

  if (!isProviderConfigured(provider)) {
    return redirectToLoginWithError("provider_not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateFromQuery = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Юзер мог нажать "Cancel" у провайдера → возвращаемся на login без noise.
  if (error) {
    console.warn(`[oauth/callback/${provider}] user-cancel or provider error: ${error}`);
    return redirectToLoginWithError("user_cancelled");
  }

  if (!code || !stateFromQuery) {
    return redirectToLoginWithError("missing_params");
  }

  // CSRF check: state из query должен совпасть со state из cookie.
  const stateFromCookie = parseStateCookie(request.headers.get("Cookie"));
  if (!stateFromCookie || !constantTimeStateEqual(stateFromQuery, stateFromCookie)) {
    console.warn(`[oauth/callback/${provider}] state mismatch (CSRF guard)`);
    return redirectToLoginWithError("state_mismatch");
  }

  // Обмен code на user-info через провайдера.
  let userInfo;
  try {
    userInfo = await resolveOAuthCode(provider, code);
  } catch (err) {
    console.error(`[oauth/callback/${provider}] resolveOAuthCode failed:`, err);
    return redirectToLoginWithError("token_exchange_failed");
  }

  if (!userInfo.email) {
    // Без email мы не можем ни линковать ни создавать (email — primary key
    // в Appwrite). У GitHub юзер может скрыть email — он должен опубликовать
    // primary verified email или дать `user:email` scope.
    console.warn(`[oauth/callback/${provider}] no email in user info`);
    return redirectToLoginWithError("no_email");
  }

  // ── Lookup or create ──────────────────────────────────
  let userId: string;

  try {
    // 1. По oauthId — если уже логинились через этого провайдера, мгновенный hit.
    const byOAuth = await findUserByOAuthId(provider, userInfo.externalId);
    if (byOAuth) {
      userId = byOAuth.userId;
    } else {
      // 2. По email — auto-link: тот же email значит тот же человек.
      const byEmail = await findUserByEmail(userInfo.email);
      if (byEmail) {
        await linkOAuthAccount(byEmail.userId, provider, userInfo.externalId);
        userId = byEmail.userId;
      } else {
        // 3. Новый юзер — создаём через OAuth.
        const created = await createUserViaOAuth({
          email: userInfo.email,
          name: userInfo.name,
          provider,
          externalId: userInfo.externalId,
        });
        userId = created.userId;
      }
    }
  } catch (err) {
    console.error(`[oauth/callback/${provider}] user resolve/create failed:`, err);
    return redirectToLoginWithError("internal_error");
  }

  // Выписываем session cookie (HMAC с sessionVersion=0 для нового юзера;
  // для существующего — тоже 0, если юзер ни разу не logout-all'нулся;
  // если есть актуальный sessionVersion > 0, login всё равно работает,
  // потому что bump инвалидирует только старые токены, а мы выдаём новый).
  const sessionToken = createSessionToken(userId);

  const headers = new Headers();
  headers.append("Set-Cookie", buildSessionCookie(sessionToken, isProduction()));
  headers.append("Set-Cookie", buildClearStateCookie(isProduction()));
  headers.set("Location", "/app");

  return new Response(null, { status: 302, headers });
}

function redirectToLoginWithError(reason: string): Response {
  const headers = new Headers();
  headers.append("Set-Cookie", buildClearStateCookie(isProduction()));
  headers.set("Location", `/login?error=oauth_${reason}`);
  return new Response(null, { status: 302, headers });
}
