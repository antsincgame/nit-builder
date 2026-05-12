/**
 * Tailwind compile-step для генерируемых сайтов.
 *
 * Проблема: Coder LLM выдаёт HTML, который тащит Tailwind CDN-скрипт
 * (cdn.tailwindcss.com). В проде это — ~300 KB неминифицированного JS,
 * блокирующий рендер, без purge. Lighthouse mobile проседает по LCP.
 *
 * Решение: после генерации натравливаем Tailwind v4 compiler на готовый
 * HTML, получаем минифицированный CSS только с реально используемыми
 * классами (~8–15 KB), встраиваем inline в <head> и убираем CDN-скрипт.
 *
 * Реализация: пишем HTML во временный файл и подаём его как @source
 * Tailwind’у через @tailwindcss/postcss. Скан классов делает сам Tailwind
 * (умеет лучше любого regex — ловит `class:list={[]}`, динамические
 * строки, шаблоны и пр.).
 *
 * Модуль server-only (зависит от node:fs, node:os). НЕ импортировать
 * из клиентских компонентов — только из route loaders/actions и api.*.ts.
 */
import postcss from "postcss";
import tailwindcssPostcss from "@tailwindcss/postcss";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Регэксп для удаления <script src="cdn.tailwindcss.com ..."> в любых вариантах. */
const TAILWIND_CDN_RE =
  /<script[^>]*src=["']https?:\/\/cdn\.tailwindcss\.com[^"']*["'][^>]*><\/script>\s*/gi;

/**
 * Скомпилировать минимальный CSS под классы, реально встречающиеся в HTML.
 *
 * @param html — готовый HTML целиком (от <!DOCTYPE html> до </html>)
 * @returns строка CSS (уже с базой Tailwind preflight + только нужные утилиты)
 */
export async function compileTailwindForHtml(html: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "nit-tw-"));
  const htmlPath = join(dir, "input.html");
  try {
    await writeFile(htmlPath, html, "utf8");
    // source(none) — отключаем дефолтное автосканирование (мы не в проекте
    // с глобами), затем явно указываем единственный source-файл.
    const src = `@import "tailwindcss" source(none);\n@source "${htmlPath}";\n`;
    const result = await postcss([tailwindcssPostcss()]).process(src, {
      from: undefined,
    });
    return result.css;
  } finally {
    // tmpdir чистим всегда, даже при ошибке компиляции.
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Встроить скомпилированный CSS inline в HTML и удалить Tailwind CDN-скрипт.
 *
 * Поведение по форме HTML:
 *   - есть </head> — вставляем <style> перед закрытием head (предпочтительно)
 *   - нет </head>, есть <body> — вставляем сразу после <body ...>
 *   - и того и другого нет — кладём в самое начало (фрагмент)
 */
export function inlineCompiledCss(html: string, css: string): string {
  const stripped = html.replace(TAILWIND_CDN_RE, "");
  const styleTag = `<style>${css}</style>`;
  if (/<\/head>/i.test(stripped)) {
    return stripped.replace(/<\/head>/i, `${styleTag}\n</head>`);
  }
  if (/<body[^>]*>/i.test(stripped)) {
    return stripped.replace(/<body([^>]*)>/i, `<body$1>\n${styleTag}`);
  }
  return `${styleTag}\n${stripped}`;
}

/**
 * Полный flow: скомпилировать Tailwind CSS под HTML и встроить inline.
 *
 * Используется в /api/bundle для standalone-выдачи (single HTML файл,
 * который можно залить на любой статический хостинг без CDN-зависимостей).
 */
export async function bakeStandaloneHtml(html: string): Promise<string> {
  const css = await compileTailwindForHtml(html);
  return inlineCompiledCss(html, css);
}
