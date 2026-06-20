import { describe, it, expect } from "vitest";
import {
  rulesToCss,
  injectCssOverrides,
  scopeSelector,
  parseCssPatchJson,
  applyCssPatchText,
  CssPatchSchema,
} from "~/lib/services/cssPatch";

describe("rulesToCss", () => {
  it("сериализует одно правило с !important", () => {
    const css = rulesToCss([
      { selector: "body", properties: { background: "#1e3a8a", color: "#f8fafc" } },
    ]);
    expect(css).toContain("body {");
    expect(css).toContain("background: #1e3a8a !important;");
    expect(css).toContain("color: #f8fafc !important;");
  });

  it("сериализует несколько правил", () => {
    const css = rulesToCss([
      { selector: "h1", properties: { color: "red" } },
      { selector: "button", properties: { "border-radius": "9999px" } },
    ]);
    expect(css).toMatch(/h1 \{[\s\S]*\}\n\nbutton \{/);
  });

  it("не дублирует !important", () => {
    const css = rulesToCss([
      { selector: "a", properties: { color: "blue !important" } },
    ]);
    expect(css).toContain("color: blue !important;");
    expect(css).not.toContain("!important !important");
  });
});

describe("scopeSelector", () => {
  it("body → hero scope + header", () => {
    expect(scopeSelector("body", "hero")).toBe('[data-nit-section="hero"], header');
  });

  it("body.foo → hero scope + header", () => {
    expect(scopeSelector("body.foo", "hero")).toBe(
      '[data-nit-section="hero"], header',
    );
  });

  it("простой тег → scope + тег и header", () => {
    expect(scopeSelector("h1", "hero")).toBe('[data-nit-section="hero"] h1, header h1');
  });

  it("класс → scope + класс", () => {
    expect(scopeSelector(".btn", "pricing")).toBe('[data-nit-section="pricing"] .btn');
  });

  it("множественный через запятую — каждый скоупится отдельно", () => {
    const out = scopeSelector("h1, .btn, button", "hero");
    expect(out).toContain('[data-nit-section="hero"] h1');
    expect(out).toContain('header h1');
    expect(out).toContain('[data-nit-section="hero"] .btn');
    expect(out).toContain('[data-nit-section="hero"] button');
  });

  it("html не скоупится", () => {
    expect(scopeSelector("html", "hero")).toBe("html");
  });

  it("idempotent: уже скоупленный селектор не скоупится второй раз", () => {
    const already = '[data-nit-section="hero"] h1';
    expect(scopeSelector(already, "hero")).toBe(already);
  });

  it("пустые части отбрасываются", () => {
    expect(scopeSelector("h1, , button", "hero")).toBe(
      '[data-nit-section="hero"] h1, header h1, [data-nit-section="hero"] button, header button',
    );
  });
});

describe("injectCssOverrides", () => {
  it("вставляет новый блок перед </head>", () => {
    const html = "<!DOCTYPE html><html><head><title>X</title></head><body></body></html>";
    const out = injectCssOverrides(html, "body{color:red}");
    expect(out).toContain('<style id="nit-overrides">');
    expect(out).toContain("body{color:red}");
  });

  it("дополняет существующий блок", () => {
    const html = `<html><head>
<style id="nit-overrides">
body { background: red !important; }
</style>
</head><body></body></html>`;
    const out = injectCssOverrides(html, "button { border-radius: 9999px !important; }");
    expect(out).toContain("background: red !important");
    expect(out).toContain("border-radius: 9999px !important");
    const blockMatches = out.match(/<style\s+id="nit-overrides"/g) ?? [];
    expect(blockMatches.length).toBe(1);
  });

  it("пустой css — без изменений", () => {
    const html = "<html><head></head><body></body></html>";
    expect(injectCssOverrides(html, "")).toBe(html);
  });
});

describe("CssPatchSchema", () => {
  it("валидный patch", () => {
    expect(
      CssPatchSchema.safeParse({
        rules: [{ selector: "body", properties: { color: "red" } }],
      }).success,
    ).toBe(true);
  });

  it("пустой rules отклоняется", () => {
    expect(CssPatchSchema.safeParse({ rules: [] }).success).toBe(false);
  });
});

describe("parseCssPatchJson (туннельный сырой вывод модели)", () => {
  it("парсит чистый JSON", () => {
    const patch = parseCssPatchJson('{"rules":[{"selector":"body","properties":{"background":"#111"}}]}');
    expect(patch?.rules).toHaveLength(1);
    expect(patch?.rules[0]?.selector).toBe("body");
  });

  it("терпим к markdown-фенсам ```json и прозе вокруг", () => {
    const raw = 'Вот правки:\n```json\n{"rules":[{"selector":"h1","properties":{"color":"#fff"}}]}\n```\nГотово!';
    expect(parseCssPatchJson(raw)?.rules[0]?.selector).toBe("h1");
  });

  it("null при отсутствии JSON / битом / нарушении схемы", () => {
    expect(parseCssPatchJson("Извините, не могу")).toBeNull();
    expect(parseCssPatchJson("{ это не json")).toBeNull();
    expect(parseCssPatchJson('{"rules":[]}')).toBeNull(); // пустой массив — схема min(1)
  });
});

describe("applyCssPatchText (parse + inject из сырого текста)", () => {
  const html = "<html><head><title>t</title></head><body><h1>Hi</h1></body></html>";

  it("инжектит правила в <style id=nit-overrides>", () => {
    const out = applyCssPatchText(
      '{"rules":[{"selector":"body","properties":{"background":"#1e3a8a"}}]}',
      html,
    );
    expect(out).not.toBeNull();
    expect(out!.ruleCount).toBe(1);
    expect(out!.html).toContain('<style id="nit-overrides">');
    expect(out!.html).toContain("background: #1e3a8a !important;");
  });

  it("скоупит селекторы под targetSection", () => {
    const out = applyCssPatchText(
      '{"rules":[{"selector":"h2","properties":{"color":"#f00"}}]}',
      html,
      "pricing",
    );
    expect(out!.html).toContain('[data-nit-section="pricing"] h2');
  });

  it("null при непарсимом тексте → вызывающий уйдёт в fallback", () => {
    expect(applyCssPatchText("не json", html)).toBeNull();
  });
});
