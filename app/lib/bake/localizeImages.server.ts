/**
 * Локализация внешних картинок в standalone-HTML.
 *
 * Проблема: сгенерированный сайт ссылается на внешние картинки (Unsplash и пр.)
 * через URL. Скачанный файл зависит от того, что CDN жив и доступен. Юзер хочет
 * самодостаточный артефакт — картинки внутри файла, а не ссылками.
 *
 * Решение: находим внешние http(s)-картинки (<img src>, inline style url()),
 * скачиваем и встраиваем как data:-URI прямо в HTML. Один файл — заливай куда
 * угодно, ничего не отвалится.
 *
 * Безопасность (SSRF): HTML генерится LLM, URL могут быть произвольными. Поэтому:
 *   - только http/https-схемы;
 *   - резолвим хост и блокируем приватные/loopback/link-local IP (в т.ч.
 *     metadata-эндпоинт 169.254.169.254, localhost, LAN, CGNAT);
 *   - таймаут на запрос, лимит размера одной картинки и их количества;
 *   - принимаем только content-type image/*.
 * Остаточный риск DNS-rebinding (публичный хост резолвится в приватный IP между
 * проверкой и фетчем) считаем приемлемым: качаем картинки лендингов, не секреты.
 *
 * Поведение best-effort: любая неудача по конкретной картинке — оставляем её
 * исходной ссылкой, генерацию/экспорт не валим. Kill-switch: NIT_BUNDLE_INLINE_IMAGES=0.
 *
 * Модуль .server.ts — только server-side (зависит от node:dns, node:net, fetch).
 */
import { lookup } from "node:dns/promises";
import net from "node:net";
import { collectImageUrls, replaceImageUrlsScoped } from "~/lib/utils/imageInline";

const MAX_IMAGES = 25;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB на картинку — Unsplash ?w=800 куда меньше
const FETCH_TIMEOUT_MS = 10_000;

/** Собрать уникальные внешние URL картинок из HTML (<img src>, srcset, url()). */
export function extractExternalImageUrls(html: string): string[] {
  return collectImageUrls(html);
}

/** IP в приватном/loopback/link-local диапазоне? Невалидный → считаем небезопасным. */
export function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // не IP — резолв сделает вызывающий
}

async function isSafeHost(hostname: string): Promise<boolean> {
  const h = hostname.toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (net.isIP(h)) return !isPrivateIp(h);
  try {
    const { address } = await lookup(h);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}

/** content-type image/* → расширение (для отладки/имён); null если не картинка. */
function extFromContentType(ct: string): string | null {
  switch (ct) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/avif":
      return "avif";
    default:
      return null;
  }
}

/** Максимум хопов редиректа при скачивании картинки. */
const MAX_IMAGE_REDIRECTS = 3;

/** http(s)-схема + не приватный хост. Проверяется на КАЖДОМ хопе редиректа. */
async function isFetchableImageUrl(rawUrl: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  return isSafeHost(u.hostname);
}

/** Скачать одну картинку → data:-URI. null при любой проблеме (best-effort). */
async function fetchAsDataUri(url: string): Promise<string | null> {
  // Редиректы обрабатываем ВРУЧНУЮ с повторной проверкой хоста на каждом хопе.
  // С redirect:"follow" исходный публичный URL мог ответить 302 на
  // http://169.254.169.254/ (cloud metadata) или на внутренний IP, и проверка
  // хоста (сделанная только для исходного URL) это не ловила — прямой
  // redirect-SSRF. Теперь каждый Location валидируется как новый URL.
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
    if (!(await isFetchableImageUrl(currentUrl))) return null;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(currentUrl, { signal: ctrl.signal, redirect: "manual" });

      // 3xx + Location → валидируем новый хост и идём дальше (до лимита хопов).
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!res.ok) return null;
      const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!extFromContentType(ct)) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
      return `data:${ct};base64,${Buffer.from(buf).toString("base64")}`;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // Превышен лимит редиректов — не скачиваем.
  return null;
}

export type InlineImagesResult = {
  /** HTML с встроенными data:-URI вместо доживших до встраивания ссылок. */
  html: string;
  /** Сколько картинок успешно встроено. */
  embedded: number;
  /** Сколько не удалось (остались ссылками). */
  failed: number;
};

/**
 * Встроить внешние картинки HTML как data:-URI. Best-effort, gated NIT_BUNDLE_INLINE_IMAGES.
 * Дубли одного URL заменяются все разом. Порядок и разметка не меняются.
 */
export async function inlineImagesAsDataUris(html: string): Promise<InlineImagesResult> {
  if (process.env.NIT_BUNDLE_INLINE_IMAGES === "0") {
    return { html, embedded: 0, failed: 0 };
  }
  const urls = extractExternalImageUrls(html).slice(0, MAX_IMAGES);
  if (urls.length === 0) return { html, embedded: 0, failed: 0 };

  const dataUris = await Promise.all(urls.map((u) => fetchAsDataUri(u)));

  // Подменяем только в безопасных зонах (src/srcset/<style>/inline-style), не
  // трогая class-атрибуты Tailwind bg-[url(...)] — иначе ломается CSS-селектор
  // и фон исчезает (см. imageInline). Длинные URL заменяются раньше коротких.
  const map = new Map<string, string>();
  let embedded = 0;
  let failed = 0;
  urls.forEach((url, i) => {
    const dataUri = dataUris[i];
    if (dataUri) {
      map.set(url, dataUri);
      embedded++;
    } else {
      failed++;
    }
  });
  const out = replaceImageUrlsScoped(html, map);
  return { html: out, embedded, failed };
}
