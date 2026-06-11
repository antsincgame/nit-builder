import { describe, it, expect } from "vitest";
import {
  buildPlannerPrompt,
  buildCoderPrompt,
  buildPolisherPrompt,
} from "~/lib/config/htmlPrompts";
import { TEMPLATE_CATALOG } from "~/lib/config/htmlTemplatesCatalog";

describe("buildPlannerPrompt", () => {
  const prompt = buildPlannerPrompt();

  it("includes all templates from catalog", () => {
    for (const t of TEMPLATE_CATALOG) {
      expect(prompt).toContain(t.id);
    }
  });

  it("instructs to return JSON only", () => {
    expect(prompt).toMatch(/только\s+JSON/i);
  });

  it("lists all color_mood enum values", () => {
    const moods = [
      "warm-pastel", "cool-mono", "vibrant-neon", "dark-premium",
      "earth-natural", "light-minimal", "bold-contrast",
    ];
    for (const m of moods) expect(prompt).toContain(m);
  });

  it("includes a concrete example", () => {
    expect(prompt).toContain("торт");
    expect(prompt).toContain("handmade-shop");
  });

  it("specifies language enum", () => {
    expect(prompt).toContain("ru|en|by");
  });

  it("describes collections for admin sites (Tier 6)", () => {
    expect(prompt).toContain("КОЛЛЕКЦИИ");
    expect(prompt).toContain('"collections"');
    expect(prompt).toContain("text|richtext|image|price|number");
  });

  it("is reasonably sized", () => {
    // Потолок — канарейка против бесконтрольного распухания промпта.
    // 14K → 16K (v8 Tier 6): секция КОЛЛЕКЦИИ + collections в JSON-схеме.
    // 16K → 18K+ (Б): v4-правила копирайта + инструкция services. Лимит 19K.
    expect(prompt.length).toBeLessThan(19_000);
    expect(prompt.length).toBeGreaterThan(500);
  });
});

describe("buildCoderPrompt", () => {
  const mockPlan = {
    business_type: "кофейня",
    tone: "тёплый",
    sections: ["hero", "menu"],
    color_mood: "warm-pastel" as const,
    cta_primary: "Заказать",
    language: "ru" as const,
  };
  const mockTemplate = "<!DOCTYPE html><html><body>Original</body></html>";

  it("embeds the template HTML", () => {
    const p = buildCoderPrompt({ templateHtml: mockTemplate, plan: mockPlan });
    expect(p).toContain(mockTemplate);
  });

  it("embeds the plan JSON", () => {
    const p = buildCoderPrompt({ templateHtml: mockTemplate, plan: mockPlan });
    expect(p).toContain("кофейня");
    expect(p).toContain("warm-pastel");
  });

  it("requires output to start with DOCTYPE", () => {
    const p = buildCoderPrompt({ templateHtml: mockTemplate, plan: mockPlan });
    expect(p).toMatch(/<!DOCTYPE html>/);
    expect(p).toMatch(/без markdown/i);
  });

  it("forbids npm/imports/require", () => {
    const p = buildCoderPrompt({ templateHtml: mockTemplate, plan: mockPlan });
    expect(p).toMatch(/import|require|npm/);
  });

  it("requires Tailwind CDN", () => {
    const p = buildCoderPrompt({ templateHtml: mockTemplate, plan: mockPlan });
    expect(p.toLowerCase()).toContain("cdn");
  });

  it("describes collection markup rules (Tier 6)", () => {
    const p = buildCoderPrompt({ templateHtml: mockTemplate, plan: mockPlan });
    expect(p).toContain("data-collection");
    expect(p).toContain("data-item");
    expect(p).toContain("data-field");
  });

  it("embeds curated design tokens for the plan's color_mood", () => {
    const p = buildCoderPrompt({ templateHtml: mockTemplate, plan: mockPlan });
    // warm-pastel palette primary
    expect(p).toContain("#d97757");
    // warm-pastel display font
    expect(p).toContain("Fraunces");
  });
});

describe("buildPolisherPrompt", () => {
  it("embeds current HTML", () => {
    const p = buildPolisherPrompt({
      currentHtml: "<!DOCTYPE html><body>test</body></html>",
      userRequest: "make it blue",
    });
    expect(p).toContain("<body>test</body>");
  });

  it("embeds user request", () => {
    const p = buildPolisherPrompt({
      currentHtml: "<html></html>",
      userRequest: "сделай синим",
    });
    expect(p).toContain("сделай синим");
  });

  it("preserves admin markup attributes (Tier 6)", () => {
    const p = buildPolisherPrompt({
      currentHtml: "<html></html>",
      userRequest: "x",
    });
    expect(p).toContain("data-collection");
    expect(p).toContain("data-field");
  });

  it("instructs to return full HTML only", () => {
    const p = buildPolisherPrompt({
      currentHtml: "<html></html>",
      userRequest: "x",
    });
    expect(p).toMatch(/<!DOCTYPE html>/);
    expect(p).toMatch(/без markdown/i);
  });
});
