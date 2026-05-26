// Adds a warm premium preset for lively non-neon commercial SaaS pages.
import type { StylePreset } from "./types";

export const WARM_PREMIUM_PRESET: StylePreset = {
  id: "warm-premium",
  name: "Warm Premium",
  tagline: "Ivory, gradients, product depth",
  description:
    "Тёплый дорогой SaaS/студийный стиль: ivory фон, graphite текст, blue/violet/peach mesh-gradients, glass cards и сложный hero mockup.",
  available: true,
  tokens: {
    palette: ["#fbf7ef", "#fffaf3", "#111827", "#2563eb", "#7c3aed", "#f97316"],
    fontDisplay: "Inter",
    fontBody: "Inter",
  },
  principles: [
    "Фон тёплый ivory/cream, не белая пустота и не dark cyber.",
    "Hero должен иметь слои: сильный оффер, декоративный mesh glow, product/browser mockup.",
    "Используй blue/violet/peach gradients дозированно, как premium glow, не как неон.",
    "Карточки glass-like: rgba white, blur, border rgba(255,255,255,.7), тени мягкие.",
    "Текст коммерческий, конкретный, без lorem и англоязычных заглушек.",
    "Секции должны быть плотными: process timeline, comparison, showcase, pricing, FAQ.",
  ],
  signatureMoves: [
    `.mesh { background: radial-gradient(circle at 20% 10%, rgba(37,99,235,.16), transparent 28rem), radial-gradient(circle at 80% 18%, rgba(249,115,22,.16), transparent 26rem); }`,
    `.glass { background:rgba(255,255,255,.74); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,.72); }`,
    `.browser-card { border-radius:34px; box-shadow:0 30px 90px rgba(31,41,55,.12); overflow:hidden; }`,
  ],
  systemPromptAddon: `
СТИЛЬ: WARM PREMIUM SAAS.

Строго избегай: cyberpunk, glitch, brutalism, кислотный neon, грубую technical grid как главный мотив, скучный белый boilerplate.

Палитра:
  ivory #fbf7ef   cream #fffaf3   graphite #111827   blue #2563eb   violet #7c3aed   peach #f97316

Композиция:
  1. Hero — как дорогой SaaS/product page: слева оффер, справа сложный browser/dashboard mockup.
  2. Обязательно добавь 2-3 floating cards: status, privacy, local model, progress или metrics.
  3. Фон: мягкие mesh-glow blobs, без scanline/glitch.
  4. Карточки: 24-36px radius, rgba white, backdrop-filter blur, subtle border, premium shadows.
  5. Pricing и showcase должны выглядеть как реальные продуктовые блоки, не учебный пример.
  6. Все visible text на языке plan.language. Никаких "A dedicated narrative block" и других заглушек.

Если пользователь просит premium / дорогой / warm / Framer / Stripe / живой светлый SaaS — выбирай этот visual language.`,
};
