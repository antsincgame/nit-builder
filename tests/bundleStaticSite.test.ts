import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => ({ address: "93.184.216.34", family: 4 })),
}));

import { bundleStaticSiteZip } from "~/lib/bake/bundle.server";

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NIT_BUNDLE_INLINE_IMAGES;
});

function mockImageFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(Buffer.from(PNG_1x1, "base64"), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
    ),
  );
}

async function externalImageRefs(zipBytes: Uint8Array): Promise<number> {
  const zip = await JSZip.loadAsync(zipBytes);
  let count = 0;
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (!entry || entry.dir || name.startsWith("assets/images/")) continue;
    const text = await entry.async("string");
    count += (text.match(/images\.unsplash\.com/gi) ?? []).length;
    count += (text.match(/picsum\.photos/gi) ?? []).length;
  }
  return count;
}

describe("bundleStaticSiteZip", () => {
  it("кладёт картинки в assets/images и убирает unsplash из index.html", async () => {
    mockImageFetch();
    const yoga = fs.readFileSync("app/templates/html/yoga-studio.html", "utf8");
    const result = await bundleStaticSiteZip(yoga);

    expect(result.imagesEmbedded).toBeGreaterThan(0);
    expect(result.imagesFailed).toBe(0);

    const zip = await JSZip.loadAsync(result.zip);
    expect(Object.keys(zip.files).some((p) => p.startsWith("assets/images/"))).toBe(true);

    const indexHtml = await zip.file("index.html")!.async("string");
    expect(indexHtml).toContain("assets/images/");
    expect(indexHtml).not.toContain("images.unsplash.com");
    expect(await externalImageRefs(result.zip)).toBe(0);
  });

  it("локализует Tailwind bg-[url(...)] в class и в CSS", async () => {
    mockImageFetch();
    const wedding = fs.readFileSync("app/templates/html/wedding.html", "utf8");
    const result = await bundleStaticSiteZip(wedding);

    const zip = await JSZip.loadAsync(result.zip);
    const indexHtml = await zip.file("index.html")!.async("string");
    expect(indexHtml).toContain("bg-[url('assets/images/");
    expect(indexHtml).not.toMatch(/bg-\[url\('https:\/\/images\.unsplash\.com/);
    expect(await externalImageRefs(result.zip)).toBe(0);
  });

  it("не качает script src как картинку", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(Buffer.from(PNG_1x1, "base64"), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wedding = fs.readFileSync("app/templates/html/wedding.html", "utf8");
    await bundleStaticSiteZip(wedding);

    const fetchSpy = fetchMock as unknown as { mock: { calls: Array<[string]> } };
    const fetchedUrls = fetchSpy.mock.calls.map((call) => call[0]);
    expect(fetchedUrls.some((u) => u.includes("alpinejs"))).toBe(false);
    expect(fetchedUrls.some((u) => u.includes("unsplash"))).toBe(true);
  });
});
