/**
 * Детерминированная подстановка картинок шаблона в сгенерированный HTML.
 *
 * Зачем: на coder-пути слабая модель (7B) переписывает <img src> на
 * галлюцинированные/нерелевантные Unsplash-ссылки (кофейне — горы, барбершопу —
 * мёртвый лес), а битые ссылки fixBrokenImages меняет на случайный picsum.
 * Промпт-правило «сохраняй картинки шаблона» слабая модель игнорит.
 *
 * Решение: берём упорядоченный список картинок ИЗ ШАБЛОНА (они курированы под
 * нишу) и проставляем их в КОНТЕНТНЫЕ <img> вывода по порядку, циклически если
 * в выводе картинок больше. Модель по-прежнему генерит вёрстку и тексты — мы
 * лишь гарантируем релевантные фото. Ниша-агностично: работает для любого
 * шаблона, у которого есть <img> с http(s)-src.
 *
 * Логотипы, иконки и аватары НЕ трогаем (иначе логотип бренда превратился бы в
 * фото барбера, а иконка фичи — в стоковый пейзаж): пропускаем <img> с
 * признаками logo/icon/avatar в alt/class, мелким заданным размером (<100px)
 * или мелким tailwind-классом размера (№6 v4).
 *
 * Позиционное соответствие приблизительное (модель может переставить секции),
 * но ВСЕ картинки шаблона релевантны нише, поэтому даже при сдвиге вывод
 * получает фото по теме, а не случайный лес. Если у шаблона нет картинок
 * (SVG/CSS-фон) или в выводе нет контентных <img> — строгий no-op.
 *
 * Чистые строковые операции, без node-API — модуль юнит-тестируем.
 */

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i;
const SRCSET_ATTR_RE = /\ssrcset\s*=\s*("[^"]*"|'[^']*')/i;
const ALT_ATTR_RE = /\salt\s*=\s*("([^"]*)"|'([^']*)')/i;
const CLASS_ATTR_RE = /\sclass\s*=\s*("([^"]*)"|'([^']*)')/i;

// Признаки НЕ-контентной картинки (логотип/иконка/аватар) в alt или class —
// такие <img> подменять курированными фото шаблона нельзя.
const NON_CONTENT_HINT_RE =
  /logo|icon|avatar|favicon|badge|brand[-\s]?mark|sprite|emoji|лого|иконк|значок|аватар|rounded-full/i;
// Мелкий tailwind-класс размера (w-4..w-16 ≈ 16-64px) — почти всегда иконка или
// аватар. Дроби (w-1/2) и крупные (w-24, h-64) НЕ попадают.
const SMALL_TW_SIZE_RE = /\b[wh]-(?:[4-9]|1[0246])\b/;
// Заданный числовой размер <100px — иконка/аватар, не контентное фото.
const WIDTH_ATTR_RE = /\swidth\s*=\s*["']?(\d+)/i;
const HEIGHT_ATTR_RE = /\sheight\s*=\s*["']?(\d+)/i;

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

function imgAttrValue(tag: string, re: RegExp): string {
  const m = tag.match(re);
  return m ? (m[2] ?? m[3] ?? "") : "";
}

/**
 * Контентное ли это <img> (фото, которое можно заменить картинкой шаблона), в
 * отличие от логотипа/иконки/аватара, которые надо оставить как есть.
 */
export function isContentPhoto(tag: string): boolean {
  const alt = imgAttrValue(tag, ALT_ATTR_RE);
  const cls = imgAttrValue(tag, CLASS_ATTR_RE);
  if (NON_CONTENT_HINT_RE.test(alt) || NON_CONTENT_HINT_RE.test(cls)) return false;
  if (SMALL_TW_SIZE_RE.test(cls)) return false;
  const wM = tag.match(WIDTH_ATTR_RE);
  const hM = tag.match(HEIGHT_ATTR_RE);
  const w = wM ? parseInt(wM[1]!, 10) : NaN;
  const h = hM ? parseInt(hM[1]!, 10) : NaN;
  if ((Number.isFinite(w) && w < 100) || (Number.isFinite(h) && h < 100)) return false;
  return true;
}

export type RestoreResult = { html: string; restored: number };

/**
 * Проставить картинки шаблона в КОНТЕНТНЫЕ <img> сгенерированного HTML по
 * порядку. Логотипы/иконки/аватары пропускаем. srcset у затронутых <img>
 * убираем — иначе браузер подтянет старую картинку.
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
    // Логотип/иконку/аватар не трогаем — иначе бренд-лого станет фото барбера.
    if (!isContentPhoto(tag)) return tag;
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
