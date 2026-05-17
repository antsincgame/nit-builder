import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";

// Мокаем тяжёлый Tailwind compile ДО импорта bundle.server. Без этого
// тест тянет postcss + tailwind v4 + tmpdir I/O — медленно и хрупко на
// разных машинах. Содержание bundle.server вне compile-стадии полностью
// детерминировано, мок безопасен.
//
// inlineCompiledCss → no-op (возвращает HTML как есть) — иначе baker
// получит изменённый HTML, и мы будем проверять не bundle.server, а
// побочку inline-step'а.
vi.mock("./compileTailwind.server", () => ({
  compileTailwindForHtml: vi.fn(async () => "/* mocked tailwind output */"),
  inlineCompiledCss: vi.fn((html: string) => html),
}));

import { generateSetupFilename, bundlePhp } from "./bundle.server";
import type { PlanEditableZone } from "~/lib/utils/planSchema";

const ZONES: PlanEditableZone[] = [
  { id: "hero_title", type: "text", label: "Заголовок", section: "hero" },
];

const HTML_WITH_ZONE = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body>
  <section id="hero">
    <h1 data-edit="hero_title" data-edit-type="text" data-edit-label="Заголовок">Coffee shop</h1>
  </section>
</body>
</html>`;

describe("generateSetupFilename", () => {
  it("матчит формат setup-<8hex>.php", () => {
    const name = generateSetupFilename();
    expect(name).toMatch(/^setup-[0-9a-f]{8}\.php$/);
  });

  it("уникален между вызовами (200 → 200 различных)", () => {
    // 200 итераций при 2^32 пространстве — вероятность коллизии ~1e-8,
    // флакать не будет.
    const names = new Set<string>();
    for (let i = 0; i < 200; i++) names.add(generateSetupFilename());
    expect(names.size).toBe(200);
  });

  it("не содержит небезопасных символов (path traversal / shell)", () => {
    for (let i = 0; i < 20; i++) {
      const name = generateSetupFilename();
      // Только базовое имя: [a-z0-9-] + расширение .php. Никаких слэшей,
      // пробелов, точек кроме разделителя расширения, спецсимволов оболочки.
      expect(name).toMatch(/^[a-z0-9-]+\.php$/);
      expect(name).not.toContain("..");
    }
  });
});

describe("bundlePhp", () => {
  let result: Awaited<ReturnType<typeof bundlePhp>>;
  let zip: JSZip;

  beforeEach(async () => {
    result = await bundlePhp({ html: HTML_WITH_ZONE, zones: ZONES });
    zip = await JSZip.loadAsync(Buffer.from(result.zip));
  });

  it("возвращает setupFilename в формате setup-<8hex>.php", () => {
    expect(result.setupFilename).toMatch(/^setup-[0-9a-f]{8}\.php$/);
  });

  it("ZIP содержит setup-файл под рандомным именем", () => {
    expect(zip.file(result.setupFilename)).not.toBeNull();
  });

  it("ZIP НЕ содержит файла под legacy-именем setup.php", () => {
    // Главная проверка анти-race-фикса: фиксированного setup.php в архиве нет.
    expect(zip.file("setup.php")).toBeNull();
  });

  it("ZIP содержит обязательные файлы бандла (index + data/*)", () => {
    expect(zip.file("index.php")).not.toBeNull();
    expect(zip.file("data/content.json")).not.toBeNull();
    expect(zip.file("data/defaults.json")).not.toBeNull();
    expect(zip.file("data/zones.json")).not.toBeNull();
  });

  it("админка из шаблона admin-php попадает в архив", () => {
    // Точные пути могут эволюционировать, проверяем три якорных.
    expect(zip.file("admin/index.php")).not.toBeNull();
    expect(zip.file("admin/login.php")).not.toBeNull();
    expect(zip.file("admin/lib/auth.php")).not.toBeNull();
  });

  it(".htaccess в data/ и assets/uploads/ присутствует", () => {
    // Защита от прямого HTTP-доступа к JSON и от исполнения PHP в uploads.
    expect(zip.file("data/.htaccess")).not.toBeNull();
    expect(zip.file("assets/uploads/.htaccess")).not.toBeNull();
  });

  it("matchedZones содержит размеченную зону, missingZones пустой", () => {
    expect(result.matchedZones.map((z) => z.id)).toEqual(["hero_title"]);
    expect(result.missingZones).toEqual([]);
  });

  it("data/zones.json содержит только matchedZones", async () => {
    const zonesContent = await zip.file("data/zones.json")!.async("string");
    const parsed = JSON.parse(zonesContent) as Array<{ id: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("hero_title");
  });

  it("data/content.json и data/defaults.json идентичны на старте", async () => {
    // Стартовое состояние content == defaults; админка мутирует только
    // content.json, defaults остаётся read-only reference.
    const content = await zip.file("data/content.json")!.async("string");
    const defaults = await zip.file("data/defaults.json")!.async("string");
    expect(content).toBe(defaults);
  });

  it("sizeBytes отражает реальный размер zip", () => {
    expect(result.sizeBytes).toBe(result.zip.length);
    expect(result.sizeBytes).toBeGreaterThan(500);
  });

  it("два вызова дают разные setupFilename, имена не переносятся между бандлами", async () => {
    const r2 = await bundlePhp({ html: HTML_WITH_ZONE, zones: ZONES });
    expect(r2.setupFilename).not.toBe(result.setupFilename);
    const zip2 = await JSZip.loadAsync(Buffer.from(r2.zip));
    expect(zip2.file(r2.setupFilename)).not.toBeNull();
    // setup-имя предыдущего бандла НЕ должно случайно оказаться в новом
    expect(zip2.file(result.setupFilename)).toBeNull();
  });

  it("зоны из плана, не размеченные в HTML, попадают в missingZones", async () => {
    const r = await bundlePhp({
      html: HTML_WITH_ZONE, // в HTML размечен только hero_title
      zones: [
        ...ZONES,
        { id: "missing_zone", type: "text", label: "Не размечено", section: "other" },
      ],
    });
    expect(r.matchedZones.map((z) => z.id)).toEqual(["hero_title"]);
    expect(r.missingZones.map((z) => z.id)).toEqual(["missing_zone"]);
  });
});
