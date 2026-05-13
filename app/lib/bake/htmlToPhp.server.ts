/**
 * htmlToPhp baker — детерминированный пост-процессор HTML → PHP.
 *
 * НА ВХОДЕ: HTML от Coder-а с data-edit=\"<id>\" атрибутами и PlanEditableZone[].
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
 * 7B-модели путаются в PHP-экранировании («<?php» против «<?= ?>», живые вставки
 * в атрибуты, эскейп кавычек). Детерминированный парсер сделает это стабильно и
 * покрывается тестами.
 *
 * СТРАТЕГИЯ ПО ТИПАМ ЗОН:
 *   - text → innerText узла заменяется на <?= e($c['id'] ?? 'дефолт') ?>
 *   - richtext → innerHTML узла заменяется на <?= $c['id'] ?? '...' ?> (без e(), разрешён HTML)
 *   - image → src атрибут <img> заменяется на <?= e($c['id'] ?? 'дефолт_url') ?>
 *
 * Атрибуты data-edit, data-edit-type, data-edit-label снимаются с узла после
 * трансформации — они были служебными маркерами для Coder/baker.
 *
 * МАРКЕРНЫЙ ПОДХОД ВМЕСТО ПРЯМОЙ ВСТАВКИ PHP:
 * node-html-parser метод set_content() парсит входную строку как HTML, что
 * непредсказуемо обработает PHP-вставку `<?= ?>` (интерпретируется как XML
 * processing instruction). Вместо прямой вставки PHP — записываем уникальный
 * текстовый маркер `__NIT_PHP_<bake-id>_<zone-id>_<kind>__`, который парсер
 * сохраняет как plain text. После root.toString() заменяем маркеры на реальные
 * PHP-выражения через string-replace. Это гарантированно работает независимо
 * от поведения парсера на нестандартных конструкциях.
 *
 * bake-id — случайный 8-символьный nonce на каждый вызов, исключает теоретическую
 * коллизию маркера с содержимым (вероятность ~10^-14).
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
 * Снять служебные data-edit-* атрибуты с узла после трансформации.
 * Все три атрибута (data-edit, data-edit-type, data-edit-label) ставит Coder
 * как маркеры для нас — в финальном HTML они не нужны и являются мусором.
 */
function stripEditAttrs(node: HTMLElement): void {
  node.removeAttribute("data-edit");
  node.removeAttribute("data-edit-type");
  node.removeAttribute("data-edit-label");
}

/**
 * Сгенерировать уникальный bake-id для маркеров. 8 символов из base36 ≈ 10^14
 * комбинаций — коллизия с содержимым практически невозможна.
 */
function generateBakeId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

/**
 * Основная функция: выпечь PHP из HTML с data-edit разметкой.
 *
 * Для каждой zone из plan находим узел с [data-edit="<id>"] и применяем
 * трансформацию по типу. Если узла нет — zone пропускается (в missingZones).
 * Если узлов несколько — берём первый (служебное правило Coder: "ровно один на id").
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

  // Карта маркер → реальное PHP-выражение. После root.toString() пройдёмся
  // string-replace и подставим выражения. Подход гарантированно безопасен
  // относительно поведения HTML-парсера на нестандартных вставках.
  const phpExpressions: Record<string, string> = {};
  const bakeId = generateBakeId();
  const makeMarker = (zoneId: string, kind: "T" | "R" | "I"): string =>
    `__NIT_PHP_${bakeId}_${zoneId}_${kind}__`;

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
      const marker = makeMarker(zone.id, "T");
      phpExpressions[marker] =
        `<?= e($c[${phpSingleQuote(zone.id)}] ?? ${phpSingleQuote(defaultText)}) ?>`;
      node.set_content(marker);
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
      const marker = makeMarker(zone.id, "R");
      phpExpressions[marker] =
        `<?= $c[${phpSingleQuote(zone.id)}] ?? ${phpSingleQuote(defaultHtml)} ?>`;
      node.set_content(marker);
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
      const marker = makeMarker(zone.id, "I");
      phpExpressions[marker] =
        `<?= e($c[${phpSingleQuote(zone.id)}] ?? ${phpSingleQuote(defaultSrc)}) ?>`;
      // Маркер не содержит символов которые парсер захотел бы экранировать
      // (& < > "). После toString() значение src останется как plain string.
      node.setAttribute("src", marker);
      stripEditAttrs(node);
      matchedZones.push(zone);
      continue;
    }
  }

  // node-html-parser выводит весь исходный стрим (включая doctype и пробелы)
  // по дефолту. root.toString() = исходный HTML с нашими правками.
  let transformedHtml = root.toString();

  // Финальная подстановка маркеров на реальные PHP-выражения.
  // replaceAll потому что маркер для image-зоны может встретиться один раз
  // (в атрибуте src), для text/richtext тоже один раз (в textNode).
  for (const [marker, expr] of Object.entries(phpExpressions)) {
    transformedHtml = transformedHtml.split(marker).join(expr);
  }

  return {
    phpIndex: PHP_PREFIX + transformedHtml,
    defaults,
    matchedZones,
    missingZones,
  };
}
