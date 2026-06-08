import { describe, it, expect } from "vitest";
import { applyPremiumBaseLayer } from "~/lib/services/htmlPostPolish";

describe("applyPremiumBaseLayer — детерминированная база красоты", () => {
  const page = "<!DOCTYPE html><html><head><title>X</title></head><body><h1>Привет</h1></body></html>";

  it("внедряет премиум-слой и шрифт перед </head>", () => {
    const out = applyPremiumBaseLayer(page);
    expect(out).toContain('id="nit-premium-base"');
    expect(out).toContain(":where(body)");
    expect(out).toContain("fonts.googleapis.com"); // Inter подключён
    expect(out.indexOf("nit-premium-base")).toBeLessThan(out.indexOf("</head>"));
  });

  it("идемпотентна — повторный вызов ничего не дублирует", () => {
    const once = applyPremiumBaseLayer(page);
    const twice = applyPremiumBaseLayer(once);
    expect(twice).toBe(once);
  });

  it("не подключает Inter повторно, если страница уже тянет Google Fonts", () => {
    const withFont =
      '<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Manrope" rel="stylesheet"></head><body></body></html>';
    const out = applyPremiumBaseLayer(withFont);
    expect(out).toContain('id="nit-premium-base"');
    expect(out).not.toContain("family=Inter");
    expect(out).toContain("family=Manrope"); // выбор модели сохранён
  });

  it("использует :where (нулевая специфичность) — не перебивает стили модели", () => {
    const out = applyPremiumBaseLayer(page);
    // все правила базы завёрнуты в :where(...)
    expect(out).toContain(":where(h1,h2,h3,h4)");
    expect(out).toContain("prefers-reduced-motion");
  });

  it("работает даже без </head> (вставляет в начало)", () => {
    const out = applyPremiumBaseLayer("<body><p>hi</p></body>");
    expect(out).toContain('id="nit-premium-base"');
    expect(out.startsWith("<link") || out.startsWith("<style")).toBe(true);
  });

  it("добавляет scroll-reveal: стиль + скрипт перед </body>", () => {
    const page =
      "<!DOCTYPE html><html><head><title>X</title></head><body><section>A</section></body></html>";
    const out = applyPremiumBaseLayer(page);
    expect(out).toContain(".nit-reveal");
    expect(out).toContain('id="nit-reveal"');
    expect(out.indexOf('id="nit-reveal"')).toBeLessThan(out.indexOf("</body>"));
  });

  it("reveal graceful: reduced-motion gate, fallback-таймер, всё в try/catch", () => {
    const out = applyPremiumBaseLayer(
      "<!DOCTYPE html><html><head></head><body><section>A</section></body></html>",
    );
    // не анимируем при reduced-motion
    expect(out).toContain("prefers-reduced-motion: reduce");
    // fallback показывает всё принудительно (контент не останется скрытым)
    expect(out).toContain("setTimeout");
    expect(out).toContain("nit-vis");
    // первый экран не прячется — анимируются только элементы ниже вьюпорта
    expect(out).toContain("getBoundingClientRect");
  });
});
