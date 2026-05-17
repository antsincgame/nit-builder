import { describe, expect, it } from "vitest";
import { inferArtifactModeFromPrompt } from "~/lib/utils/artifactMode";

describe("inferArtifactModeFromPrompt", () => {
  it("detects PHP backend prompts", () => {
    expect(inferArtifactModeFromPrompt("магазин на PHP SQLite с товарами и оплатой")).toBe("php-sqlite");
    expect(inferArtifactModeFromPrompt("backend on PHP MySQL with admin checkout payments")).toBe("php-sqlite");
    expect(inferArtifactModeFromPrompt("бэкенд на пхп с заказами и админкой")).toBe("php-sqlite");
  });

  it("does not force backend mode for regular HTML prompts", () => {
    expect(inferArtifactModeFromPrompt("сделай лендинг для кофейни")).toBeUndefined();
    expect(inferArtifactModeFromPrompt("добавь товары в HTML секцию без backend")).toBeUndefined();
    expect(inferArtifactModeFromPrompt("admin dashboard design in static HTML")).toBeUndefined();
  });
});
