// Tests for Agent polish output parsing and tunnel phase builder.
import { describe, expect, it } from "vitest";
import {
  parseAgentPolishOutput,
  extractHtmlForPreview,
} from "~/lib/services/agentPolish";
import {
  buildTunnelAgentPolishPhase,
  buildTunnelPolishPhase,
} from "~/lib/services/tunnelPipeline.server";

const PREV = "<!DOCTYPE html><html><body><h1>Old</h1></body></html>";

describe("parseAgentPolishOutput", () => {
  it("splits summary and html at <!DOCTYPE html>", () => {
    const raw = "• Сменил бренд\n• Обновил SEO\n\n<!DOCTYPE html><html></html>";
    const parsed = parseAgentPolishOutput(raw);
    expect(parsed.summary).toContain("Сменил бренд");
    expect(parsed.html).toMatch(/^<!DOCTYPE html>/i);
  });

  it("returns full string as html when no doctype prefix", () => {
    const parsed = parseAgentPolishOutput("<!DOCTYPE html><html></html>");
    expect(parsed.summary).toBe("");
    expect(parsed.html).toContain("<!DOCTYPE html>");
  });
});

describe("extractHtmlForPreview", () => {
  it("returns empty until doctype appears", () => {
    expect(extractHtmlForPreview("• думаю…")).toBe("");
  });

  it("returns html slice after doctype", () => {
    const raw = "summary\n\n<!DOCTYPE html><html></html>";
    expect(extractHtmlForPreview(raw)).toBe("<!DOCTYPE html><html></html>");
  });
});

describe("buildTunnelAgentPolishPhase", () => {
  it("builds agent phase with higher temperature than classic polish", () => {
    const classic = buildTunnelPolishPhase(PREV, "смени бренд")!;
    const agent = buildTunnelAgentPolishPhase(PREV, "смени бренд")!;
    expect(agent.temperature).toBeGreaterThan(classic.temperature);
    expect(agent.system).toContain("LM Studio");
    expect(agent.prompt).toContain(PREV);
  });

  it("returns null for empty html", () => {
    expect(buildTunnelAgentPolishPhase("", "fix")).toBeNull();
  });
});
