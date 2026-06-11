import { describe, it, expect } from "vitest";
import { extractImgSrcs, restoreTemplateImages } from "~/lib/services/templateImages";

describe("extractImgSrcs", () => {
  it("берёт http(s)-src по порядку, игнорит относительные и data:", () => {
    const html =
      `<img src="https://a.com/1.jpg">` +
      `<img src="/local.png">` +
      `<img src="data:image/png;base64,AAAA">` +
      `<img src='https://b.com/2.png'>`;
    expect(extractImgSrcs(html)).toEqual([
      "https://a.com/1.jpg",
      "https://b.com/2.png",
    ]);
  });

  it("нет картинок → пустой массив", () => {
    expect(extractImgSrcs("<div>текст без картинок</div>")).toEqual([]);
  });
});

describe("restoreTemplateImages", () => {
  it("проставляет картинки шаблона по порядку, выкидывает нерелевантные", () => {
    const tpl = `<img src="https://cdn/coffee1.jpg"><img src="https://cdn/coffee2.jpg">`;
    const gen =
      `<div><img src="https://evil/mountains.jpg" alt="x" class="hero"></div>` +
      `<img src="https://evil/forest.jpg">`;
    const res = restoreTemplateImages(gen, tpl);
    expect(res.restored).toBe(2);
    expect(res.html).toContain('src="https://cdn/coffee1.jpg"');
    expect(res.html).toContain('src="https://cdn/coffee2.jpg"');
    expect(res.html).not.toContain("mountains");
    expect(res.html).not.toContain("forest");
    // прочие атрибуты <img> сохраняются
    expect(res.html).toContain('alt="x"');
    expect(res.html).toContain('class="hero"');
  });

  it("циклически переиспользует картинки шаблона, если в выводе их больше", () => {
    const tpl = `<img src="https://cdn/only.jpg">`;
    const gen = `<img src="https://evil/a.jpg"><img src="https://evil/b.jpg">`;
    const res = restoreTemplateImages(gen, tpl);
    expect(res.restored).toBe(2);
    expect((res.html.match(/cdn\/only\.jpg/g) ?? []).length).toBe(2);
  });

  it("убирает srcset у затронутых <img> (иначе браузер берёт старую картинку)", () => {
    const tpl = `<img src="https://cdn/good.jpg">`;
    const gen = `<img src="https://evil/bad.jpg" srcset="https://evil/bad-2x.jpg 2x">`;
    const res = restoreTemplateImages(gen, tpl);
    expect(res.html).toContain('src="https://cdn/good.jpg"');
    expect(res.html).not.toContain("srcset");
    expect(res.html).not.toContain("bad-2x");
  });

  it("URL с $ в query не ломает замену", () => {
    const tpl = `<img src="https://cdn/p.jpg?sig=a$b$c">`;
    const gen = `<img src="https://evil/x.jpg">`;
    const res = restoreTemplateImages(gen, tpl);
    expect(res.html).toContain("https://cdn/p.jpg?sig=a$b$c");
  });

  it("нет картинок в шаблоне → строгий no-op", () => {
    const gen = `<img src="https://evil/x.jpg">`;
    expect(restoreTemplateImages(gen, "<div>нет картинок</div>")).toEqual({
      html: gen,
      restored: 0,
    });
  });

  it("<img> без src получает src шаблона", () => {
    const tpl = `<img src="https://cdn/good.jpg">`;
    const gen = `<img alt="empty" class="x">`;
    const res = restoreTemplateImages(gen, tpl);
    expect(res.html).toContain('src="https://cdn/good.jpg"');
    expect(res.html).toContain('alt="empty"');
  });

  it("не трогает логотипы, иконки и аватары — заменяет только контентные фото", () => {
    const tpl = `<img src="https://cdn/photo1.jpg"><img src="https://cdn/photo2.jpg">`;
    const gen =
      `<img src="https://site/logo.svg" alt="Логотип" class="logo">` +
      `<img src="https://site/ic.png" class="icon w-6 h-6">` +
      `<img src="https://site/ava.jpg" class="avatar rounded-full">` +
      `<img src="https://site/tiny.png" width="32" height="32">` +
      `<img src="https://evil/hero.jpg" class="hero">` +
      `<img src="https://evil/gallery.jpg">`;
    const res = restoreTemplateImages(gen, tpl);
    // заменяются только 2 контентных фото
    expect(res.restored).toBe(2);
    // лого/иконка/аватар/мелкая иконка — остаются на месте
    expect(res.html).toContain("logo.svg");
    expect(res.html).toContain("ic.png");
    expect(res.html).toContain("ava.jpg");
    expect(res.html).toContain("tiny.png");
    // контентные фото заменены курированными из шаблона
    expect(res.html).toContain("https://cdn/photo1.jpg");
    expect(res.html).toContain("https://cdn/photo2.jpg");
    expect(res.html).not.toContain("hero.jpg");
    expect(res.html).not.toContain("gallery.jpg");
  });
});
