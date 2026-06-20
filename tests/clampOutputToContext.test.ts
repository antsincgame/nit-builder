import { describe, it, expect } from "vitest";
import { clampOutputToContext } from "~/lib/services/tunnelPipeline.server";

describe("clampOutputToContext", () => {
  it("неизвестный/0 контекст → не трогает (старый клиент туннеля)", () => {
    expect(clampOutputToContext(undefined, 5000, 8000)).toBe(8000);
    expect(clampOutputToContext(0, 5000, 8000)).toBe(8000);
  });

  it("рекомендованный 32k + обычный промпт → no-op (не зажимает)", () => {
    // ~12000 символов промпта (~4000 токенов) + 8000 выхода + резерв << 32000.
    expect(clampOutputToContext(32_000, 12_000, 8000)).toBe(8000);
    // даже крупный промпт 45k символов (~15000 токенов) + 8000 ещё влезает.
    expect(clampOutputToContext(32_000, 45_000, 8000)).toBe(8000);
  });

  it("малый контекст (4096) + обычный промпт → зажимает выход", () => {
    const out = clampOutputToContext(4096, 9000, 8000); // ~3000 ток промпт
    expect(out).toBeLessThan(8000);
    expect(out).toBeGreaterThanOrEqual(768);
  });

  it("гарантирует prompt + output ≤ context, когда зажим срабатывает", () => {
    const ctx = 8192;
    const promptChars = 15_000; // ~5000 токенов
    const out = clampOutputToContext(ctx, promptChars, 16_000);
    const estPromptTokens = Math.ceil(promptChars / 3.0);
    // output + промпт + небольшой резерв не превышает контекст
    expect(estPromptTokens + out).toBeLessThanOrEqual(ctx);
  });

  it("никогда не опускает ниже пола 768 (даём шанс continuation)", () => {
    // Промпт почти заполняет контекст → available отрицателен, но пол держит.
    expect(clampOutputToContext(2048, 30_000, 8000)).toBe(768);
  });

  it("когда контекст огромен относительно запроса — возвращает ровно запрошенное", () => {
    expect(clampOutputToContext(128_000, 1000, 4000)).toBe(4000);
  });
});
