/**
 * Keyword-based template selector — fallback для контекстов где
 * embedding-based templateRetriever недоступен (WS generate в wsHandlers:
 * там нет провайдера на сервере, LLM только на стороне туннеля).
 *
 * Алгоритм простой: скорим каждый template по совпадениям из bestFor
 * (keyword match = +10) и слов из description (fuzzy match = +2).
 * Если max score = 0 — возвращаем универсальный fallback "blank-landing"
 * (нейтральный лендинг-каркас из каталога). Единый источник истины —
 * getFallbackTemplate(): раньше здесь хардкодом стояла "coffee-shop", из-за чего
 * ЛЮБОЙ нераспознанный бизнес молча превращался в кофейню.
 *
 * Быстро, детерминировано, работает на нулевых ресурсах.
 */

import {
  TEMPLATE_CATALOG,
  getFallbackTemplate,
  type TemplateMeta,
} from "~/lib/config/htmlTemplatesCatalog";

/** Разбивает строку на нормализованные слова (lower, без пунктуации, min 3 char). */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/**
 * Совпадение ключа в НАЧАЛЕ слова (а не любой подстрокой). Стем-префиксы
 * ловятся (кофейн→кофейню, ногт→ногтей), но мусор в середине слова — нет:
 * «мастер» больше не матчит «автоМАСТЕРскую», «бров» — «доБРОВольно». Раньше
 * это давало уверенный, но ложный выбор нишевого шаблона.
 */
function includesAtWordStart(haystackLower: string, kwLower: string): boolean {
  const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-zа-яё0-9])${escaped}`).test(haystackLower);
}

function scoreTemplate(t: TemplateMeta, promptTokens: Set<string>, promptLower: string): number {
  let score = 0;

  // Strong match: keyword из bestFor встречается как substring в промпте.
  // Substring лучше чем token-match потому что "кофейня" должно матчиться
  // и в "ищу кофейню", и в "моя кофейня".
  for (const kw of t.bestFor) {
    if (includesAtWordStart(promptLower, kw.toLowerCase())) score += 10;
  }

  // Weak match: токены из description пересекаются с токенами промпта.
  const descTokens = tokenize(t.description);
  for (const tok of descTokens) {
    if (promptTokens.has(tok)) score += 2;
  }

  // Weak match: название category пересекается
  if (promptTokens.has(t.category)) score += 3;

  return score;
}

/**
 * Возвращает (id, name) самого релевантного шаблона.
 * Никогда не возвращает null — в worst case универсальный fallback "blank-landing".
 */
export function inferTemplateFromPrompt(prompt: string): {
  id: string;
  name: string;
  sections: string[];
} {
  const promptLower = prompt.toLowerCase();
  const promptTokens = new Set(tokenize(prompt));

  let best: TemplateMeta | null = null;
  let bestScore = 0;
  for (const t of TEMPLATE_CATALOG) {
    const s = scoreTemplate(t, promptTokens, promptLower);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }

  const chosen = best && bestScore > 0 ? best : getFallbackTemplate();

  return {
    id: chosen.id,
    name: chosen.name,
    sections: chosen.sections,
  };
}

/**
 * Возвращает id шаблона ТОЛЬКО при сильном совпадении: ключ из bestFor
 * встречается подстрокой в промпте (та же логика strong-match, что в
 * scoreTemplate, +10). Без fallback'а — если уверенной ниши нет, возвращает
 * null. Нужно там, где ложный выбор хуже отсутствия (например, сверка секций
 * плана с каноничными секциями нишевого шаблона). Порядок каталога определяет
 * приоритет при нескольких совпадениях (как в inferTemplateFromPrompt).
 */
export function inferConfidentTemplateId(prompt: string): string | null {
  const promptLower = prompt.toLowerCase();
  for (const t of TEMPLATE_CATALOG) {
    for (const kw of t.bestFor) {
      if (includesAtWordStart(promptLower, kw.toLowerCase())) return t.id;
    }
  }
  return null;
}
