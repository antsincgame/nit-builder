// Adds a calm Apple/Linear-style preset to avoid boring generic SaaS output.
import type { StylePreset } from "./types";

export const CLEAN_SAAS_PRESET: StylePreset = {
  id: "clean-saas",
  name: "Clean SaaS",
  tagline: "Apple/Linear clarity",
  description:
    "Светлый premium SaaS: воздух, спокойная типографика, мягкие карточки, product mockup и сдержанные синие акценты.",
  available: true,
  tokens: {
    palette: ["#ffffff", "#f8fafc", "#0f172a", "#2563eb", "#64748b"],
    fontDisplay: "Inter",
    fontBody: "Inter",
  },
  principles: [
    "Белый или почти белый фон, никаких тёмных cyber-фонов и кислотного неона.",
    "Крупный hero с большим количеством воздуха, но обязательно с product mockup справа или ниже.",
    "Скругления 20-32px, тонкие border rgba(15,23,42,.08), мягкие тени rgba(15,23,42,.08-.14).",
    "CTA синий #2563eb или графитовый, без uppercase letter-spaced cyber-кнопок.",
    "Карточки должны выглядеть как дорогой SaaS UI: dashboard preview, status chips, metric cards.",
    "Тексты короткие и конкретные; не использовать generic-заголовки «Почему выбирают нас».",
  ],
  signatureMoves: [
    `.hero { display:grid; grid-template-columns:1fr minmax(360px,.9fr); gap:48px; align-items:center; }`,
    `.product-mockup { border-radius:32px; background:rgba(255,255,255,.82); box-shadow:0 30px 90px rgba(15,23,42,.12); }`,
    `.card { border:1px solid rgba(15,23,42,.08); border-radius:24px; background:#fff; box-shadow:0 18px 45px rgba(15,23,42,.08); }`,
  ],
  systemPromptAddon: `
СТИЛЬ: CLEAN SAAS (Apple / Linear / Stripe clarity).

Строго избегай: cyberpunk, neon, glitch, brutalism, кислотные цвета, грубую grid/HUD эстетику.

Палитра:
  фон #ffffff или #f8fafc   текст #0f172a   muted #64748b   accent #2563eb

Композиция:
  1. Hero — просторный, premium SaaS. Заголовок крупный, но без outline/glitch.
  2. Обязательно добавь product mockup: browser/dashboard card с status chips, progress, preview panels.
  3. Карточки: border-radius 20-32px, border rgba(15,23,42,.08), мягкие тени.
  4. Используй один синий accent, максимум один дополнительный violet tint. Никакого magenta/acid.
  5. CTA нормальным регистром, не uppercase cyber.
  6. Не оставляй пустой boilerplate: каждая секция должна иметь конкретный бизнес-смысл.

Глубина (чтобы светлый минимализм не был пресно-серым):
  - Hero на очень светлом меш/радиальном градиенте из оттенков синего (#2563eb), не на голом белом.
  - Главный заголовок hero — с градиентной заливкой текста от графита к синему.
  - Иконки в карточках — в капсулах с синим градиентным фоном, не серые квадраты.
  - Тени карточек и кнопок — с лёгким синим оттенком (rgba(37,99,235,...)), подъём на ховере.
  - Выдели один ключевой элемент (тариф/карточку) синим ободком.

Если запрос просит Apple-style / Linear / Stripe / clean / светлый / минималистичный — следуй этому preset даже если план color_mood другой.`,
};
