import { describe, it, expect } from "vitest";
import { inferTemplateFromPrompt, inferConfidentTemplateId } from "~/lib/services/templateKeywordSelector";

describe("inferTemplateFromPrompt", () => {
  it("матчит keyword из bestFor напрямую", () => {
    expect(inferTemplateFromPrompt("нужна кофейня").id).toBe("coffee-shop");
    expect(inferTemplateFromPrompt("лендинг для барбершопа").id).toBe("barbershop");
  });

  it("матчит даже в середине фразы и в падежных формах (substring match)", () => {
    // substring "кофейн" поймается в "кофейни"
    expect(inferTemplateFromPrompt("открываю маленькую кофейню в центре").id).toBe("coffee-shop");
  });

  it("для несвязанного промпта возвращает универсальный fallback blank-landing", () => {
    // совсем без матчей: нейтральный каркас, а НЕ нишевая кофейня
    const res = inferTemplateFromPrompt("xxxyyyzzz");
    expect(res.id).toBe("blank-landing");
  });

  it("возвращает sections списком", () => {
    const res = inferTemplateFromPrompt("фотограф портреты");
    expect(res.id).toBe("photographer");
    expect(res.sections).toContain("gallery");
    expect(res.sections).toContain("hero");
  });

  it("поле name всегда заполнено человекочитаемым именем", () => {
    const res = inferTemplateFromPrompt("разработчик портфолио");
    expect(res.id).toBe("portfolio-dev");
    expect(res.name.length).toBeGreaterThan(0);
  });

  it("идемпотентен — два одинаковых запроса = один template", () => {
    const a = inferTemplateFromPrompt("свадьба Настя и Паша");
    const b = inferTemplateFromPrompt("свадьба Настя и Паша");
    expect(a.id).toBe(b.id);
  });
});

describe("inferConfidentTemplateId — нейл-ниши", () => {
  it("слэнг «ноготочки» уверенно ведёт на beauty-master", () => {
    expect(inferConfidentTemplateId("Собери мне сайт про ноготочки")).toBe("beauty-master");
  });

  it("маникюр и ногти тоже ведут на beauty-master", () => {
    expect(inferConfidentTemplateId("сайт для маникюра")).toBe("beauty-master");
    expect(inferConfidentTemplateId("наращивание ногтей")).toBe("beauty-master");
  });

  it("без уверенной ниши возвращает null", () => {
    expect(inferConfidentTemplateId("xxxyyyzzz")).toBeNull();
  });
});

describe("inferConfidentTemplateId — бьюти/велнес каркас (Б)", () => {
  it("ресницы ведут на service-studio, а не на маникюрный beauty-master", () => {
    expect(inferConfidentTemplateId("сайт для наращивания ресниц")).toBe("service-studio");
    expect(inferConfidentTemplateId("ламинирование ресниц")).toBe("service-studio");
  });

  it("брови, визаж, косметология, массаж — на service-studio", () => {
    expect(inferConfidentTemplateId("ламинирование бровей")).toBe("service-studio");
    expect(inferConfidentTemplateId("услуги визажиста")).toBe("service-studio");
    expect(inferConfidentTemplateId("кабинет косметолога")).toBe("service-studio");
    expect(inferConfidentTemplateId("массаж и спа")).toBe("service-studio");
  });

  it("маникюр/ногти остаются на beauty-master (сужение не сломало нейл)", () => {
    expect(inferConfidentTemplateId("сайт для маникюра")).toBe("beauty-master");
    expect(inferConfidentTemplateId("наращивание ногтей")).toBe("beauty-master");
  });
});

describe("inferConfidentTemplateId — word-start (без коллизий по середине слова)", () => {
  it("«мастер» не ведёт уверенно на barbershop из «автомастерской»", () => {
    // "мастер" — bestFor барбершопа; раньше substring ловил его в "автомастерской".
    expect(inferConfidentTemplateId("нужен сайт для автомастерской")).not.toBe("barbershop");
  });

  it("«бров» не ведёт на service-studio из «добровольцев»", () => {
    // "бров" — bestFor service-studio; substring ловил его в "доБРОВольцев".
    expect(inferConfidentTemplateId("сайт для добровольцев фонда")).not.toBe("service-studio");
  });

  it("стем-префиксы по-прежнему матчатся (кофейн→coffee-shop)", () => {
    expect(inferConfidentTemplateId("открываю кофейню")).toBe("coffee-shop");
  });
});
