import { describe, it, expect, vi, afterEach } from "vitest";

// dns-резолв мокаем на публичный IP, чтобы хостнеймы проходили SSRF-гард без сети.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => ({ address: "93.184.216.34", family: 4 })),
}));

import {
  extractExternalImageUrls,
  isPrivateIp,
  inlineImagesAsDataUris,
  localizeImagesToAssets,
  ASSETS_IMAGES_PREFIX,
} from "./localizeImages.server";

// 1x1 прозрачный PNG.
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const okImageFetch = () =>
  vi.fn(
    async () =>
      new Response(Buffer.from(PNG_1x1, "base64"), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NIT_BUNDLE_INLINE_IMAGES;
});

describe("extractExternalImageUrls", () => {
  it("ловит <img src> и url() из inline-стилей, дедупит", () => {
    const html = `<img src="https://images.unsplash.com/a.jpg?w=800" alt="x">
      <div style="background:url('https://cdn.example.com/b.png')"></div>
      <img src="https://images.unsplash.com/a.jpg?w=800">`;
    const urls = extractExternalImageUrls(html);
    expect(urls).toContain("https://images.unsplash.com/a.jpg?w=800");
    expect(urls).toContain("https://cdn.example.com/b.png");
    expect(urls).toHaveLength(2);
  });

  it("игнорирует относительные и data:-src", () => {
    const html = `<img src="/local.png"><img src="data:image/png;base64,AAAA">`;
    expect(extractExternalImageUrls(html)).toHaveLength(0);
  });
});

describe("isPrivateIp", () => {
  it("приватные/loopback/link-local → true", () => {
    for (const ip of [
      "127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1",
      "169.254.169.254", "::1", "fe80::1", "fd00::1",
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it("публичные → false", () => {
    for (const ip of ["8.8.8.8", "93.184.216.34", "1.1.1.1"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});

describe("inlineImagesAsDataUris", () => {
  it("встраивает валидную картинку как data:-URI", async () => {
    vi.stubGlobal("fetch", okImageFetch());
    const html = `<img src="https://images.unsplash.com/a.jpg?w=800" alt="x">`;
    const res = await inlineImagesAsDataUris(html);
    expect(res.embedded).toBe(1);
    expect(res.failed).toBe(0);
    expect(res.html).toContain("data:image/png;base64,");
    expect(res.html).not.toContain("https://images.unsplash.com/a.jpg");
  });

  it("SSRF: приватный IP-хост не фетчится и остаётся ссылкой", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const html = `<img src="https://169.254.169.254/latest/meta-data/">`;
    const res = await inlineImagesAsDataUris(html);
    expect(spy).not.toHaveBeenCalled();
    expect(res.embedded).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.html).toContain("169.254.169.254");
  });

  it("не-картиночный content-type не встраивается", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    const html = `<img src="https://evil.example.com/page.html">`;
    const res = await inlineImagesAsDataUris(html);
    expect(res.embedded).toBe(0);
    expect(res.html).toContain("https://evil.example.com/page.html");
  });

  it("kill-switch NIT_BUNDLE_INLINE_IMAGES=0 → no-op без фетчей", async () => {
    process.env.NIT_BUNDLE_INLINE_IMAGES = "0";
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const html = `<img src="https://images.unsplash.com/a.jpg">`;
    const res = await inlineImagesAsDataUris(html);
    expect(spy).not.toHaveBeenCalled();
    expect(res).toEqual({ html, embedded: 0, failed: 0 });
  });

  it("упавший fetch → graceful, ссылка остаётся", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const html = `<img src="https://images.unsplash.com/a.jpg">`;
    const res = await inlineImagesAsDataUris(html);
    expect(res.embedded).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.html).toContain("https://images.unsplash.com/a.jpg");
  });

  it("длинный URL не бьётся коротким URL-префиксом (замена длинных раньше)", async () => {
    vi.stubGlobal("fetch", okImageFetch());
    const short = "https://images.unsplash.com/photo-1?w=400";
    const long = "https://images.unsplash.com/photo-1?w=400&fit=crop";
    const html = `<img src="${short}"><img src="${long}">`;
    const res = await inlineImagesAsDataUris(html);
    expect(res.embedded).toBe(2);
    expect(res.failed).toBe(0);
    expect(res.html).not.toContain(long);
    expect(res.html).not.toContain("fit=crop"); // нет осколка от побитого длинного URL
    expect(res.html).toContain("data:image/png;base64,");
  });
});

describe("localizeImagesToAssets", () => {
  it("скачивает картинки в assets/images/ и переписывает src", async () => {
    vi.stubGlobal("fetch", okImageFetch());
    const html = `<img src="https://images.unsplash.com/a.jpg?w=800" alt="x">`;
    const res = await localizeImagesToAssets(html);
    expect(res.embedded).toBe(1);
    expect(res.failed).toBe(0);
    expect(res.files).toHaveLength(1);
    expect(res.files[0]?.path).toMatch(new RegExp(`^${ASSETS_IMAGES_PREFIX}image-001\\.png$`));
    expect(res.html).toContain(`${ASSETS_IMAGES_PREFIX}image-001.png`);
    expect(res.html).not.toContain("https://images.unsplash.com/a.jpg");
  });

  it("kill-switch NIT_BUNDLE_INLINE_IMAGES=0 → no-op", async () => {
    process.env.NIT_BUNDLE_INLINE_IMAGES = "0";
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const html = `<img src="https://images.unsplash.com/a.jpg">`;
    const res = await localizeImagesToAssets(html);
    expect(spy).not.toHaveBeenCalled();
    expect(res.files).toHaveLength(0);
  });
});
