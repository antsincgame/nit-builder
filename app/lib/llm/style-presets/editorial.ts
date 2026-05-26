// Turns the editorial preset into a real injectable art direction.
import type { StylePreset } from "./types";

/**
 * Editorial — журнальная типографика, засечки, крупные цифры, хайрлайн-правила.
 */
export const EDITORIAL_PRESET: StylePreset = {
  id: "editorial",
  name: "Editorial",
  tagline: "Журнальная типографика",
  description:
    "Засечки, крупные дроп-капсы, тонкие правила, чёрно-белая гамма с одним акцентом. Для журналов, блогов, портфолио, премиум-брендов.",
  available: true,
  tokens: {
    palette: ["#f4efe7", "#111111", "#8a5a44", "#d9c4a9", "#ffffff"],
    fontDisplay: "Playfair Display",
    fontBody: "Inter",
  },
  principles: [
    "Журнальная композиция: крупные serif-заголовки, узкие текстовые колонки, большие поля.",
    "Палитра тёплая бумажная: ivory, ink black, muted brown, без SaaS-синевы и неона.",
    "Используй тонкие hairline rules, большие номера секций, pull quotes, editorial cards.",
    "Фотографии заменяй graceful gradient/shape placeholders или inline SVG frames.",
  ],
  signatureMoves: [
    `.editorial-title { font-family:'Playfair Display', serif; font-size:clamp(4rem, 10vw, 9rem); line-height:.86; letter-spacing:-.06em; }`,
    `.rule { height:1px; background:rgba(17,17,17,.16); }`,
    `.drop-num { font-family:'Playfair Display', serif; font-size:7rem; color:#8a5a44; }`,
  ],
  systemPromptAddon: `
СТИЛЬ: EDITORIAL PREMIUM.

Палитра:
  paper #f4efe7   ink #111111   muted brown #8a5a44   soft line #d9c4a9

Правила:
  1. Используй журнальную композицию: крупные serif headline, большие поля, тонкие линии.
  2. Подключи Playfair Display для заголовков и Inter для body.
  3. Никакого neon/cyber/HUD/glitch. Никакого скучного blue SaaS boilerplate.
  4. Добавь pull quote, большие номера секций, editorial split-layout и graceful cards.
  5. CTA должен быть сдержанным, премиальным, не кислотным.`,
};
