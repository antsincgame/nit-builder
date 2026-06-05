// Adds an earthy craft preset for organic, artisan and renovation niches.
import type { StylePreset } from "./types";

export const EARTH_CRAFT_PRESET: StylePreset = {
  id: "earth-craft",
  name: "Earth Craft",
  tagline: "Paper, terracotta, hand-made warmth",
  description:
    "Натуральный ремесленный стиль: бумажно-песочный фон, олива и терракота, пунктирные «ручные» детали. Для эко-брендов, кофеен, хендмейда, ремонта и флористики.",
  available: true,
  tokens: {
    palette: ["#f7f3ec", "#efe7d8", "#2f2a23", "#6b7f59", "#b4652f", "#d9cdb8"],
    fontDisplay: "Fraunces",
    fontBody: "Inter",
  },
  principles: [
    "Фон — бумажный #f7f3ec / песочный #efe7d8, НЕ стерильный белый и НЕ тёмный.",
    "Два земляных акцента: олива #6b7f59 и терракота #b4652f. CTA — терракота.",
    "Заголовки — мягкий характерный serif (Fraunces), без крика и капса.",
    "«Ручные» детали: dashed-бейджи-штампы, пунктирные разделители, без глянца.",
    "Скругления умеренные 12-20px, никаких пилюль-карточек и glassmorphism.",
    "Тени естественные и едва заметные, без цветных glow.",
    "Фото-зоны в рамках цвета песка, как паспарту.",
  ],
  signatureMoves: [
    `.stamp-badge { border: 1.5px dashed #b4652f; color: #b4652f; border-radius: 999px; padding: .4rem 1rem; }`,
    `.rough-divider { height: 2px; background: repeating-linear-gradient(90deg, #d9cdb8 0 14px, transparent 14px 24px); }`,
    `.craft-card { background: #fffdf8; border: 1px solid #d9cdb8; border-radius: 16px; box-shadow: 0 8px 24px rgba(47,42,35,.06); }`,
    `.photo-mat { border: 10px solid #efe7d8; border-radius: 14px; }`,
  ],
  systemPromptAddon: `
СТИЛЬ: EARTH CRAFT.

Строго избегай: неон и glitch, glassmorphism/backdrop-blur, корпоративный синий, стерильно-белый фон, градиентные glow-пятна.

Палитра:
  paper #f7f3ec   sand #efe7d8   espresso #2f2a23   olive #6b7f59   terracotta #b4652f   border #d9cdb8

Композиция:
  1. Hero на бумажном фоне: крупный мягкий serif (Fraunces), рядом dashed-бейдж-штамп с коротким фактом.
  2. Секции разделять пунктирными «ручными» линиями (repeating-linear-gradient), не жирными бордерами.
  3. Карточки кремовые с тонким песочным бордером и мягкой тенью.
  4. Фото-зоны — в широкой рамке-паспарту цвета песка.
  5. Иконки тонкие линейные цвета оливы; CTA — терракотовая заливка с кремовым текстом.
  6. Допустим лёгкий наклон одного-двух элементов (rotate до 2°) для рукотворности — не больше.
  7. Все visible text на языке plan.language, без заглушек.

Если пользователь просит эко / крафт / натуральное / ремесленное — выбирай этот visual language.`,
};
