// Registers injectable style presets and auto-selects them from user intent.
import type { StylePreset, StylePresetId } from "./types";
import { GENERIC_PRESET } from "./generic";
import { NEON_CYBER_PRESET } from "./neon-cyber";
import { CLEAN_SAAS_PRESET } from "./clean-saas";
import { WARM_PREMIUM_PRESET } from "./warm-premium";
import { EDITORIAL_PRESET } from "./editorial";
import { TECH_TERMINAL_PRESET } from "./tech-terminal";
import { DARK_LUXE_PRESET } from "./dark-luxe";
import { EARTH_CRAFT_PRESET } from "./earth-craft";
import { BOLD_POP_PRESET } from "./bold-pop";

export { type StylePreset, type StylePresetId } from "./types";

export const STYLE_PRESETS: StylePreset[] = [
  GENERIC_PRESET,
  NEON_CYBER_PRESET,
  CLEAN_SAAS_PRESET,
  WARM_PREMIUM_PRESET,
  EDITORIAL_PRESET,
  TECH_TERMINAL_PRESET,
  DARK_LUXE_PRESET,
  EARTH_CRAFT_PRESET,
  BOLD_POP_PRESET,
];

const BY_ID = new Map<StylePresetId, StylePreset>(
  STYLE_PRESETS.map((p) => [p.id, p]),
);

export function getStylePreset(id: StylePresetId): StylePreset {
  return BY_ID.get(id) ?? GENERIC_PRESET;
}

export function isKnownPresetId(id: string): id is StylePresetId {
  return BY_ID.has(id as StylePresetId);
}

export function getAvailablePresets(): StylePreset[] {
  return STYLE_PRESETS.filter((p) => p.available);
}

type StyleIntentPlan = {
  color_mood?: string;
  style_hints?: string;
  tone?: string;
  business_type?: string;
  keywords?: string[];
};

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasAntiCyberIntent(text: string): boolean {
  return /без\s+(неон|глитч|glitch|cyber|кибер)|no\s+(neon|glitch|cyber)|avoid\s+(neon|glitch|cyber)/i.test(text);
}

// Стилевые паттерны матчатся ПО НАЧАЛУ СЛОВА (юникод-граница слева): подстрока
// внутри другого слова больше не срабатывает (нуар ⊂ Ренуар, неон ⊂ … и т.п.).
// Стемы намеренно остаются префиксами (минимал → минимализм, премиум →
// премиальный), поэтому правую границу НЕ ставим. [\p{L}\p{N}] + флаг u —
// корректная работа с кириллицей: JS \b опирается на [A-Za-z0-9_] и для
// кириллицы не работает. wb() оборачивает тело паттерна левой границей. (№3 v4)
//
// brutal/брутал УБРАНЫ из NEON: брутализм ≠ киберпанк. Для ниш, которые сам
// каталог называет «брутальными» (barbershop/tattoo), это слово должно
// оставлять маршрут за skeleton нишевого шаблона (preferTemplateSkeleton
// требует generic), а не уводить S-tier в neon-cyber → перекрашенный 7B.
const LEFT_WORD_BOUNDARY = "(?<![\\p{L}\\p{N}])";
function wb(body: string): RegExp {
  return new RegExp(LEFT_WORD_BOUNDARY + "(?:" + body + ")", "u");
}

