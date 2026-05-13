import { describe, it, expect } from "vitest";
import { bakeHtmlToPhp, phpSingleQuote } from "./htmlToPhp.server";
import type { PlanEditableZone } from "~/lib/utils/planSchema";

describe("phpSingleQuote", () => {
  it("оборачивает в одиночные кавычки", () => {
    expect(phpSingleQuote("hello")).toBe("'hello'");
  });
  it("экранирует одиночную кавычку", () => {
    expect(phpSingleQuote("it's")).toBe("'it\\'s'");
  });
  it("экранирует бэкслэш", () => {
    expect(phpSingleQuote("a\\b")).toBe("'a\\\\b'");
  });
  it("не трогает двойные кавычки и доллары (PHP single-quoted их не интерпретирует)", () => {
    expect(phpSingleQuote('say "$x"')).toBe('\'say "$x"\'');
  });
  it("работает с UTF-8", () => {
    expect(phpSingleQuote("Привет")).toBe("'Привет'");
  });
});

const zone = (id: string, type: PlanEditableZone["type"]): PlanEditableZone => ({
  id,
  type,
  label: id,
  section: "test",
});

describe("bakeHtmlToPhp", () => {
  it("вставляет PHP-префикс в начало", () => {
    const html = "<!DOCTYPE html><html><body><h1>hi</h1></body></html>";
    const out = bakeHtmlToPhp(html, []);
    expect(out.phpIndex.startsWith("<?php")).toBe(true);
    expect(out.phpIndex).toContain("nit_load_content");
    expect(out.phpIndex).toContain("<!DOCTYPE html>");
  });

  it("пустой zones — всё остаётся как было (плюс префикс)", () => {
    const html = '<div data-edit="x">hello</div>';
    const out = bakeHtmlToPhp(html, []);
    // Чужой data-edit не в плане — остаётся как есть (будет в логах).
    expect(out.phpIndex).toContain('data-edit="x"');
    expect(out.matchedZones).toHaveLength(0);
  });

  it("text: заменяет innerText на PHP вывод и снимает data-edit", () => {
    const html =
      '<h1 class="hero" data-edit="hero_title">Лучший кофе в городе</h1>';
    const out = bakeHtmlToPhp(html, [zone("hero_title", "text")]);
    expect(out.phpIndex).toContain(
      "<?= e($c['hero_title'] ?? 'Лучший кофе в городе') ?>",
    );
    expect(out.phpIndex).not.toContain("data-edit");
    expect(out.phpIndex).toContain('class="hero"'); // остальные атрибуты сохраняются
    expect(out.defaults.hero_title).toBe("Лучший кофе в городе");
    expect(out.matchedZones).toHaveLength(1);
  });

  it("richtext: сохраняет вложенные теги в default'е, без e() обёртки", () => {
    const html =
      '<div data-edit="about_text"><p>Первый абзац.</p><p>Второй.</p></div>';
    const out = bakeHtmlToPhp(html, [zone("about_text", "richtext")]);
    // richtext НЕ использует e() — иначе вложенные теги сломаются.
    expect(out.phpIndex).toContain("<?= $c['about_text'] ??");
    expect(out.phpIndex).not.toMatch(/<\?= e\(\$c\['about_text'/);
    expect(out.defaults.about_text).toBe(
      "<p>Первый абзац.</p><p>Второй.</p>",
    );
  });

  it("image: заменяет src и сохраняет alt/class", () => {
    const html =
      '<img data-edit="hero_image" src="https://images.unsplash.com/photo-1" alt="Кофе" class="w-full">';
    const out = bakeHtmlToPhp(html, [zone("hero_image", "image")]);
    expect(out.phpIndex).toContain(
      "src=\"<?= e($c['hero_image'] ?? 'https://images.unsplash.com/photo-1') ?>\"",
    );
    expect(out.phpIndex).toContain('alt="Кофе"');
    expect(out.phpIndex).toContain('class="w-full"');
    expect(out.phpIndex).not.toContain("data-edit");
    expect(out.defaults.hero_image).toBe("https://images.unsplash.com/photo-1");
  });

  it("image: data-edit на не-img узле → missingZones (MVP)", () => {
    const html = '<div data-edit="hero_image" style="background:url(/x.jpg)"></div>';
    const out = bakeHtmlToPhp(html, [zone("hero_image", "image")]);
    expect(out.matchedZones).toHaveLength(0);
    expect(out.missingZones).toHaveLength(1);
    expect(out.missingZones[0].id).toBe("hero_image");
  });

  it("zone в plan но нет в HTML → missingZones", () => {
    const html = '<h1 data-edit="hero_title">x</h1>';
    const out = bakeHtmlToPhp(html, [
      zone("hero_title", "text"),
      zone("hero_subtitle", "text"), // НЕТ в html
    ]);
    expect(out.matchedZones.map((z) => z.id)).toEqual(["hero_title"]);
    expect(out.missingZones.map((z) => z.id)).toEqual(["hero_subtitle"]);
  });

  it("дефолты с одиночными кавычками экранируются в PHP", () => {
    const html = '<h1 data-edit="t">it\'s good</h1>';
    const out = bakeHtmlToPhp(html, [zone("t", "text")]);
    expect(out.phpIndex).toContain("'it\\'s good'");
    expect(out.defaults.t).toBe("it's good");
  });

  it("несколько зон разных типов в одном HTML", () => {
    const html = `<!DOCTYPE html><html><body>
  <h1 data-edit="t1">title</h1>
  <div data-edit="r1"><p>rich</p></div>
  <img data-edit="i1" src="/a.jpg" alt="">
</body></html>`;
    const out = bakeHtmlToPhp(html, [
      zone("t1", "text"),
      zone("r1", "richtext"),
      zone("i1", "image"),
    ]);
    expect(out.matchedZones).toHaveLength(3);
    expect(out.missingZones).toHaveLength(0);
    expect(out.defaults).toEqual({
      t1: "title",
      r1: "<p>rich</p>",
      i1: "/a.jpg",
    });
    expect(out.phpIndex).toContain("<?= e($c['t1']");
    expect(out.phpIndex).toContain("<?= $c['r1']");
    expect(out.phpIndex).toContain("<?= e($c['i1']");
  });

  it("не трогает doctype, head, lang и остальную разметку", () => {
    const html =
      '<!DOCTYPE html><html lang="ru"><head><title>X</title></head><body><h1 data-edit="t">A</h1></body></html>';
    const out = bakeHtmlToPhp(html, [zone("t", "text")]);
    expect(out.phpIndex).toContain("<!DOCTYPE html>");
    expect(out.phpIndex).toContain('<html lang="ru">');
    expect(out.phpIndex).toContain("<title>X</title>");
  });
});
