import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";
import { sendMail, isMailerConfigured } from "~/lib/server/mailer.server";
import { checkRateLimit } from "~/lib/utils/rateLimit";

const RequestSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email({ message: "Неверный формат email" }).max(255).optional(),
  message: z.string().min(10, { message: "Сообщение слишком короткое" }).max(2000),
  /** Honeypot: люди это поле не видят и не заполняют. */
  website: z.string().max(200).optional(),
});

/**
 * POST /api/feedback — форма обратной связи с лендинга.
 *
 * Письмо уходит на NIT_FEEDBACK_TO (по умолчанию support@nitgen.org)
 * через существующий mailer (Resend / SMTP). Без новых коллекций и БД.
 *
 * Защита:
 * - rate-limit 5 сообщений / 10 минут на IP
 * - honeypot-поле `website`: заполнено ботом → отвечаем ok, письмо не шлём
 * - длина сообщения 10..2000 символов
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const rl = checkRateLimit(request, {
    scope: "feedback",
    windowMs: 10 * 60_000,
    maxRequests: 5,
  });
  if (!rl.allowed) {
    return Response.json(
      { error: "Слишком много сообщений. Попробуйте позже." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 600_000) / 1000)),
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
        error: "Проверьте поля формы",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { name, email, message, website } = parsed.data;

  // Honeypot сработал — делаем вид, что всё ок, но письмо не отправляем.
  if (website && website.trim() !== "") {
    return Response.json({ ok: true });
  }

  if (!isMailerConfigured()) {
    console.error("[feedback] mailer не настроен — сообщение не доставить");
    return Response.json(
      { error: "Сервис временно недоступен. Напишите на support@nitgen.org." },
      { status: 503 },
    );
  }

  const to = process.env.NIT_FEEDBACK_TO ?? "support@nitgen.org";
  const page = request.headers.get("referer") ?? "неизвестно";

  const text = [
    "Новое сообщение с формы обратной связи nitgen.org",
    "",
    `Имя: ${name?.trim() || "—"}`,
    `Email для ответа: ${email?.trim() || "—"}`,
    `Страница: ${page}`,
    "",
    "Сообщение:",
    message.trim(),
  ].join("\n");

  const sent = await sendMail({
    to,
    subject: "nitgen: обратная связь",
    text,
  });

  if (!sent) {
    return Response.json(
      { error: "Не удалось отправить. Напишите на support@nitgen.org." },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}
