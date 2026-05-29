import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";
import { getAuth } from "~/lib/server/requireAuth.server";
import { createGrant, isValidChallenge } from "~/lib/server/tunnelLink.server";
import { checkRateLimit } from "~/lib/utils/rateLimit";

const Schema = z.object({
  challenge: z.string().min(43).max(128),
  device: z.string().max(128).optional(),
});

/**
 * POST /api/auth/tunnel/approve
 *
 * Вызывается СТРАНИЦЕЙ /link в браузере (authed через session cookie), когда
 * юзер подтверждает привязку устройства. Создаёт одноразовый code-грант (PKCE
 * challenge от десктопа), который браузер затем редиректит на loopback
 * десктопа. Сам токен здесь НЕ выдаётся — только на /exchange после проверки
 * PKCE-verifier.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const rl = checkRateLimit(request, {
    scope: "tunnel-approve",
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (!rl.allowed) {
    return Response.json({ error: "Слишком часто. Попробуйте позже." }, { status: 429 });
  }

  const user = await getAuth(request);
  if (!user) {
    return Response.json({ error: "Не авторизован", code: "NO_SESSION" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success || !isValidChallenge(parsed.data.challenge)) {
    return Response.json({ error: "Некорректный запрос привязки" }, { status: 400 });
  }

  const code = createGrant({
    userId: user.userId,
    deviceName: parsed.data.device ?? "Неизвестное устройство",
    challenge: parsed.data.challenge,
  });

  return Response.json({ ok: true, code });
}
