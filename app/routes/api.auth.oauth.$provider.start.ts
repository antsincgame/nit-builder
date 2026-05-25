import type { LoaderFunctionArgs } from "react-router";
import {
  isValidProvider,
  isProviderConfigured,
  buildAuthorizeUrl,
  generateOAuthState,
  buildStateCookie,
} from "~/lib/server/oauth.server";
import { isProduction } from "~/lib/server/sessionCookie.server";
import { checkRateLimit } from "~/lib/utils/rateLimit";

/**
 * GET /api/auth/oauth/:provider/start
 *
 * Старт OAuth flow:
 *   1. Валидируем provider (google | github)
 *   2. Проверяем что провайдер сконфигурирован через ENV (иначе 503)
 *   3. Rate-limit по IP — 10 startов в минуту (защита от спама редиректами)
 *   4. Генерим state, ставим в httpOnly cookie на 10 минут
 *   5. Редиректим на authorize URL провайдера
 *
 * После того как юзер подтвердит доступ у провайдера, он будет
 * редиректнут на /api/auth/oauth/:provider/callback.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const provider = params.provider;
  if (!provider || !isValidProvider(provider)) {
    return Response.json({ error: "Invalid provider" }, { status: 400 });
  }

  if (!isProviderConfigured(provider)) {
    return Response.json(
      {
        error: `OAuth provider '${provider}' is not configured on the server.`,
      },
      { status: 503 },
    );
  }

  const rl = checkRateLimit(request, {
    scope: `oauth-start-${provider}`,
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many OAuth attempts. Try again in a minute." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)),
        },
      },
    );
  }

  const state = generateOAuthState();
  const authorizeUrl = buildAuthorizeUrl(provider, state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      "Set-Cookie": buildStateCookie(state, isProduction()),
    },
  });
}
