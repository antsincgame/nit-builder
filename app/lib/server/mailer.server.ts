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
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure: process.env.SMTP_SECURE === "true" || port === "465",
    auth: { user, pass },
  });

  return cachedTransporter;
}

export function isMailerConfigured(): boolean {
  return getTransporter() !== null;
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
      "[mailer] SMTP не настроен (нет SMTP_HOST/PORT/USER/PASS) — письмо не отправлено",
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
