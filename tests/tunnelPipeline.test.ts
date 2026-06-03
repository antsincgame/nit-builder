import { describe, it, expect } from "vitest";
import {
  parseTunnelPlan,
  resolveTunnelPlan,
  finalizeTunnelHtml,
} from "~/lib/services/tunnelPipeline.server";

describe("tunnelPipeline", () => {
  describe("parseTunnelPlan", () => {
    it("парсит валидный JSON-план (в т.ч. в markdown-обёртке)", () => {
      const raw =
        "```json\n" +
        JSON.stringify({
          business_type: "кофейня",
          sections: ["hero", "menu", "contact"],
          suggested_template_id: "coffee-shop",
        }) +
        "\n```";
      const plan = parseTunnelPlan(raw, "кофейня в москве");
      expect(plan.business_type).toBe("кофейня");
      expect(plan.sections.length).toBeGreaterThan(0);
      expect(typeof plan.suggested_template_id).toBe("string");
    });

    it("на мусоре возвращает synthetic-план (не падает)", () => {
      const plan = parseTunnelPlan("это вообще не json", "сделай лендинг для пекарни");
      expect(typeof plan.business_type).toBe("string");
      expect(plan.business_type.length).toBeGreaterThan(0);
      expect(plan.sections.length).toBeGreaterThan(0);
      expect(typeof plan.suggested_template_id).toBe("string");
    });
  });

  describe("resolveTunnelPlan", () => {
    it("для стилевого пресета (не generic) идёт в coder-фазу", () => {
      const plan = parseTunnelPlan(
        JSON.stringify({
          business_type: "кофейня",
          sections: ["hero", "menu", "contact"],
          suggested_template_id: "coffee-shop",
        }),
        "кофейня",
      );
      const res = resolveTunnelPlan(plan, "кофейня", "neon-cyber");
      expect(res.kind).toBe("coder");
      if (res.kind === "coder") {
        expect(res.system.length).toBeGreaterThan(0);
        expect(res.prompt.length).toBeGreaterThan(0);
        expect(typeof res.templateId).toBe("string");
        expect(res.presetId).toBe("neon-cyber");
      }
    });
  });

  describe("finalizeTunnelHtml", () => {
    it("чистит обёртки и достраивает HTML", () => {
      const plan = parseTunnelPlan(
        JSON.stringify({
          business_type: "кофейня",
          sections: ["hero", "contact"],
          suggested_template_id: "coffee-shop",
        }),
        "кофейня",
      );
      const out = finalizeTunnelHtml(
        "```html\n<!DOCTYPE html><html><body><h1>Кофе</h1></body></html>\n```",
        plan,
        "neon-cyber",
      );
      expect(out.toLowerCase()).toContain("</html>");
      expect(out).not.toContain("```");
    });
  });
});
