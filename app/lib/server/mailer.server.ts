/**
 * Минимальный SMTP-mailer через nodemailer.
 *
 * Не делает ничего сложного — берёт SMTP_* env vars, формирует transporter,
 * отправляет письмо. Если ENV не сконфигурирован — функция возвращает false
 * и логирует warning. Это позволяет деплоить код до того как заказчик
 * пропишет SMTP — endpoint просто будет отдавать 503.
 *
 * Required ENV:
 *   SMTP_HOST          (например smtp.yandex.ru, smtp.gmail.com, smtp.mailgun.org)
 *   SMTP_PORT          (587 для STARTTLS, 465 для SSL/TLS)
 *   SMTP_USER          (логин)
 *   SMTP_PASS          (пароль / app password)
 *   SMTP_FROM          (адрес отправителя, например "nitgen <noreply@nitgen.org>")
 *
 * Optional:
 *   SMTP_SECURE        ("true" → SSL/TLS на порту 465; иначе STARTTLS на 587)
 *
 * NB: nodemailer импортируется динамически (await import) — это позволяет
 * пройти CI typecheck/build когда пакета ещё нет в node_modules (старый
 * lockfile). На Coolify auto-deploy npm install подтянет пакет до
 * запуска и dynamic import отработает.
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

let cachedTransporter: Transporter | null = null;
let initAttempted = false;

async function getTransporter(): Promise<Transporter | null> {
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

  try {
    // Динамический импорт — пакет может отсутствовать в CI environment,
    // но обязателен в production (см. package.json deps).
    const nodemailerModule = await import("nodemailer").catch(() => null);
    if (!nodemailerModule) {
      console.error(
        "[mailer] nodemailer package is not installed. Run `npm install`.",
      );
      return null;
    }
    // nodemailer экспорт может быть default или named — берём то что есть.
    const nm = (nodemailerModule.default ?? nodemailerModule) as {
      createTransport: (opts: unknown) => Transporter;
    };

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

/**
 * Синхронная проверка наличия SMTP-конфигурации. Не подгружает nodemailer —
 * только смотрит ENV. Подходит для быстрых guard'ов в API-эндпоинтах.
 */
export function isMailerConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

export type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Отправить письмо. Возвращает true при успехе, false при отсутствии конфига
 * или ошибке. Никогда не throw'ит — call sites обрабатывают false как
 * "не отправилось", показывают юзеру generic-сообщение, в логах остаётся
 * причина.
 */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  const transporter = await getTransporter();
  if (!transporter) {
    console.warn(
      "[mailer] transporter недоступен (SMTP не настроен или пакет nodemailer отсутствует)",
    );
    return false;
  }

  const from = process.env.SMTP_FROM ?? "nitgen <noreply@nitgen.org>";

  try {
    await transporter.sendMail({
      from,
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
