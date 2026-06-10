/**
 * Клиентское встраивание внешних картинок в HTML перед скачиванием.
 *
 * Зачем. Бандл-роут (/api/bundle) встраивает картинки на сервере, но если у
 * сервера закрыт egress к CDN (например images.unsplash.com), он отдаёт HTML
 * с внешними ссылками — и скачанный файл «без картинок» при оффлайн-открытии.
 * Браузер пользователя CDN видит (картинки грузятся в превью), поэтому тащим
 * их здесь: fetch → blob → data:-URI → подмена в HTML. Файл становится
 * автономным независимо от сетевых ограничений сервера.
 *
 * Устойчивость: всё best-effort. Любая проблема с конкретной картинкой (CORS,
 * 404, не-изображение, превышен лимит) → ссылка остаётся как была. Функция
 * никогда не бросает — скачивание не должно ломаться из-за инлайна.
 */

const MAX_IMAGES = 40;
const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ на картинку

/** Вытащить внешние http(s)-URL из <img src> и CSS url(). */
function extractExternalUrls(html: string): string[] {
  const urls = new Set<string>();
  const imgRe = /<img\b[^>]*?\ssrc=["'](https?:\/\/[^"'\s]+)["']/gi;
  const cssRe = /url\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) urls.add(m[1]!);
  while ((m = cssRe.exec(html)) !== null) urls.add(m[1]!);
  return [...urls].slice(0, MAX_IMAGES);
}

/** Скачать одну картинку и вернуть data:-URI, либо null при любой проблеме. */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (!blob.type.startsWith("image/")) return null;
    if (blob.size > MAX_BYTES) return null;
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () =>
        resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Встроить все внешние картинки HTML как data:-URI. Возвращает HTML с
 * подменёнными ссылками; недоступные картинки остаются внешними ссылками.
 */
export async function inlineExternalImages(html: string): Promise<string> {
  try {
    const urls = extractExternalUrls(html);
    if (urls.length === 0) return html;
    const dataUris = await Promise.all(urls.map(fetchAsDataUri));
    // Подменяем сначала длинные URL — короткий не должен «съесть» вложенный.
    const pairs = urls
      .map((url, i) => ({ url, dataUri: dataUris[i] ?? null }))
      .filter((p): p is { url: string; dataUri: string } => !!p.dataUri)
      .sort((a, b) => b.url.length - a.url.length);
    let out = html;
    for (const { url, dataUri } of pairs) {
      out = out.split(url).join(dataUri);
    }
    return out;
  } catch {
    return html;
  }
}
