// Adds a dark luxe preset for premium night-toned business pages.
import type { StylePreset } from "./types";

export const DARK_LUXE_PRESET: StylePreset = {
  id: "dark-luxe",
  name: "Dark Luxe",
  tagline: "Graphite, brass, editorial serif",
  description:
    "Премиальный тёмный стиль: тёплый графитовый фон, латунный акцент, крупная serif-типографика, hairline-бордеры. Для юристов, бутик-отелей, премиум-фитнеса и студий.",
  available: true,
  tokens: {
    palette: ["#0c0a09", "#1c1917", "#e7e5e4", "#c6a15b", "#8b1e3f", "#44403c"],
    fontDisplay: "Playfair Display",
    fontBody: "Inter",
  },
  principles: [
    "Фон — тёплый почти-чёрный (#0c0a09/#1c1917), НЕ синий slate dark-mode и НЕ плоский #000.",
    "Один благородный акцент — латунь #c6a15b, дозированно: линии, цифры, бордеры кнопок.",
    "Заголовки крупные serif (Playfair Display), body — сдержанный Inter.",
    "Hairline-бордеры rgba-латуни вместо толстых рамок и тяжёлых теней.",
    "Много воздуха: щедрые отступы секций, никакой тесноты.",
    "Цифры и факты оформлять крупно, как в annual report: большое число + мелкая подпись.",
    "Никакого неона, глитча, scanline и кислотных градиентов.",
  ],
  signatureMoves: [
    `.hairline { border: 1px solid rgba(198,161,91,.28); }`,
    `.lux-card { background: linear-gradient(180deg, #1c1917 0%, #171412 100%); border: 1px solid rgba(198,161,91,.18); border-radius: 18px; }`,
    `.brass-rule { height: 1px; width: 72px; background: #c6a15b; }`,
    `.stat-num { font-family: 'Playfair Display', serif; font-size: clamp(2.6rem, 5vw, 4.2rem); color: #c6a15b; }`,
  ],
  systemPromptAddon: `
СТИЛЬ: DARK LUXE.

Строго избегай: neon/glitch/cyber, синий generic dark-mode (slate #0f172a), плоский чёрный без глубины, тяжёлые цветные тени, более одного акцентного цвета.

Палитра:
  near-black #0c0a09   charcoal #1c1917   stone-text #e7e5e4   brass #c6a15b   bordeaux #8b1e3f   border #44403c

Композиция:
  1. Hero — огромный serif-заголовок (Playfair Display), под ним короткая латунная линия-разделитель 72px.
  2. Карточки с едва заметным вертикальным градиентом charcoal и hairline-бордером rgba-латуни.
  3. Цифры/факты — крупным serif цвета brass с мелкой подписью stone.
  4. Кнопки: primary — заливка brass с тёмным текстом; secondary — контурная с бордером rgba(198,161,91,.4).
  5. Фото-зоны — с тёмным оверлеем linear-gradient(rgba(12,10,9,.35), rgba(12,10,9,.8)).
  6. Бордо #8b1e3f — только точечно (бейдж «VIP», highlighted-тариф), не большими площадями.
  7. Все visible text на языке plan.language, без lorem и англоязычных заглушек.

Если пользователь просит люкс / элитный / дорогой тёмный / noir — выбирай этот visual language.`,
};
