// Tests unified polish completion message (agent summary + diff).
import { describe, expect, it } from "vitest";
import { buildPolishCompletionMessage } from "~/lib/utils/polishCompletion";

const BEFORE = `<!DOCTYPE html><html><head><title>Old</title></head><body><h1>Old</h1></body></html>`;
const AFTER = `<!DOCTYPE html><html><head><title>NewBrand</title></head><body><header><a>NewBrand</a></header><h1>New Headline</h1></body></html>`;

describe("buildPolishCompletionMessage", () => {
  it("merges agent summary with HTML diff warnings", () => {
    const msg = buildPolishCompletionMessage({
      html: AFTER,
      previousHtml: BEFORE,
      userPrompt: "смени название на NewBrand",
      durationMs: 3200,
      agentSummary: "• Обновил бренд\n• Поправил SEO",
    });
    expect(msg).toContain("Обновил бренд");
    expect(msg).toContain("Title");
    expect(msg).toContain("3.2");
  });

  it("warns when HTML unchanged despite agent summary", () => {
    const msg = buildPolishCompletionMessage({
      html: BEFORE,
      previousHtml: BEFORE,
      userPrompt: "смени бренд",
      durationMs: 1000,
      agentSummary: "• Всё готово",
    });
    expect(msg).toContain("HTML не изменился");
  });
});
