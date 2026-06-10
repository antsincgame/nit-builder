/**
 * Чистые строковые помощники инлайна картинок (общие для серверного бандла и
 * клиентского скачивания). Без node/browser-API — юнит-тестируемо.
 *
 * Главный нюанс (№5): подменять URL картинки на data:-URI можно ТОЛЬКО в
 * «безопасных» зонах — значениях src/srcset у <img>, в url() внутри
 * <style>-блоков и в inline style="" атрибутах. Категорически нельзя трогать
 * class-атрибуты: у Tailwind фон задаётся произвольным классом
 * `bg-[url('https://...')]`, и этот же URL после компиляции попадает в
 * CSS-селектор в ЭКРАНИРОВАННОМ виде (`https\:\/\/...`). Если подменить URL в
 * имени класса (незаэкранированный), селектор перестаёт соответствовать
 * элементу и фон исчезает. Экранированный селектор при этом не матчит
 * незаэкранированный ключ, поэтому замена в декларации `background-image:url(...)`
 * безопасна, а в имени класса — нет.
 */

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const STYLE_ATTR_RE = /style\s*=\s*("[^"]*"|'[^']*')/gi;
const SRC_URL_RE = /\bsrc\s*=\s*["'](https?:\/\/[^"'\s]+)["']/gi;
const SRCSET_ATTR_RE = /\bsrcset\s*=\s*("[^"]*"|'[^']*')/gi;
const CSS_URL_RE = /url\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)/gi;

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "");
}

/** Уникальные внешние http(s)-URL картинок: <img src>, srcset, CSS url(). */
export function collectImageUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(SRC_URL_RE)) urls.add(m[1]!);
  for (const m of html.matchAll(SRCSET_ATTR_RE)) {
    for (const part of stripQuotes(m[1]!).split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u && /^https?:\/\//i.test(u)) urls.add(u);
    }
  }
  for (const m of html.matchAll(CSS_URL_RE)) urls.add(m[1]!);
  return [...urls];
}

/** Заменить все ключи map в строке; длинные URL раньше коротких (префикс-защита). */
function replaceLongestFirst(text: string, map: Map<string, string>): string {
  let t = text;
  for (const [url, dataUri] of [...map.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    if (t.includes(url)) t = t.split(url).join(dataUri);
  }
  return t;
}

/**
 * Подменяет внешние URL картинок на data:-URI только в безопасных зонах:
 *   - src/srcset внутри <img>
 *   - url(...) внутри <style>-блоков (скомпилированные Tailwind-фоны)
 *   - url(...) внутри inline style="" атрибутов
 * class-атрибуты не трогаются (см. заголовок модуля).
 */
export function replaceImageUrlsScoped(
  html: string,
  map: Map<string, string>,
): string {
  if (map.size === 0) return html;
  let out = html.replace(IMG_TAG_RE, (tag) => replaceLongestFirst(tag, map));
  out = out.replace(STYLE_BLOCK_RE, (block) => replaceLongestFirst(block, map));
  out = out.replace(STYLE_ATTR_RE, (attr) => replaceLongestFirst(attr, map));
  return out;
}
