import { describe, it, expect } from "vitest";
import { withPreviewBase } from "~/lib/utils/previewFrame";

/**
 * withPreviewBase инжектит <base href="about:srcdoc"> в превью-HTML, чтобы
 * клик по ссылке/меню внутри сайта в srcdoc-iframe не уводил его на URL
 * родителя (/app/u/:publicId) и не грузил билдер внутрь превью («фрактал»).
 */
describe("withPreviewBase", () => {
  it("вставляет <base href=\"about:srcdoc\"> сразу после <head>", () => {
    const html = "<!DOCTYPE html><html><head><title>Сайт</title></head><body>x</body></html>";
    const out = withPreviewBase(html);
    expect(out).toContain('<base href="about:srcdoc">');
    // Именно внутри <head>, сразу после открывающего тега.
    expect(out).toMatch(/<head>\s*<base href="about:srcdoc">/);
    // Контент не потерян.
    expect(out).toContain("<title>Сайт</title>");
    expect(out).toContain("<body>x</body>");
  });

  it("учитывает атрибуты у <head ...>", () => {
    const html = '<html><head lang="ru"><meta charset="utf-8"></head><body></body></html>';
    const out = withPreviewBase(html);
    expect(out).toMatch(/<head lang="ru"><base href="about:srcdoc">/);
  });

  it("идемпотентна — не дублирует <base> при повторном вызове", () => {
    const html = "<html><head></head><body></body></html>";
    const once = withPreviewBase(html);
    const twice = withPreviewBase(once);
    expect(twice).toBe(once);
    expect(twice.match(/<base/g)).toHaveLength(1);
  });

  it("не трогает HTML, где <base> уже есть (намеренная база шаблона)", () => {
    const html = '<html><head><base href="https://example.com/"></head><body></body></html>';
    expect(withPreviewBase(html)).toBe(html);
  });

  it("без <head> (ранний стрим) возвращает как есть — base добавится позже", () => {
    expect(withPreviewBase("<!DOCTYPE html><html>")).toBe("<!DOCTYPE html><html>");
    expect(withPreviewBase("")).toBe("");
  });
});