const TERMINAL_PATTERNS = [wb("terminal|cli|console|crt|phosphor|терминал|командн|devops|cybersec")];
const EDITORIAL_PATTERNS = [wb("editorial|magazine|журнал|редакц|serif|luxury brand|fashion|портфолио|lookbook")];
const NEON_PATTERNS = [wb("cyber|кибер|neon|неон|glitch|глитч|hud|web3|crypto|крипт")];
const WARM_PATTERNS = [wb("warm|т[её]пл|premium|премиум|дорог|framer|stripe|живой|ivory|cream|peach")];
const CLEAN_PATTERNS = [wb("apple|linear|clean|minimal|минимал|светл|white|saas|стартап|b2b|dashboard")];
const DARK_LUXE_PATTERNS = [wb("люкс|luxe|элитн|нуар|noir")];
const EARTH_CRAFT_PATTERNS = [wb("эко(?!ном)|крафт|органик|натуральн|ремесл|керамик")];
const BOLD_POP_PATTERNS = [wb("ярк(ий|ая|ое|ие)|сочн|игрив|playful|поп.?арт|pop.?art|стикер|мемфис|memphis")];

export function inferStylePresetId(
  userMessage: string,
  plan?: StyleIntentPlan,
): StylePresetId {
  const userText = userMessage.toLowerCase();
  // color_mood НАМЕРЕННО не включается в keyword-скан: имена mood'ов
  // ("dark-premium", "vibrant-neon") содержат подстроки паттернов (premium,
  // neon) и перехватываются чужим пресетом (dark-premium уходил в
  // warm-premium по substring). Mood обрабатывается явными маппингами ниже.
  const planText = [
    plan?.style_hints,
    plan?.tone,
    plan?.business_type,
    ...(plan?.keywords ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
  const text = `${userText} ${planText}`.trim();

  // Explicit user wording wins over broader hints inferred by Planner.
  if (!hasAntiCyberIntent(userText) && hasAny(userText, NEON_PATTERNS)) return "neon-cyber";
  if (hasAny(userText, TERMINAL_PATTERNS)) return "tech-terminal";
  if (hasAny(userText, EDITORIAL_PATTERNS)) return "editorial";
  if (hasAny(userText, WARM_PATTERNS)) return "warm-premium";
  if (hasAny(userText, CLEAN_PATTERNS)) return "clean-saas";
  if (hasAny(userText, DARK_LUXE_PATTERNS)) return "dark-luxe";
  if (hasAny(userText, EARTH_CRAFT_PATTERNS)) return "earth-craft";
  if (hasAny(userText, BOLD_POP_PATTERNS)) return "bold-pop";

  if (!hasAntiCyberIntent(text) && hasAny(text, NEON_PATTERNS)) return "neon-cyber";
  if (hasAny(text, TERMINAL_PATTERNS)) return "tech-terminal";
  if (hasAny(text, EDITORIAL_PATTERNS)) return "editorial";
  if (hasAny(text, WARM_PATTERNS)) return "warm-premium";
  if (hasAny(text, CLEAN_PATTERNS)) return "clean-saas";
  if (hasAny(text, DARK_LUXE_PATTERNS)) return "dark-luxe";
  if (hasAny(text, EARTH_CRAFT_PATTERNS)) return "earth-craft";
  if (hasAny(text, BOLD_POP_PATTERNS)) return "bold-pop";
  if (plan?.color_mood === "vibrant-neon") return "neon-cyber";
  if (plan?.color_mood === "warm-pastel") return "warm-premium";
  if (plan?.color_mood === "light-minimal") return "clean-saas";
  if (plan?.color_mood === "dark-premium") return "dark-luxe";
  if (plan?.color_mood === "earth-natural") return "earth-craft";
  if (plan?.color_mood === "bold-contrast") return "bold-pop";
  if (plan?.color_mood === "cool-mono") return "clean-saas";
  return "generic";
}

/**
 * Инжектит addon в существующий system prompt. Если preset no-op (generic/stub) —
 * возвращает prompt без изменений.
 *
 * Использование в Coder pipeline:
 *   const coderSystem = injectStylePreset(CODER_SYSTEM_PROMPT, 'neon-cyber');
 */
export function injectStylePreset(basePrompt: string, id: StylePresetId): string {
  const preset = getStylePreset(id);
  if (!preset.systemPromptAddon) return basePrompt;
  return `${basePrompt}\n${preset.systemPromptAddon}`;
}
