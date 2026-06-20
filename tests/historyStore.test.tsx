// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadHistory, type HistoryEntry } from "~/lib/stores/historyStore";

const KEY = "nit:history";

function validEntry(i: number): HistoryEntry {
  return {
    id: `h-${i}`,
    prompt: `prompt ${i}`,
    html: `<html>${i}</html>`,
    templateId: "coffee-shop",
    templateName: "Кофейня",
    createdAt: 1_700_000_000_000 + i,
  };
}

describe("historyStore.loadHistory hardening", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("возвращает валидные записи", () => {
    localStorage.setItem(KEY, JSON.stringify([validEntry(1), validEntry(2)]));
    const out = loadHistory();
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("h-1");
  });

  it("отфильтровывает битые/неполные записи, не падая", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        validEntry(1),
        { id: "x", prompt: "no html" }, // нет html/templateId/createdAt
        null,
        "строка вместо объекта",
        { ...validEntry(2), createdAt: "не число" }, // плохой тип
        validEntry(3),
      ]),
    );
    const out = loadHistory();
    expect(out.map((e) => e.id)).toEqual(["h-1", "h-3"]);
  });

  it("клампит до MAX_ENTRIES (20) на чтении", () => {
    const many = Array.from({ length: 25 }, (_, i) => validEntry(i));
    localStorage.setItem(KEY, JSON.stringify(many));
    expect(loadHistory()).toHaveLength(20);
  });

  it("не-массив → []", () => {
    localStorage.setItem(KEY, JSON.stringify({ not: "an array" }));
    expect(loadHistory()).toEqual([]);
  });

  it("битый JSON → [] без исключения", () => {
    localStorage.setItem(KEY, "{ это не json");
    expect(loadHistory()).toEqual([]);
  });
});
