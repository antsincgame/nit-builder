// Turns the tech-terminal preset into a real injectable dev-tool direction.
import type { StylePreset } from "./types";

/**
 * Tech-terminal — CRT-phosphor/dev-tool эстетика с моно-шрифтами и ASCII-артом.
 */
export const TECH_TERMINAL_PRESET: StylePreset = {
  id: "tech-terminal",
  name: "Tech Terminal",
  tagline: "CRT-phosphor, dev-tool",
  description:
    "Моноширинные шрифты, phosphor-зелёный текст, ASCII-рамки, curor-blink, hex-палитры. Для DevTools, CLI-продуктов, cybersec.",
  available: true,
  tokens: {
    palette: ["#06120d", "#d6ffe9", "#39ff88", "#163526", "#0b1f16"],
    fontDisplay: "JetBrains Mono",
    fontBody: "JetBrains Mono",
  },
  principles: [
    "Dev-tool/terminal aesthetic: mono typography, command panels, logs, status LEDs.",
    "CRT phosphor palette: deep green-black, bright green accent, pale terminal text.",
    "Use ASCII dividers, terminal prompts, code-like cards and compact dashboards.",
    "Avoid generic SaaS whitespace and avoid neon-cyber magenta/cyan glitch language.",
  ],
  signatureMoves: [
    `.terminal { font-family:'JetBrains Mono', monospace; background:#06120d; color:#d6ffe9; border:1px solid rgba(57,255,136,.28); }`,
    `.prompt::before { content:'$ '; color:#39ff88; }`,
    `.cursor { animation:blink 1s steps(2) infinite; } @keyframes blink { 50% { opacity:0; } }`,
  ],
  systemPromptAddon: `
СТИЛЬ: TECH TERMINAL.

Палитра:
  background #06120d   panel #0b1f16   text #d6ffe9   accent #39ff88

Правила:
  1. Вся визуальная система похожа на polished developer tool / terminal dashboard.
  2. Используй JetBrains Mono, command panels, logs, status LEDs, ASCII dividers.
  3. Не используй magenta/cyan glitch из neon-cyber. Это terminal, не cyber poster.
  4. Hero должен включать terminal/product mockup с понятными строками процесса.
  5. Сохраняй читаемость и коммерческий CTA, не превращай страницу в хаотичный ASCII-art.`,
};
