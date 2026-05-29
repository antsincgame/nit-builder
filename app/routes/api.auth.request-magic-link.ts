import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";
import { findOrCreateUserByEmail } from "~/lib/server/appwriteUsers.server";
import { getUserSessionVersion, isAppwriteConfigured } from "~/lib/server/appwrite.server";
import { createMagicLink } from "~/lib/server/magicLink.server";
import { sendMail, isMailerConfigured } from "~/lib/server/mailer.server";
import {
  buildSessionCookie,
  createSessionToken,
  isProduction,
} from "~/lib/server/sessionCookie.server";
import { checkRateLimit } from "~/lib/utils/rateLimit";

const RequestSchema = z.object({
  email: z.string().email({ message: "Неверный формат email" }).max(255),
  // Куда вернуть после входа (например /link?... при привязке устройства).
  // Валидируется как относительный путь (см. safeNext).
  next: z.string().max(512).optional(),
});

/**
 * Открытый-редирект guard: разрешаем только относительные пути на свой
 * сайт (начинаются с "/", но не "//" и не "/\\" — иначе это
 * protocol-relative URL на чужой домен).
 */
function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/**
 * POST /api/auth/request-magic-link
 *
 * Принимает email, создаёт magic-link токен, отправляет письмо со ссылкой.
 * Опциональный next — куда вернуть после входа (вшивается в verify-ссылку).
 *
 * Защита:
 * - Rate-limit 3/мин на IP (защита от спама)
 * - Per-email rate-limit отсутствует — `createMagicLink` сам инвалидирует
 *   предыдущие активные ссылки, так что многократный запрос не плодит
 *   токены, просто переписывает.
 *
 * ENV:
 *   SMTP_HOST/PORT/USER/PASS/FROM — для отправки писем
 *   OAUTH_REDIRECT_BASE (или дефолт https://nit.vibecoding.by) — для ссылок
 *   NIT_EMAIL_ONLY_LOGIN=1 — временный режим: email сразу логинит без письма
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Rate-limit: 3 запроса в минуту с одного IP. Magic-link отправка дорогая
  // (письмо + Appwrite write), 3 в минуту достаточно для легитимного юзера
  // который опечатался один раз.
  const rl = checkRateLimit(request, {
    scope: "request-magic-link",
    windowMs: 60_000,
    maxRequests: 3,
  });
  if (!rl.allowed) {
    return Response.json(
      { error: "Слишком часто. Попробуйте через минуту." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Проверьте правильность email",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { email } = parsed.data;
  const next = safeNext(parsed.data.next);

  if (process.env.NIT_EMAIL_ONLY_LOGIN === "1") {
    if (!isAppwriteConfigured()) {
      return Response.json(
        { error: "Auth system is not configured." },
        { status: 503 },
      );
    }

    try {
      const user = await findOrCreateUserByEmail(email);
      const sessionVersion = await getUserSessionVersion(user.userId);
      const sessionToken = createSessionToken(user.userId, sessionVersion);

      return Response.json(
        { ok: true, loggedIn: true, redirectTo: next ?? "/app" },
        {
          status: 200,
          headers: {
            "Set-Cookie": buildSessionCookie(sessionToken, isProduction()),
            "Content-Type": "application/json",
          },
        },
      );
    } catch (err) {
      console.error("[request-magic-link] email-only login failed:", err);
      return Response.json(
        { error: "Вход временно недоступен. Попробуйте позже." },
        { status: 500 },
      );
    }
  }

  // Если mailer не настроен — отдаём 503 чтобы фронт показал понятную
  // ошибку. Это лучше чем silent fail когда юзер думает что письмо ушло.
  if (!isMailerConfigured()) {
    console.error("[request-magic-link] SMTP не настроен — письмо не отправить");
    return Response.json(
      {
        error: "Сервис временно недоступен. Попробуйте позже.",
      },
      { status: 503 },
    );
  }

  try {
    const token = await createMagicLink(email);
    const baseUrl =
      process.env.OAUTH_REDIRECT_BASE ?? "https://nit.vibecoding.by";
    const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
    const link = `${baseUrl.replace(/\/$/, "")}/auth/verify?token=${token}${nextParam}`;

    const sent = await sendMail({
      to: email,
      subject: "Ссылка для входа в nitgen",
      text: buildMagicLinkText(link),
      html: buildMagicLinkHtml(link),
    });

    if (!sent) {
      // Mailer был сконфигурирован при проверке выше, но реальная отправка
      // упала (например SMTP сервер недоступен). Возвращаем 503 — пусть
      // юзер попробует позже.
      return Response.json(
        { error: "Не удалось отправить письмо. Попробуйте позже." },
        { status: 503 },
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[request-magic-link] failed:", err);
    return Response.json(
      { error: "Внутренняя ошибка. Попробуйте позже." },
      { status: 500 },
    );
  }
}

function buildMagicLinkText(link: string): string {
  return `Вход в nitgen

Нажмите на ссылку чтобы войти:
${link}

Ссылка действует 15 минут и работает только один раз.

Если вы не запрашивали вход — просто проигнорируйте это письмо.

—
nitgen.org
`;
}

function buildMagicLinkHtml(link: string): string {
  // Минимальный inline-styled HTML — большинство почтовых клиентов не
  // поддерживают <style> блоки или CSP сильно ограничен. Tailwind-классов
  // тут нет — только inline styles.
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Вход в nitgen</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:40px 20px;background:#0A0A0A;">
  <tr>
    <td align="center">
      <table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
        <tr>
          <td>
            <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
              Вход в nitgen
            </h1>
            <p style="margin:0 0 24px 0;font-size:14px;color:#A1A1AA;line-height:1.6;">
              Нажмите кнопку ниже чтобы войти в аккаунт. Ссылка действует 15 минут и работает только один раз.
            </p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="border-radius:12px;background:#10b981;">
                  <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 32px;color:#0A0A0A;font-size:14px;font-weight:600;text-decoration:none;border-radius:12px;">
                    Войти в nitgen
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0 0;font-size:12px;color:#71717A;line-height:1.6;">
              Если кнопка не работает, скопируйте ссылку:<br>
              <a href="${escapeHtml(link)}" style="color:#10b981;word-break:break-all;text-decoration:none;">${escapeHtml(link)}</a>
            </p>
            <p style="margin:24px 0 0 0;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#71717A;line-height:1.6;">
              Если вы не запрашивали вход в nitgen — просто проигнорируйте это письмо.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0 0;font-size:11px;color:#71717A;">
        nitgen.org
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
