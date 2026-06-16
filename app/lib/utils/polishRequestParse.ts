// Parses explicit rename/headline/SEO instructions from free-form polish prompts.
export type ExplicitPolishEdits = {
  brandName?: string;
  headline?: string;
  wantsSeo?: boolean;
};

function cleanValue(raw: string): string {
  return raw
    .replace(/^["«'([[]+/, "")
    .replace(/["»')\].,;]+$/, "")
    .trim();
}

function pickFirst(groups: RegExpMatchArray | null, index = 1): string | undefined {
  const v = groups?.[index];
  if (!v) return undefined;
  const cleaned = cleanValue(v);
  return cleaned.length > 0 ? cleaned : undefined;
}

const BRAND_PATTERNS: RegExp[] = [
  /(?:поменяй|смени|замени|измени)\s+названи[еяю]\s+на\s+([^,\n.]+)/iu,
  /названи[еяю]\s+(?:на|в)\s+([^,\n.]+)/iu,
  /(?:переименуй|назови)\s+(?:в|на)?\s*([^,\n.]+)/iu,
  /бренд[а]?\s+(?:на|в)\s+([^,\n.]+)/iu,
];

const HEADLINE_PATTERNS: RegExp[] = [
  /(?:поменяй|смени|замени|измени)\s+заголово[кка]\s+на\s+([^,\n.]+)/iu,
  /заголово[кка]\s+(?:на|в)\s+([^,\n.]+)/iu,
  /h1\s+(?:на|в)\s+([^,\n.]+)/iu,
];

const SEO_PATTERNS: RegExp[] = [
  /seo/iu,
  /сео/iu,
  /поисков/iu,
  /мета[\s-]?тег/iu,
  /open\s*graph/iu,
  /schema\.org/iu,
  /json[\s-]?ld/iu,
];

/** Извлекает явные инструкции из запроса пользователя (без LLM). */
export function parseExplicitPolishEdits(userRequest: string): ExplicitPolishEdits {
  const text = userRequest.trim();
  if (!text) return {};

  let brandName: string | undefined;
  for (const re of BRAND_PATTERNS) {
    brandName = pickFirst(text.match(re));
    if (brandName) break;
  }

  let headline: string | undefined;
  for (const re of HEADLINE_PATTERNS) {
    headline = pickFirst(text.match(re));
    if (headline) break;
  }

  const wantsSeo = SEO_PATTERNS.some((re) => re.test(text));

  return { brandName, headline, wantsSeo };
}
