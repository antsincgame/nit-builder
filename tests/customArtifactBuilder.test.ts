// Verifies fallback custom artifact builder respects non-neon style presets.
import { describe, expect, it } from "vitest";
import { buildCustomArtifactHtml } from "~/lib/services/customArtifactBuilder";
import type { Plan } from "~/lib/utils/planSchema";

const PLAN: Plan = {
  business_type: "Local GPU Web Lab",
  target_audience: "предприниматели",
  tone: "warm premium",
  style_hints: "Framer style",
  color_mood: "warm-pastel",
  sections: ["hero", "features", "pricing", "contact"],
  keywords: ["локальный AI", "GPU"],
  cta_primary: "Собрать сайт",
  language: "ru",
  suggested_template_id: "saas-landing",
};

describe("buildCustomArtifactHtml", () => {
  it("не включает neon palette для warm-premium preset", () => {
    const html = buildCustomArtifactHtml({
      plan: PLAN,
      userMessage: "warm premium SaaS без неона и glitch",
      presetId: "warm-premium",
    });

    expect(html).not.toContain("#33c7ff");
    expect(html).not.toContain("#ff2e93");
    // warm-premium (color_mood warm-pastel) берёт палитру из getPalette → фон #fdf6ec (v4 №2)
    expect(html).toContain("#fdf6ec");
    expect(html).not.toContain("A dedicated narrative block");
  });
});
