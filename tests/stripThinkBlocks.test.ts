import { describe, it, expect } from "vitest";
import { stripThinkBlocks } from "../app/lib/services/htmlOrchestrator.helpers";

/**
 * Тесты среза think-блоков reasoning-моделей (Qwen3, DeepSeek-R1).
 * Размышления приходят в content и без среза ломают план-парсер и HTML.
 */

describe("stripThinkBlocks", () => {
  it("вырезает закрытый <think>...</think>", () => {
    const input = "<think>надо выбрать шаблон кофейни</think>{\"business_type\":\"кафе\"}";
    expect(stripThinkBlocks(input)).toBe('{"business_type":"кафе"}');
  });

  it("вырезает <thinking>...</thinking>", () => {
    const input = "<thinking>план...</thinking><!DOCTYPE html><html></html>";
    expect(stripThinkBlocks(input)).toBe("<!DOCTYPE html><html></html>");
  });

  it("вырезает НЕЗАКРЫТЫЙ хвостовой think (обрыв по max_tokens)", () => {
    const input = "<think>модель упёрлась в лимит посреди размышлен";
    expect(stripThinkBlocks(input)).toBe("");
  });

  it("вырезает несколько think-блоков", () => {
    const input = "<think>раз</think>A<think>два</think>B";
    expect(stripThinkBlocks(input)).toBe("AB");
  });

  it("многострочный think с переносами", () => {
    const input = "<think>\nстрока 1\nстрока 2\n</think>\nрезультат";
    expect(stripThinkBlocks(input)).toBe("результат");
  });

  it("не трогает текст без think-блоков", () => {
    const html = "<!DOCTYPE html><html><body>ok</body></html>";
    expect(stripThinkBlocks(html)).toBe(html);
  });

  it("не трогает слова вроде 'rethink' внутри текста", () => {
    const text = "we should rethink the layout";
    expect(stripThinkBlocks(text)).toBe(text);
  });

  it("регистронезависимо: <THINK>", () => {
    const input = "<THINK>шум</THINK>чисто";
    expect(stripThinkBlocks(input)).toBe("чисто");
  });
});
