import { describe, it, expect, vi, afterEach } from "vitest";
import JSZip from "jszip";
import { bundlePhp, generateSetupFilename } from "~/lib/bake/bundle.server";
import type { PlanEditableZone } from "~/lib/utils/planSchema";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => ({ address: "93.184.216.34", family: 4 })),
}));

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NIT_BUNDLE_INLINE_IMAGES;
});

// Минимальный HTML с одной размеченной зоной — достаточно для bundlePhp
// (baker найдёт зону, Tailwind compile прогонит, JSZip соберёт архив).
const MINIMAL_HTML = `<!DOCTYPE html>
<html><head><title>t</title></head><body>
  <h1 data-edit="title" data-edit-type="text" data-edit-label="Заголовок">Hello</h1>
</body></html>`;

const ZONES: PlanEditableZone[] = [
  { id: "title", type: "text", label: "Заголовок", section: "general" },
];

describe("generateSetupFilename", () => {
  it("формат: setup-<8 hex>.php", () => {
    const name = generateSetupFilename();
    expect(name).toMatch(/^setup-[0-9a-f]{8}\.php$/);
  });

  it("каждый вызов даёт новое имя (CSPRNG)", () => {
    const names = new Set<string>();
    for (let i = 0; i < 50; i++) names.add(generateSetupFilename());
    // 50 значений из 2^32 — коллизий быть не должно
    expect(names.size).toBe(50);
  });
});

describe("bundlePhp setup-file rename (race-window mitigation)", () => {
  it("кладёт setup-файл под рандомным именем, оригинального setup.php в архиве нет", async () => {
    const result = await bundlePhp({ html: MINIMAL_HTML, zones: ZONES });
    expect(result.setupFilename).toMatch(/^setup-[0-9a-f]{8}\.php$/);

    const zip = await JSZip.loadAsync(result.zip);
    expect(zip.files["setup.php"]).toBeUndefined();
    expect(zip.files[result.setupFilename]).toBeDefined();
  });

  it("содержимое setup-файла ссылается на своё новое имя, не на setup.php", async () => {
    const result = await bundlePhp({ html: MINIMAL_HTML, zones: ZONES });
    const zip = await JSZip.loadAsync(result.zip);

    const setupContent = await zip.file(result.setupFilename)!.async("string");
    // Все user-facing подсказки внутри setup.php должны указывать новое имя
    expect(setupContent).toContain(result.setupFilename);
    // И не должны упоминать оригинальное setup.php (literal substring)
    expect(setupContent).not.toContain("setup.php");
  });

  it("README.md в архиве переписан под новое имя setup-файла", async () => {
    const result = await bundlePhp({ html: MINIMAL_HTML, zones: ZONES });
    const zip = await JSZip.loadAsync(result.zip);

    const readme = await zip.file("README.md")!.async("string");
    expect(readme).toContain(result.setupFilename);
    expect(readme).not.toContain("setup.php");
  });

  it("каждый вызов bundlePhp даёт разный setupFilename", async () => {
    const a = await bundlePhp({ html: MINIMAL_HTML, zones: ZONES });
    const b = await bundlePhp({ html: MINIMAL_HTML, zones: ZONES });
    expect(a.setupFilename).not.toBe(b.setupFilename);
  });

  it("остальные файлы admin/ не подменены — внутренние пути не сломаны", async () => {
    const result = await bundlePhp({ html: MINIMAL_HTML, zones: ZONES });
    const zip = await JSZip.loadAsync(result.zip);

    // Ключевые серверные файлы должны быть на месте под оригинальными именами
    expect(zip.files["admin/login.php"]).toBeDefined();
    expect(zip.files["admin/index.php"]).toBeDefined();
    expect(zip.files["admin/lib/auth.php"]).toBeDefined();
    expect(zip.files["admin/lib/store.php"]).toBeDefined();
    expect(zip.files["index.php"]).toBeDefined();
  });

  it("кладёт внешние картинки в assets/images/ и переписывает index.php", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(Buffer.from(PNG_1x1, "base64"), {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      ),
    );

    const html = `<!DOCTYPE html>
<html><head><title>t</title></head><body>
  <img data-edit="hero_image" data-edit-type="image" data-edit-label="Hero"
       src="https://images.unsplash.com/photo-1?w=800" alt="Hero">
</body></html>`;
    const zones: PlanEditableZone[] = [
      { id: "hero_image", type: "image", label: "Hero", section: "hero" },
    ];

    const result = await bundlePhp({ html, zones });
    expect(result.imagesEmbedded).toBe(1);

    const zip = await JSZip.loadAsync(result.zip);
    expect(Object.keys(zip.files).some((p) => p.startsWith("assets/images/image-"))).toBe(true);

    const indexPhp = await zip.file("index.php")!.async("string");
    expect(indexPhp).toContain("assets/images/image-001.png");
    expect(indexPhp).not.toContain("images.unsplash.com");

    const defaults = JSON.parse(await zip.file("data/defaults.json")!.async("string")) as Record<
      string,
      string
    >;
    expect(defaults.hero_image).toBe("assets/images/image-001.png");
  });
});
