import type { LoaderFunctionArgs } from "react-router";
import { verifyMagicLink } from "~/lib/server/magicLink.server";
import { findOrCreateUserByEmail } from "~/lib/server/appwriteUsers.server";
import {
  buildSessionCookie,
  createSessionToken,
  isProduction,
} from "~/lib/server/sessionCookie.server";

/**
 * GET /auth/verify?token=<64hex>
 *
 * Проверяет magic-link токен:
 *   1. Валидирует формат и существование в БД
 *   2. Проверяет expiresAt и что не использован
 *   3. Помечает токен consumedAt=now
 *   4. Находит или создаёт юзера по email
 *   5. Выписывает session cookie и редиректит на /app
 *
 * Все ошибки → редирект на /login?error=<reason> с понятным сообщением.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirectToLoginWithError("missing_token");
  }

  // 1. Проверяем токен
  const result = await verifyMagicLink(token);
  if (!result) {
    // Может быть истёк, использован, или не существует
    return redirectToLoginWithError("invalid_or_expired");
  }

  // 2. Находим или создаём юзера
  let userId: string;
  try {
    const user = await findOrCreateUserByEmail(result.email);
    userId = user.userId;
  } catch (err) {
    console.error("[auth/verify] findOrCreateUserByEmail failed:", err);
    return redirectToLoginWithError("internal_error");
  }

  // 3. Session cookie
  const sessionToken = createSessionToken(userId);
  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": buildSessionCookie(sessionToken, isProduction()),
      Location: "/app",
    },
  });
}

function redirectToLoginWithError(reason: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/login?error=link_${reason}`,
    },
  });
}
