// Regression checks for free-form custom HTML generation guardrails.
import { describe, expect, it } from "vitest";
import { inferStylePresetId, type StylePresetId } from "~/lib/llm/style-presets";
import { buildCustomArtifactHtml } from "~/lib/services/customArtifactBuilder";
import { postPolishHtml } from "~/lib/services/htmlPostPolish";
import type { Plan } from "~/lib/utils/planSchema";

const BASE_PLAN: Plan = {
  business_type: "Local GPU Web Lab",
  target_audience: "малый бизнес",
  tone: "уверенный",
  style_hints: "premium",
  color_mood: "light-minimal",
  sections: ["hero", "features", "pricing", "faq", "contact"],
  keywords: ["локальный AI", "приватность", "генератор сайтов"],
  cta_primary: "Собрать сайт",
  language: "ru",
  suggested_template_id: "saas-landing",
  hero_headline: "Сайты на локальном AI",
  hero_subheadline: "Приватная генерация лендингов и MVP без облачной LLM.",
  key_benefits: [
    { title: "Приватно", description: "Промпты остаются локально." },
    { title: "Быстро", description: "Первый HTML появляется за минуты." },
    { title: "Без lock-in", description: "Скачайте обычный HTML или PHP-проект." },
  ],
};

const CASES: Array<{
  prompt: string;
  expectedPreset: StylePresetId;
  forbidden: string[];
}> = [
  {
    prompt: "светлый Apple-style лендинг как Linear, чисто и минималистично",
    expectedPreset: "clean-saas",
    forbidden: ["#ff2e93", "#d4ff00", "A dedicated narrative block"],
  },
  {
    prompt: "warm premium SaaS в стиле Framer/Stripe, без неона и glitch",
    expectedPreset: "warm-premium",
    forbidden: ["#33c7ff", "#ff2e93", "A dedicated narrative block"],
  },
  {
    prompt: "cyberpunk neon glitch лендинг для AI devtool",
    expectedPreset: "neon-cyber",
    forbidden: ["A dedicated narrative block"],
  },
];

describe("free generation regression", () => {
  for (const item of CASES) {
    it(`keeps custom fallback output controlled for ${item.expectedPreset}`, () => {
      const presetId = inferStylePresetId(item.prompt, BASE_PLAN);
      expect(presetId).toBe(item.expectedPreset);

      const raw = buildCustomArtifactHtml({
        plan: BASE_PLAN,
        userMessage: item.prompt,
        presetId,
      });
      const polished = postPolishHtml({ html: raw, presetId, plan: BASE_PLAN });

      for (const forbidden of item.forbidden) {
        expect(polished.html).not.toContain(forbidden);
      }
      expect(polished.html).toContain("<section");
      expect(polished.html).toContain(BASE_PLAN.cta_primary);
    });
  }
});
