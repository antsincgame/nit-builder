/**
 * htmlToPhp baker — детерминированный пост-процессор HTML → PHP.
 *
 * НА ВХОДЕ: HTML от Coder-а с data-edit="<id>" атрибутами и PlanEditableZone[].
 * НА ВЫХОДЕ:
 *   - phpIndex — исходный HTML с вставленными PHP-подстановками вместо размеченных узлов
 *   - defaults — Record<id, string> с исходным содержимым каждой зоны (для data/defaults.json)
 *   - matchedZones — список zones которые фактически нашлись в HTML
 *   - missingZones — zones из plan которых нет в HTML (Coder не разметил)
 *
 * ПРИНЦИП: этот модуль не вызывает LLM, не ходит в сеть, не имеет стохастики.
 * Чистая функция от (html, zones) → результат. Легко тестируется юнитами.
 *
 * ПОЧЕМУ Coder НЕ ГЕНЕРИРУЕТ PHP НАПРЯМУЮ:
 * 7B-модели путаются в PHP-экранировании («<\?php» против «<\?= ?>», живые вставки
 * в атрибуты, эскейп кавычек). Детерминированный парсер сделает это стабильно и
 * покрывается тестами.
 *
 * СТРАТЕГИЯ ПО ТИПАМ ЗОН:
 *   - text → innerText узла заменяется на <\?= e($c['id'] ?? 'дефолт') ?>
 *   - richtext → innerHTML узла заменяется на <\?= $c['id'] ?? '...' ?> (без e(), разрешён HTML)
 *   - image → src атрибут <img> заменяется на <\?= e($c['id'] ?? 'дефолт_url') ?>
 *
 * Атрибут data-edit снимается с узла после трансформации — он был служебным маркером.
 *
 * ПРЕФИКС PHP вставляется в самое начало файла (перед <!DOCTYPE html>):
 *   <?php require __DIR__ . '/admin/lib/store.php'; $c = nit_load_content(); ?>
 *
 * Модуль .server.ts — только для использования из server-side кода (route loaders/actions),
 *   не импортировать в клиентские компоненты.
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { PlanEditableZone } from "~/lib/utils/planSchema";

export type BakeResult = {
  /** index.php — исходный HTML с PHP-подстановками в размеченных зонах */
  phpIndex: string;
  /** дефолты — исходный контент каждой зоны, пишется в data/defaults.json */
  defaults: Record<string, string>;
  /** zones которые фактически нашлись и заменились */
  matchedZones: PlanEditableZone[];
  /** zones из plan для которых Coder не разметил узел (логгинг/eval) */
  missingZones: PlanEditableZone[];
};

/** PHP префикс, который вставляется в начало index.php. */
const PHP_PREFIX =
  "<?php require __DIR__ . '/admin/lib/store.php'; $c = nit_load_content(); ?>\n";

/**
 * Экранировать строку для PHP single-quoted literal.
 * PHP в single quotes интерпретирует только \\ и \' — всё остальное литерал.
 */
export function phpSingleQuote(s: string): string {
  return "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

/**
 * Снять data-edit атрибут и любые вспомогательные data-edit-* с узла.
 * На MVP вспомогательных нет (хватил одного data-edit), но вынесено в функцию
 * чтобы позже легко расширить (data-edit-type для list-ов и т.п.).
 */
function stripEditAttrs(node: HTMLElement): void {
  node.removeAttribute("data-edit");
}

/**
 * Обновить src у <img>, сохранив все остальные атрибуты.
 * Новое значение вставляется как-есть (PHP-вставка), атрибут не экранируется парсером.
 */
function setImgSrc(img: HTMLElement, phpValue: string): void {
  img.setAttribute("src", phpValue);
}

/**
 * Основная функция: выпечь PHP из HTML с data-edit разметкой.
 *
 * Для каждой zone из plan находим узел с [data-edit="<id>"] и применяем
 * трансформацию по типу. Если узла нет — zone пропускается (в missingZones).
 * Если узлов несколько — берём первый (служебное правило Coder: "ровно одиный на id").
 */
export function bakeHtmlToPhp(
  html: string,
  zones: PlanEditableZone[],
): BakeResult {
  const root = parse(html, {
    lowerCaseTagName: false,
    comment: true,
    voidTag: {
      // Дефолтный список void-тегов в node-html-parser; явно указываем
      // чтобы исключить лукавые баги парсера при обновлениях библиотеки.
      tags: [
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
      ],
      closingSlash: true,
    },
  });

  const matchedZones: PlanEditableZone[] = [];
  const missingZones: PlanEditableZone[] = [];
  const defaults: Record<string, string> = {};

  for (const zone of zones) {
    // node-html-parser поддерживает CSS-селекторы через querySelector.
    // Эскейп кавычек в id не нужен — zone.id валидирован регэкспом [a-z0-9_].
    const node = root.querySelector(`[data-edit="${zone.id}"]`) as HTMLElement | null;
    if (!node) {
      missingZones.push(zone);
      continue;
    }

    if (zone.type === "text") {
      // Для text берём innerText (текст без вложенных тегов) и обрезаем пробелы.
      // Если Coder вставил внутрь <span>, <strong> и т.п. — они схлопываются.
      // Это ОК, type=text по определению — плоская строка.
      const defaultText = node.text.trim();
      defaults[zone.id] = defaultText;
      node.set_content(
        `<?= e($c[${phpSingleQuote(zone.id)}] ?? ${phpSingleQuote(defaultText)}) ?>`,
      );
      stripEditAttrs(node);
      matchedZones.push(zone);
      continue;
    }

    if (zone.type === "richtext") {
      // Для richtext берём innerHTML — вложенные теги сохраняются как дефолт.
      // ПОД НИКАКИМИ обстоятельствами не экранируем в PHP (e()) — это и есть HTML.
      // Sanitize от пользователя делается на этапе сохранения в admin/edit.php.
      const defaultHtml = node.innerHTML.trim();
      defaults[zone.id] = defaultHtml;
      node.set_content(
        `<?= $c[${phpSingleQuote(zone.id)}] ?? ${phpSingleQuote(defaultHtml)} ?>`,
      );
      stripEditAttrs(node);
      matchedZones.push(zone);
      continue;
    }

    if (zone.type === "image") {
      // Для image ожидаем тег <img>. Если Coder ошибся и повесил data-edit на div
      // с background-image — пропускаем (в missingZones). MVP не пытается
      // спасать такие случаи — это видно в логах и поднимает вопрос к Coder-промпту.
      if (node.tagName !== "IMG") {
        missingZones.push(zone);
        continue;
      }
      const defaultSrc = node.getAttribute("src") ?? "";
      defaults[zone.id] = defaultSrc;
      setImgSrc(
        node,
        `<?= e($c[${phpSingleQuote(zone.id)}] ?? ${phpSingleQuote(defaultSrc)}) ?>`,
      );
      stripEditAttrs(node);
      matchedZones.push(zone);
      continue;
    }
  }

  // node-html-parser выводит весь исходный стреим (включая doctype и пробелы)
  // по дефолту. root.toString() = исходный HTML с нашими правками.
  const transformedHtml = root.toString();

  return {
    phpIndex: PHP_PREFIX + transformedHtml,
    defaults,
    matchedZones,
    missingZones,
  };
}
