// Verifies deterministic post-polish fixes common generated HTML failures.
import { describe, expect, it } from "vitest";
import { postPolishHtml } from "~/lib/services/htmlPostPolish";
import type { Plan } from "~/lib/utils/planSchema";

const PLAN: Plan = {
  business_type: "AI студия",
  target_audience: "предприниматели",
  tone: "премиум",
  style_hints: "warm premium",
  color_mood: "warm-pastel",
  sections: ["hero", "features", "contact"],
  keywords: ["локальный AI"],
  cta_primary: "Собрать сайт",
  language: "ru",
  suggested_template_id: "saas-landing",
};

describe("postPolishHtml", () => {
  it("заменяет boilerplate copy на русский осмысленный текст", () => {
    const result = postPolishHtml({
      html: "<p>A dedicated narrative block for локальный AI, connected to the main conversion path.</p>",
      presetId: "warm-premium",
      plan: PLAN,
    });

    expect(result.fixes).toContain("boilerplate-copy");
    expect(result.html).toContain("Практический блок про локальный AI");
    expect(result.html).not.toContain("A dedicated narrative block");
  });

  it("добавляет light override если светлый preset получил neon leak", () => {
    const result = postPolishHtml({
      html: "<html><head></head><body><h1 class=\"glitch\">Title</h1><style>.x{color:#ff2e93}</style></body></html>",
      presetId: "clean-saas",
      plan: PLAN,
    });

    expect(result.fixes).toContain("light-style-override");
    expect(result.fixes).toContain("neon-token-rewrite");
    expect(result.html).toContain("nit-post-polish-style");
    expect(result.html).toContain("--nit-polish-bg:#f8fafc");
    expect(result.html).not.toContain("#ff2e93");
  });

  it("не триггерит light override на слово 'cybersecurity' в копирайте без реальных neon-токенов", () => {
    const result = postPolishHtml({
      html: "<html><head></head><body><h1>Cybersecurity для бизнеса</h1><p>Надёжная защита без лишней суеты.</p></body></html>",
      presetId: "clean-saas",
      plan: PLAN,
    });

    expect(result.fixes).not.toContain("light-style-override");
    expect(result.fixes).not.toContain("neon-token-rewrite");
    expect(result.html).not.toContain("nit-post-polish-style");
  });
});
