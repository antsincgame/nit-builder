// Experimental Agent polish: conversational summary + full HTML rewrite (no css_patch cascade).
import { stripCodeFences, stripThinkBlocks } from "~/lib/services/htmlOrchestrator.helpers";
import {
  AGENT_POLISHER_SYSTEM_PROMPT,
  buildAgentPolisherUserMessage,
} from "~/lib/config/htmlPrompts";

export type AgentPolishSplit = {
  summary: string;
  html: string;
};

/** Отделяет текстовое резюме модели от HTML (всё до <!DOCTYPE html>). */
export function parseAgentPolishOutput(raw: string): AgentPolishSplit {
  const withoutThink = stripThinkBlocks(raw).trim();
  const docIdx = withoutThink.search(/<!DOCTYPE html>/i);
  if (docIdx === -1) {
    return { summary: "", html: stripCodeFences(withoutThink) };
  }
  const summary = docIdx > 0 ? withoutThink.slice(0, docIdx).trim() : "";
  const html = stripCodeFences(withoutThink.slice(docIdx));
  return { summary, html };
}

export function extractHtmlForPreview(accumulated: string): string {
  const idx = accumulated.search(/<!DOCTYPE html>/i);
  return idx === -1 ? "" : accumulated.slice(idx);
}

export type AgentPolishPhase = {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
};

export function buildAgentPolishPhase(
  previousHtml: string,
  userRequest: string,
  maxOutputTokens: number,
): AgentPolishPhase | null {
  if (!previousHtml.trim()) return null;
  return {
    system: AGENT_POLISHER_SYSTEM_PROMPT,
    prompt: buildAgentPolisherUserMessage({ currentHtml: previousHtml, userRequest }),
    maxOutputTokens,
    temperature: 0.55,
  };
}
