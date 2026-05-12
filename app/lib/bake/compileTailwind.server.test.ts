import { describe, it, expect } from "vitest";
import { inlineCompiledCss } from "./compileTailwind.server";

// Чистые юнит-тесты на трансформацию HTML — без обращения к Tailwind
// compiler. Интеграционная проверка (что compileTailwindForHtml выдаёт
// валидный CSS) делается в eval/runHtmlSmoke.

describe("inlineCompiledCss", () => {
  it("удаляет Tailwind CDN-скрипт", () => {
    const html =
      '<html><head><script src="https://cdn.tailwindcss.com"></script></head><body></body></html>';
    const out = inlineCompiledCss(html, ".test{color:red}");
    expect(out).not.toContain("cdn.tailwindcss.com");
  });

  it("удаляет CDN-скрипт с дополнительными атрибутами и query-string", () => {
    const html =
      '<head><script defer src="https://cdn.tailwindcss.com?plugins=forms"></script><script src="http://cdn.tailwindcss.com/3.4.0"></script></head>';
    const out = inlineCompiledCss(html, "");
    expect(out).not.toContain("cdn.tailwindcss.com");
  });

  it("встраивает <style> в <head> перед </head>", () => {
    const html = "<html><head><title>x</title></head><body></body></html>";
    const out = inlineCompiledCss(html, ".a{color:red}");
    expect(out).toContain("<style>.a{color:red}</style>");
    expect(out.indexOf("<style>")).toBeLessThan(out.indexOf("</head>"));
  });

  it("работает при отсутствии </head> — вставляет в начало <body>", () => {
    const html = '<body class="x"><h1>hi</h1></body>';
    const out = inlineCompiledCss(html, ".a{color:red}");
    expect(out).toContain("<style>.a{color:red}</style>");
    expect(out.indexOf("<style>")).toBeGreaterThan(out.indexOf("<body"));
    expect(out.indexOf("<style>")).toBeLessThan(out.indexOf("<h1>"));
  });

  it("работает с фрагментом без <body> и <head>", () => {
    const html = "<div>fragment</div>";
    const out = inlineCompiledCss(html, ".a{color:red}");
    expect(out.startsWith("<style>")).toBe(true);
    expect(out).toContain("<div>fragment</div>");
  });

  it("не падает на пустом CSS", () => {
    const html = "<html><head></head><body></body></html>";
    const out = inlineCompiledCss(html, "");
    expect(out).toContain("<style></style>");
  });

  it("сохраняет остальное содержимое <head>", () => {
    const html =
      '<html><head><title>Cafe</title><meta charset="utf-8"></head><body></body></html>';
    const out = inlineCompiledCss(html, ".a{}");
    expect(out).toContain("<title>Cafe</title>");
    expect(out).toContain('<meta charset="utf-8">');
  });
});
