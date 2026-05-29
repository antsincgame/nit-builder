/**
 * Mailer — Resend (приоритет) + SMTP/nodemailer (фолбэк).
 *
 * Если задан RESEND_API_KEY — письма уходят через Resend REST API
 * (https://resend.com). Иначе используется SMTP через nodemailer.
 *
 * Resend ENV:
 *   RESEND_API_KEY     ключ API (re_...)
 *   RESEND_FROM        отправитель, например "nitgen <noreply@nitgen.org>".
 *                      Домен должен быть верифицирован в Resend; для теста
 *                      можно использовать "nitgen <onboarding@resend.dev>".
 *
 * SMTP ENV (фолбэк, если RESEND_API_KEY не задан):
 *   SMTP_HOST          (например smtp.yandex.ru, smtp.gmail.com)
 *   SMTP_PORT          (587 для STARTTLS, 465 для SSL/TLS)
 *   SMTP_USER          (логин)
 *   SMTP_PASS          (пароль / app password)
 *   SMTP_FROM          (адрес отправителя)
 *   SMTP_SECURE        ("true" → SSL/TLS на порту 465; иначе STARTTLS на 587)
 *
 * sendMail никогда не throw'ит — возвращает true при успехе, false иначе.
 * Call sites показывают юзеру generic-сообщение, причина остаётся в логах.
 */

// Loose type для transporter — нам нужен только метод sendMail.
type Transporter = {
  sendMail(opts: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<unknown>;
};

type NodemailerLike = {
  createTransport: (opts: unknown) => Transporter;
};

let cachedTransporter: Transporter | null = null;
let initAttempted = false;

/**
 * Косвенный require — TypeScript не отслеживает что мы тут резолвим модуль,
 * поэтому отсутствие @types/nodemailer не валит typecheck. В runtime обычный
 * CommonJS require — работает в ESM-окружении React Router (Node 20+).
 */
function loadNodemailer(): NodemailerLike | null {
  try {
    const indirectRequire = new Function(
      "name",
      "return require(name);",
    ) as (name: string) => unknown;
    const mod = indirectRequire("nodemailer") as
      | NodemailerLike
      | { default: NodemailerLike };
    return (
      ("default" in mod ? (mod as { default: NodemailerLike }).default : mod) ??
      null
    );
  } catch {
    return null;
  }
}

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  if (initAttempted) return null;
  initAttempted = true;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  const nm = loadNodemailer();
  if (!nm) {
    console.error(
      "[mailer] nodemailer package is not installed. Run `npm install nodemailer`.",
    );
    return null;
  }

  try {
    cachedTransporter = nm.createTransport({
      host,
      port: parseInt(port, 10),
      secure: process.env.SMTP_SECURE === "true" || port === "465",
      auth: { user, pass },
    });
    return cachedTransporter;
  } catch (err) {
    console.error("[mailer] failed to init transporter:", err);
    return null;
  }
}

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

/**
 * Отправитель. Resend требует верифицированный домен; SMTP — адрес из конфига.
 */
function resolveFrom(): string {
  return (
    process.env.RESEND_FROM ??
    process.env.SMTP_FROM ??
    "nitgen <noreply@nitgen.org>"
  );
}

/**
 * Отправка через Resend REST API. Возвращает false (не throw) при любой ошибке.
 */
async function sendViaResend(opts: MailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resolveFrom(),
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[mailer] Resend вернул ${res.status}: ${detail.slice(0, 300)}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mailer] Resend запрос упал:", err);
    return false;
  }
}

/**
 * Синхронная проверка наличия конфигурации почты (Resend ИЛИ SMTP).
 * Не подгружает nodemailer — только смотрит ENV. Подходит для быстрых
 * guard'ов в API-эндпоинтах.
 */
export function isMailerConfigured(): boolean {
  return resendConfigured() || smtpConfigured();
}

export type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Отправить письмо. Resend в приоритете (если задан RESEND_API_KEY),
 * иначе SMTP через nodemailer. Возвращает true при успехе, false при
 * отсутствии конфига или ошибке. Никогда не throw'ит.
 */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  // Resend в приоритете — современный путь, не требует SMTP-портов на VPS.
  if (resendConfigured()) {
    return sendViaResend(opts);
  }

  // Фолбэк: SMTP через nodemailer.
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      "[mailer] транспорт недоступен (ни RESEND_API_KEY, ни SMTP не настроены, либо пакет nodemailer отсутствует)",
    );
    return false;
  }

  try {
    await transporter.sendMail({
      from: resolveFrom(),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error("[mailer] sendMail failed:", err);
    return false;
  }
}
