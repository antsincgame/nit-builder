import { describe, it, expect } from "vitest";
import {
  buildAssistantCompletionMessage,
  describePolishChanges,
  parseRenameTargets,
} from "~/lib/utils/completionMessage";

describe("parseRenameTargets", () => {
  it("извлекает название и заголовок из русского запроса", () => {
    const t = parseRenameTargets(
      "поменяй название на ManikBy, заголовок на мастер ноготочек",
    );
    expect(t.brand).toBe("ManikBy");
    expect(t.heading).toBe("мастер ноготочек");
  });
});

describe("describePolishChanges", () => {
  it("описывает смену H1 и бренда в шапке", () => {
    const before = `<!DOCTYPE html><html><head><title>Minsk Lashes</title></head><body>
      <header><nav><a href="#">Minsk Lashes</a></nav></header>
      <section data-nit-section="hero"><h1>Ресницы в Минске</h1></section>
    </body></html>`;
    const after = `<!DOCTYPE html><html><head><title>ManikBy</title></head><body>
      <header><nav><a href="#">ManikBy</a></nav></header>
      <section data-nit-section="hero"><h1>мастер ноготочек</h1></section>
      <section data-nit-section="faq"><h2>FAQ</h2></section>
    </body></html>`;
    const changes = describePolishChanges(
      before,
      after,
      "название на ManikBy, заголовок на мастер ноготочек, больше seo",
    );
    expect(changes.some((c) => c.includes("ManikBy"))).toBe(true);
    expect(changes.some((c) => c.includes("H1"))).toBe(true);
    expect(changes.some((c) => c.includes("вопросы") || c.includes("Добавил"))).toBe(true);
  });

  it("предупреждает если запрошенный бренд не попал в HTML", () => {
    const html = "<html><body><h1>Старое</h1></body></html>";
    const changes = describePolishChanges(html, html, "название на ManikBy");
    expect(changes.some((c) => c.includes("⚠️"))).toBe(true);
  });
});

describe("buildAssistantCompletionMessage", () => {
  it("на create не содержит шаблон про «что можно поправить»", () => {
    const msg = buildAssistantCompletionMessage({
      html: '<section data-nit-section="hero"></section><section data-nit-section="about"></section>',
      userPrompt: "сайт кофейни",
      isPolish: false,
      durationMs: 5000,
    });
    expect(msg).toContain("Собрал за");
    expect(msg).not.toContain("Что можно поправить прямо в чате");
  });

  it("на polish перечисляет изменения", () => {
    const before = "<html><header><nav><a>Old</a></nav></header><h1>Old H1</h1></html>";
    const after = "<html><header><nav><a>NewBrand</a></nav></header><h1>New H1</h1></html>";
    const msg = buildAssistantCompletionMessage({
      html: after,
      previousHtml: before,
      userPrompt: "смени название",
      isPolish: true,
      durationMs: 3000,
    });
    expect(msg).toContain("Готово");
    expect(msg).not.toContain("Что можно поправить прямо в чате");
    expect(msg).toMatch(/шапке|H1|Title/i);
    expect(msg).toContain("•");
  });
});
