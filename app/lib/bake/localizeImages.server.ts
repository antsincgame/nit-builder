/**
 * Локализация внешних картинок при экспорте сайта.
 *
 * Сгенерированный HTML ссылается на Unsplash/picsum. При скачивании качаем
 * картинки в assets/images/ и переписываем URL на относительные пути — архив
 * работает офлайн без внешних CDN.
 *
 * Безопасность (SSRF): только http/https, блок приватных IP, лимиты размера.
 * Kill-switch: NIT_BUNDLE_INLINE_IMAGES=0 (историческое имя — отключает всю локализацию).
 */
import { lookup } from "node:dns/promises";
import net from "node:net";
import { collectImageUrls, replaceImageUrlsScoped } from "~/lib/utils/imageInline";

const MAX_IMAGES = 25;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 6 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_REDIRECTS = 3;
export const ASSETS_IMAGES_PREFIX = "assets/images/";

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
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true;
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

export type FetchedImage = {
  buffer: Buffer;
  contentType: string;
  ext: string;
};

/** Скачать одну картинку. null при любой проблеме (best-effort). */
export async function fetchExternalImage(url: string): Promise<FetchedImage | null> {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
    if (!(await isFetchableImageUrl(currentUrl))) return null;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(currentUrl, { signal: ctrl.signal, redirect: "manual" });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!res.ok) return null;
      const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const ext = extFromContentType(ct);
      if (!ext) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
      return { buffer: buf, contentType: ct, ext };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

function localizationDisabled(): boolean {
  return process.env.NIT_BUNDLE_INLINE_IMAGES === "0";
}

export type AssetImageFile = {
  path: string;
  content: Buffer;
};

export type LocalizeImagesToAssetsResult = {
  html: string;
  files: AssetImageFile[];
  embedded: number;
  failed: number;
};

/**
 * Скачать внешние картинки в assets/images/* и переписать URL в HTML.
 * Best-effort: неудачные URL остаются внешними ссылками.
 */
export async function localizeImagesToAssets(html: string): Promise<LocalizeImagesToAssetsResult> {
  if (localizationDisabled()) {
    return { html, files: [], embedded: 0, failed: 0 };
  }

  const urls = extractExternalImageUrls(html).slice(0, MAX_IMAGES);
  if (urls.length === 0) return { html, files: [], embedded: 0, failed: 0 };

  const fetched = await Promise.all(urls.map((u) => fetchExternalImage(u)));
  const map = new Map<string, string>();
  const files: AssetImageFile[] = [];
  let embedded = 0;
  let failed = 0;
  let totalBytes = 0;

  urls.forEach((url, i) => {
    const img = fetched[i];
    if (!img || totalBytes + img.buffer.length > MAX_TOTAL_BYTES) {
      failed++;
      return;
    }
    const name = `image-${String(i + 1).padStart(3, "0")}.${img.ext}`;
    const relPath = `${ASSETS_IMAGES_PREFIX}${name}`;
    files.push({ path: relPath, content: img.buffer });
    map.set(url, relPath);
    totalBytes += img.buffer.length;
    embedded++;
  });

  return {
    html: replaceImageUrlsScoped(html, map),
    files,
    embedded,
    failed,
  };
}

export type InlineImagesResult = {
  html: string;
  embedded: number;
  failed: number;
};

/** @deprecated Используй localizeImagesToAssets — экспорт теперь кладёт файлы в assets/. */
export async function inlineImagesAsDataUris(html: string): Promise<InlineImagesResult> {
  if (localizationDisabled()) {
    return { html, embedded: 0, failed: 0 };
  }
  const urls = extractExternalImageUrls(html).slice(0, MAX_IMAGES);
  if (urls.length === 0) return { html, embedded: 0, failed: 0 };

  const fetched = await Promise.all(urls.map((u) => fetchExternalImage(u)));
  const map = new Map<string, string>();
  let embedded = 0;
  let failed = 0;
  let totalBytes = 0;

  urls.forEach((url, i) => {
    const img = fetched[i];
    if (!img) {
      failed++;
      return;
    }
    const dataUri = `data:${img.contentType};base64,${img.buffer.toString("base64")}`;
    if (totalBytes + dataUri.length <= MAX_TOTAL_BYTES) {
      map.set(url, dataUri);
      totalBytes += dataUri.length;
      embedded++;
    } else {
      failed++;
    }
  });

  return { html: replaceImageUrlsScoped(html, map), embedded, failed };
}
