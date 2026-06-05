// Adds a bold pop preset for loud, friendly, high-contrast pages.
import type { StylePreset } from "./types";

export const BOLD_POP_PRESET: StylePreset = {
  id: "bold-pop",
  name: "Bold Pop",
  tagline: "Ink outlines, offset shadows, sticker energy",
  description:
    "Яркий нео-поп стиль: чёрные обводки, офсетные тени, сочные плашки и стикер-бейджи. Для срочных служб, детских центров, ивентов и стритфуда.",
  available: true,
  tokens: {
    palette: ["#fffbeb", "#111111", "#ffd60a", "#ff5d8f", "#3a86ff", "#8338ec"],
    fontDisplay: "Archivo Black",
    fontBody: "Inter",
  },
  principles: [
    "Фон светлый тёплый #fffbeb — яркость дают плашки, а не фон целиком.",
    "Карточки и кнопки — чёрная обводка 3px + жёсткая офсетная тень (6-8px 0 блюра).",
    "Заголовки огромные плотные (Archivo Black), цвет ink #111111.",
    "Стикер-бейджи под углом 3-6° с обводкой — для акций, цифр, «24/7».",
    "Никакой прозрачности, blur и пастели — цвета чистые и сочные.",
    "Секции чередуют цветные плашки (yellow/pink/blue) с нейтральным фоном.",
    "Это дружелюбный поп, не киберпанк: без глитча, без неона-на-чёрном.",
  ],
  signatureMoves: [
    `.pop-card { border: 3px solid #111; box-shadow: 8px 8px 0 #111; border-radius: 16px; background: #fff; }`,
    `.sticker { transform: rotate(-4deg); background: #ffd60a; border: 3px solid #111; border-radius: 12px; padding: .35rem .9rem; font-weight: 800; }`,
    `.btn-pop { background: #ff5d8f; color: #111; border: 3px solid #111; box-shadow: 5px 5px 0 #111; border-radius: 14px; font-weight: 800; }`,
    `.btn-pop:hover { transform: translate(2px,2px); box-shadow: 3px 3px 0 #111; }`,
  ],
  systemPromptAddon: `
СТИЛЬ: BOLD POP.

Строго избегай: пастель и бледные цвета, glassmorphism/blur, тонкую серую типографику, неон-на-чёрном, glitch и cyber-эстетику.

Палитра:
  bg #fffbeb   ink #111111   yellow #ffd60a   pink #ff5d8f   blue #3a86ff   purple #8338ec

Композиция:
  1. Hero: огромный плотный заголовок ink (Archivo Black), рядом 1-2 стикер-бейджа под углом с ключевыми цифрами («за 60 минут», «24/7»).
  2. Все карточки/кнопки/инпуты — чёрная обводка 3px + офсетная тень без блюра; hover — сдвиг к тени.
  3. Секции чередуются: нейтральный фон → сочная плашка (yellow/pink/blue) с ink-текстом.
  4. Иконки жирные, эмодзи допустимы в бейджах умеренно.
  5. Pricing: highlighted-тариф на жёлтой плашке с увеличенной тенью и стикером «хит».
  6. Скругления 12-18px — дружелюбно, но не пилюли.
  7. Все visible text на языке plan.language, без заглушек.

Если пользователь просит ярко / сочно / игриво / поп-арт / стикеры — выбирай этот visual language.`,
};
