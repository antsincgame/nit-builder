// Unified polish completion: agent summary + HTML diff + explicit edit warnings.
import type { ServerToBrowser } from "@nit/shared";
import {
  buildAssistantCompletionMessage,
  describePolishChanges,
} from "~/lib/utils/completionMessage";

type Telemetry = Extract<ServerToBrowser, { type: "generate_done" }>["telemetry"];

export function buildPolishCompletionMessage(params: {
  html: string;
  previousHtml: string;
  userPrompt: string;
  durationMs: number;
  agentSummary?: string;
  explicitApplied?: string[];
  explicitMissed?: string[];
  telemetry?: Telemetry;
}): string {
  const secs = (params.durationMs / 1000).toFixed(1);
  const diffLines = describePolishChanges(params.previousHtml, params.html, params.userPrompt);
  const unchanged = params.previousHtml === params.html;

  const bullets: string[] = [];

  if (params.agentSummary?.trim()) {
    bullets.push(params.agentSummary.trim());
    if (unchanged) {
      bullets.push("⚠️ HTML не изменился — проверь превью или переформулируй запрос");
    }
  }

  for (const line of diffLines) {
    if (!bullets.includes(line)) bullets.push(line);
  }

  for (const a of params.explicitApplied ?? []) {
    const line = `✓ ${a}`;
    if (!bullets.some((b) => b.includes(a))) bullets.push(line);
  }
  for (const m of params.explicitMissed ?? []) {
    bullets.push(`⚠️ Не удалось применить: ${m}`);
  }

  if (bullets.length === 0) {
    return buildAssistantCompletionMessage({
      html: params.html,
      previousHtml: params.previousHtml,
      userPrompt: params.userPrompt,
      isPolish: true,
      durationMs: params.durationMs,
      telemetry: params.telemetry,
    });
  }

  const body = bullets.map((c) => `• ${c}`).join("\n");
  const base = buildAssistantCompletionMessage({
    html: params.html,
    previousHtml: params.previousHtml,
    userPrompt: params.userPrompt,
    isPolish: true,
    durationMs: params.durationMs,
    telemetry: params.telemetry,
  });
  const diagIdx = base.indexOf("\n\nДиагностика:");
  const warningsIdx = base.indexOf("\n\n⚠️");
  const tailStart =
    warningsIdx >= 0 ? warningsIdx : diagIdx >= 0 ? diagIdx : base.length;
  const tail = base.slice(tailStart);

  return `Готово ✨ Применил за ${secs}с:\n\n${body}${tail}`;
}
