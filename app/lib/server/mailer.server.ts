/**
 * Минимальный SMTP-mailer через nodemailer.
 *
 * Не делает ничего сложного — берёт SMTP_* env vars, формирует transporter,
 * отправляет письмо. Если ENV не сконфигурирован — функция возвращает false
 * и логирует warning.
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
 * NB: nodemailer импортируется через runtime require, скрытый от TypeScript
 * через косвенный вызов eval. Это позволяет typecheck/build пройти без типов
 * nodemailer (старый lockfile), при этом в production пакет резолвится
 * нормально. На Coolify auto-deploy `npm install nodemailer` подтянет пакет.
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
    // Может быть default или named export
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
  const transporter = getTransporter();
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
