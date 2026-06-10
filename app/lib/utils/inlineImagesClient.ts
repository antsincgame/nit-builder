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
 * Сбор URL и подмена вынесены в общий чистый хелпер imageInline: подмена идёт
 * только в безопасных зонах (src/srcset/<style>/inline-style), без class-
 * атрибутов Tailwind bg-[url(...)], иначе ломается CSS-селектор и фон исчезает.
 *
 * Устойчивость: всё best-effort. Любая проблема с конкретной картинкой (CORS,
 * 404, не-изображение, превышен лимит) → ссылка остаётся как была. Функция
 * никогда не бросает — скачивание не должно ломаться из-за инлайна.
 */
import { collectImageUrls, replaceImageUrlsScoped } from "~/lib/utils/imageInline";

const MAX_IMAGES = 40;
const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ на картинку

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
 * Встроить внешние картинки HTML как data:-URI. Возвращает HTML с подменёнными
 * ссылками; недоступные картинки остаются внешними ссылками.
 */
export async function inlineExternalImages(html: string): Promise<string> {
  try {
    const urls = collectImageUrls(html).slice(0, MAX_IMAGES);
    if (urls.length === 0) return html;
    const dataUris = await Promise.all(urls.map(fetchAsDataUri));
    const map = new Map<string, string>();
    urls.forEach((url, i) => {
      const dataUri = dataUris[i];
      if (dataUri) map.set(url, dataUri);
    });
    return replaceImageUrlsScoped(html, map);
  } catch {
    return html;
  }
}
