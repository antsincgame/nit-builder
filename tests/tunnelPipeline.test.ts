import { describe, it, expect } from "vitest";
import {
  parseTunnelPlan,
  resolveTunnelPlan,
  finalizeTunnelHtml,
  buildTunnelPolishPhase,
  TUNNEL_POLISH_MAX_TOKENS,
} from "~/lib/services/tunnelPipeline.server";
import { POLISHER_SYSTEM_PROMPT } from "~/lib/config/htmlPrompts";

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

    it("без явного пресета выводит стиль ИЗ ПЛАНА (color_mood → neon-cyber)", () => {
      // План с vibrant-neon; в сообщении нет стилевых слов и явный пресет не
      // передан → пресет должен прийти из плана (как на серверном пути), а не
      // схлопнуться в generic (что увело бы в skeleton вместо neon-coder).
      const plan = parseTunnelPlan(
        JSON.stringify({
          business_type: "клуб",
          sections: ["hero", "contact"],
          suggested_template_id: "blank-landing",
          color_mood: "vibrant-neon",
        }),
        "клуб",
      );
      const res = resolveTunnelPlan(plan, "клуб"); // stylePresetIdInput НЕ передаём
      expect(res.kind).toBe("coder");
      if (res.kind === "coder") {
        expect(res.presetId).toBe("neon-cyber");
      }
    });

    it("класс L уходит в artifact-режим (bespoke), S — в шаблонный coder", () => {
      const plan = parseTunnelPlan(
        JSON.stringify({
          business_type: "кофейня",
          sections: ["hero", "menu", "contact"],
          suggested_template_id: "coffee-shop",
        }),
        "кофейня",
      );
      const sRes = resolveTunnelPlan(plan, "кофейня", "neon-cyber", "S");
      const lRes = resolveTunnelPlan(plan, "кофейня", "neon-cyber", "L");
      expect(sRes.kind).toBe("coder");
      expect(lRes.kind).toBe("coder");
      if (sRes.kind === "coder" && lRes.kind === "coder") {
        // artifact (L) использует ДРУГОЙ — bespoke — системный промпт и
        // user-message (генерация с нуля, без адаптации шаблона), а не coder.
        expect(lRes.system).not.toBe(sRes.system);
        expect(lRes.prompt).not.toBe(sRes.prompt);
        // Пресет пробрасывается в обоих режимах.
        expect(lRes.presetId).toBe("neon-cyber");
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

  describe("buildTunnelPolishPhase", () => {
    const PREV = "<!DOCTYPE html><html><body><h1>Кофейня</h1></body></html>";

    it("строит polish-фазу с POLISHER system + текущим HTML и запросом в prompt", () => {
      const phase = buildTunnelPolishPhase(PREV, "сделай шапку синей");
      expect(phase).not.toBeNull();
      expect(phase!.system).toBe(POLISHER_SYSTEM_PROMPT);
      // previousHtml вложен в user-message, чтобы модель правила его, а не делала новый сайт.
      expect(phase!.prompt).toContain(PREV);
      expect(phase!.prompt).toContain("сделай шапку синей");
      expect(phase!.maxOutputTokens).toBe(TUNNEL_POLISH_MAX_TOKENS);
      expect(phase!.temperature).toBeLessThanOrEqual(0.4);
    });

    it("возвращает null если previousHtml пуст или из пробелов (нечего полировать)", () => {
      expect(buildTunnelPolishPhase("", "сделай синее")).toBeNull();
      expect(buildTunnelPolishPhase("   \n  ", "сделай синее")).toBeNull();
    });

    it("санитизирует запрос пользователя (как HTTP-polish-путь)", () => {
      // sanitizeUserMessage срезает управляющие конструкции; проверяем, что
      // хотя бы безопасный текст доезжает и фаза строится.
      const phase = buildTunnelPolishPhase(PREV, "добавь блок с ценами");
      expect(phase).not.toBeNull();
      expect(phase!.prompt).toContain("добавь блок с ценами");
    });
  });
});
