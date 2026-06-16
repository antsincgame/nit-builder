import { describe, it, expect } from "vitest";
import { parseExplicitPolishEdits } from "~/lib/utils/polishRequestParse";
import { applyExplicitPolishEdits } from "~/lib/utils/polishExplicitEdits";

const BASE = `<!DOCTYPE html><html><head><title>Minsk Lashes</title></head><body>
<header><nav><a href="#" class="logo">Minsk Lashes</a></nav></header>
<section data-nit-section="hero"><p class="text-accent">РЕСНИЦЫ В МИНСКЕ</p><h1>Ресницы в Минске</h1></section>
<section data-nit-section="about"><h2>О нас</h2></section>
</body></html>`;

describe("parseExplicitPolishEdits", () => {
  it("парсит бренд, заголовок и SEO из запроса", () => {
    const e = parseExplicitPolishEdits(
      "Добавь больше сео блоков, и поменяй название на ManikBy, заголовок на мастер ноготочек",
    );
    expect(e.brandName).toBe("ManikBy");
    expect(e.headline).toBe("мастер ноготочек");
    expect(e.wantsSeo).toBe(true);
  });
});

describe("applyExplicitPolishEdits", () => {
  it("меняет бренд, H1 и добавляет SEO даже если модель не дотянула", () => {
    const prompt =
      "поменяй название на ManikBy, заголовок на мастер ноготочек, больше seo";
    const result = applyExplicitPolishEdits(BASE, prompt);

    expect(result.html).toContain("ManikBy");
    expect(result.html).toContain("мастер ноготочек");
    expect(result.html).toMatch(/meta name="description"/i);
    expect(result.html).toMatch(/data-nit-section="faq"/i);
    expect(result.applied.length).toBeGreaterThan(0);
    expect(result.missed).toHaveLength(0);
  });
});
