import { describe, it, expect } from "vitest";
import {
  classifyPolishIntent,
  extractTargetSection,
  requiresFullDocumentPolish,
} from "~/lib/services/intentClassifier";

describe("extractTargetSection", () => {
  const cases: Array<[string, string | undefined]> = [
    ["сделай героя синим", "hero"],
    ["в герое красный фон", "hero"],
    ["фон главного экрана тёмный", "hero"],
    ["меню чуть крупнее", "menu"],
    ["цены в зелёном", "pricing"],
    ["тарифы ярче", "pricing"],
    ["галерея с тенью", "gallery"],
    ["контакты сделай чуть больше", "contact"],
    ["запись в розовый", "booking"],
    ["бронь в темной теме", "booking"],
    ["отзывы крупнее", "testimonials"],
    ["фичи в синем", "features"],
    ["услуги побольше", "services"],
    ["рассказ о нас читаем", "about"],
    ["в футере подчеркни ссылки", "footer"],
    ["подвал тёмный", "footer"],
    ["hero section blue", "hero"],
    ["шрифт чуть крупнее", undefined],
    ["фон тёмный", undefined],
    ["", undefined],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected ?? "undefined"}`, () => {
      expect(extractTargetSection(input)).toBe(expected);
    });
  }
});

describe("classifyPolishIntent включает targetSection", () => {
  it("стильная правка + секция → targetSection в результате", () => {
    const c = classifyPolishIntent("сделай героя синим");
    expect(c.intent).toBe("css_patch");
    expect(c.targetSection).toBe("hero");
    expect(c.reason).toContain("section: hero");
  });

  it("глобальная стильная правка → targetSection undefined", () => {
    const c = classifyPolishIntent("в тёмную тему");
    expect(c.intent).toBe("css_patch");
    expect(c.targetSection).toBeUndefined();
  });

  it("structural + секция → targetSection сохраняется для telemetry", () => {
    // "добавь отзывы" — structural побеждает, но section мы всё равно знаем
    const c = classifyPolishIntent("добавь секцию отзывы");
    expect(c.intent).toBe("full_rewrite");
    expect(c.targetSection).toBe("testimonials");
  });

  it("ребрендинг → full_rewrite", () => {
    const c = classifyPolishIntent("поменяй название на ManikBy");
    expect(c.intent).toBe("full_rewrite");
  });
});

describe("requiresFullDocumentPolish", () => {
  it("true для смены названия и SEO", () => {
    expect(requiresFullDocumentPolish("поменяй название на ManikBy")).toBe(true);
    expect(requiresFullDocumentPolish("добавь больше seo блоков")).toBe(true);
  });

  it("false для точечной стилевой правки секции", () => {
    expect(requiresFullDocumentPolish("сделай героя синим")).toBe(false);
  });
});
