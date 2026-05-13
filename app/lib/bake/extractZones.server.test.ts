import { describe, it, expect } from "vitest";
import { extractZonesFromHtml } from "./extractZones.server";

describe("extractZonesFromHtml", () => {
  it("возвращает пустой массив для HTML без data-edit", () => {
    expect(extractZonesFromHtml("<h1>hello</h1>")).toEqual([]);
    expect(extractZonesFromHtml("")).toEqual([]);
  });

  it("извлекает text-зону с label и type", () => {
    const html =
      '<section id="hero"><h1 data-edit="hero_title" data-edit-type="text" data-edit-label="Заголовок">Привет</h1></section>';
    const zones = extractZonesFromHtml(html);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toEqual({
      id: "hero_title",
      type: "text",
      label: "Заголовок",
      section: "hero",
    });
  });

  it("различает text/richtext/image", () => {
    const html = `
      <h1 data-edit="t1" data-edit-type="text" data-edit-label="T">x</h1>
      <div data-edit="r1" data-edit-type="richtext" data-edit-label="R"><p>y</p></div>
      <img data-edit="i1" data-edit-type="image" data-edit-label="I" src="a.jpg">
    `;
    const zones = extractZonesFromHtml(html);
    expect(zones.map((z) => z.type)).toEqual(["text", "richtext", "image"]);
  });

  it("отбрасывает невалидные id (UPPERCASE, начинается с цифры, спецсимволы)", () => {
    const html = `
      <h1 data-edit="HERO_TITLE" data-edit-type="text" data-edit-label="a">x</h1>
      <h1 data-edit="1bad" data-edit-type="text" data-edit-label="b">x</h1>
      <h1 data-edit="with-dash" data-edit-type="text" data-edit-label="c">x</h1>
      <h1 data-edit="good_one" data-edit-type="text" data-edit-label="d">x</h1>
    `;
    const zones = extractZonesFromHtml(html);
    expect(zones.map((z) => z.id)).toEqual(["good_one"]);
  });

  it("отбрасывает зоны с неподдерживаемым type", () => {
    const html = `
      <ul data-edit="menu" data-edit-type="list" data-edit-label="Меню"></ul>
      <h1 data-edit="title" data-edit-type="text" data-edit-label="Заголовок">x</h1>
    `;
    const zones = extractZonesFromHtml(html);
    expect(zones.map((z) => z.id)).toEqual(["title"]);
  });

  it("отбрасывает зоны с пустым/коротким label", () => {
    const html = `
      <h1 data-edit="no_label" data-edit-type="text">x</h1>
      <h1 data-edit="short" data-edit-type="text" data-edit-label="a">x</h1>
      <h1 data-edit="ok" data-edit-type="text" data-edit-label="OK">x</h1>
    `;
    const zones = extractZonesFromHtml(html);
    expect(zones.map((z) => z.id)).toEqual(["ok"]);
  });

  it("дедуплицирует по id (первое вхождение остаётся)", () => {
    const html = `
      <h1 data-edit="title" data-edit-type="text" data-edit-label="Первый">a</h1>
      <h2 data-edit="title" data-edit-type="text" data-edit-label="Второй">b</h2>
    `;
    const zones = extractZonesFromHtml(html);
    expect(zones).toHaveLength(1);
    expect(zones[0]?.label).toBe("Первый");
  });

  it("section = id ближайшего родителя", () => {
    const html = `
      <main>
        <section id="about">
          <div>
            <h2 data-edit="about_title" data-edit-type="text" data-edit-label="О нас">x</h2>
          </div>
        </section>
      </main>
    `;
    const zones = extractZonesFromHtml(html);
    expect(zones[0]?.section).toBe("about");
  });

  it("section = 'general' если нет родителя с id", () => {
    const html = '<div><h1 data-edit="x" data-edit-type="text" data-edit-label="X">y</h1></div>';
    const zones = extractZonesFromHtml(html);
    expect(zones[0]?.section).toBe("general");
  });

  it("обрезает label до 80 символов", () => {
    const longLabel = "A".repeat(200);
    const html = `<h1 data-edit="x" data-edit-type="text" data-edit-label="${longLabel}">y</h1>`;
    const zones = extractZonesFromHtml(html);
    expect(zones[0]?.label.length).toBe(80);
  });

  it("терпит невалидный HTML и просто возвращает что нашёл", () => {
    const html = '<h1 data-edit="ok" data-edit-type="text" data-edit-label="OK">unclosed';
    expect(() => extractZonesFromHtml(html)).not.toThrow();
  });
});
