import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";
import { consumeGrant } from "~/lib/server/tunnelLink.server";
import { createDeviceToken } from "~/lib/server/tunnelDevices.server";
import { getUserById, isAppwriteConfigured } from "~/lib/server/appwrite.server";
import { checkRateLimit } from "~/lib/utils/rateLimit";

const Schema = z.object({
  code: z.string().min(10).max(256),
  verifier: z.string().min(43).max(256),
});

/**
 * POST /api/auth/tunnel/exchange
 *
 * Вызывается ДЕСКТОПОМ (не браузер, без cookie) после того как loopback
 * получил code из браузерного редиректа. Проверяет PKCE (verifier против
 * challenge из гранта), выпускает per-device tunnel-токен и отдаёт его
 * десктопу. Защита: одноразовый code + PKCE + rate-limit по IP.
 *
 * CORS не нужен: вызов идёт из Rust-части десктопа (server-to-server), не из
 * браузерного JS.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const rl = checkRateLimit(request, {
    scope: "tunnel-exchange",
    windowMs: 60_000,
    maxRequests: 20,
  });
  if (!rl.allowed) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  if (!isAppwriteConfigured()) {
    return Response.json({ error: "Auth system is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const grant = consumeGrant(parsed.data.code, parsed.data.verifier);
  if (!grant) {
    return Response.json(
      { error: "Код недействителен или истёк", code: "INVALID_CODE" },
      { status: 400 },
    );
  }

  try {
    const { token, deviceId } = await createDeviceToken({
      userId: grant.userId,
      deviceName: grant.deviceName,
    });
    const user = await getUserById(grant.userId);
    return Response.json({
      ok: true,
      token,
      deviceId,
      userId: grant.userId,
      email: user?.email ?? null,
    });
  } catch (err) {
    console.error("[tunnel/exchange] failed to mint device token:", err);
    return Response.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}
