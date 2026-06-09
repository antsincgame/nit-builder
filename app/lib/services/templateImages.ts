/**
 * Детерминированная подстановка картинок шаблона в сгенерированный HTML.
 *
 * Зачем: на coder-пути слабая модель (7B) переписывает <img src> на
 * галлюцинированные/нерелевантные Unsplash-ссылки (кофейне — горы, барбершопу —
 * мёртвый лес), а битые ссылки fixBrokenImages меняет на случайный picsum.
 * Промпт-правило «сохраняй картинки шаблона» слабая модель игнорит.
 *
 * Решение: берём упорядоченный список картинок ИЗ ШАБЛОНА (они курированы под
 * нишу) и проставляем их в <img> вывода по порядку, циклически если в выводе
 * картинок больше. Модель по-прежнему генерит вёрстку и тексты — мы лишь
 * гарантируем релевантные фото. Ниша-агностично: работает для любого шаблона,
 * у которого есть <img> с http(s)-src.
 *
 * Позиционное соответствие приблизительное (модель может переставить секции),
 * но ВСЕ картинки шаблона релевантны нише, поэтому даже при сдвиге вывод
 * получает фото по теме, а не случайный лес. Если у шаблона нет картинок
 * (SVG/CSS-фон) или в выводе нет <img> — строгий no-op.
 *
 * Чистые строковые операции, без node-API — модуль юнит-тестируем.
 */

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i;
const SRCSET_ATTR_RE = /\ssrcset\s*=\s*("[^"]*"|'[^']*')/i;

/** Упорядоченные http(s)-src всех <img> в HTML (относительные и data:-src пропускаем). */
export function extractImgSrcs(html: string): string[] {
  const out: string[] = [];
  const tags = html.match(IMG_TAG_RE);
  if (!tags) return out;
  for (const tag of tags) {
    const m = tag.match(SRC_ATTR_RE);
    const src = m ? (m[2] ?? m[3] ?? "") : "";
    if (/^https?:\/\//i.test(src)) out.push(src);
  }
  return out;
}

export type RestoreResult = { html: string; restored: number };

/**
 * Проставить картинки шаблона в <img> сгенерированного HTML по порядку.
 * srcset у затронутых <img> убираем — иначе браузер подтянет старую картинку.
 */
export function restoreTemplateImages(
  generatedHtml: string,
  templateHtml: string,
): RestoreResult {
  const templateSrcs = extractImgSrcs(templateHtml);
  if (templateSrcs.length === 0) return { html: generatedHtml, restored: 0 };

  let idx = 0;
  let restored = 0;
  const html = generatedHtml.replace(IMG_TAG_RE, (tag) => {
    const next = templateSrcs[idx % templateSrcs.length]!;
    idx++;
    restored++;
    // Функция-замена, чтобы $ в URL не интерпретировался как спецсимвол.
    let out = SRC_ATTR_RE.test(tag)
      ? tag.replace(SRC_ATTR_RE, () => ` src="${next}"`)
      : tag.replace(/<img\b/i, () => `<img src="${next}"`);
    out = out.replace(SRCSET_ATTR_RE, "");
    return out;
  });
  return { html, restored };
}
