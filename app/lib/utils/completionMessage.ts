// Builds human assistant completion messages from HTML diff + user prompt.
import type { ServerToBrowser } from "@nit/shared";
import { parseExplicitPolishEdits } from "~/lib/utils/polishRequestParse";

const SECTION_LABELS: Record<string, string> = {
  hero: "первый экран",
  about: "о нас",
  story: "история",
  "how-it-works": "как это работает",
  "why-us": "почему мы",
  features: "преимущества",
  services: "услуги",
  programs: "программы",
  program: "программы",
  classes: "программы",
  schedule: "расписание",
  team: "команда",
  instructors: "преподаватели",
  masters: "мастера",
  doctors: "специалисты",
  testimonials: "отзывы",
  pricing: "тарифы",
  menu: "меню",
  gallery: "галерея",
  projects: "работы",
  skills: "навыки",
  faq: "вопросы",
  contact: "контакты",
  location: "как добраться",
  hours: "часы работы",
  booking: "форма записи",
  "order-form": "форма записи",
  rsvp: "форма записи",
  cta: "призыв к действию",
  events: "события",
  tracks: "треки",
};

export function describeSections(html: string): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/data-nit-section="([^"]+)"/g)) {
    const label = SECTION_LABELS[m[1]];
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

function pluralBlocks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "блок";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "блока";
  return "блоков";
}

function stripTags(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTagText(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m?.[1] ? stripTags(m[1]) : null;
}

function extractTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? stripTags(m[1]) : null;
}

function extractNavBrand(html: string): string | null {
  const nav = html.match(/<(?:nav|header)[^>]*>([\s\S]*?)<\/(?:nav|header)>/i)?.[1];
  if (!nav) return null;
  const link = nav.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1];
  return link ? stripTags(link) : null;
}

function countSeoSignals(html: string): number {
  let n = 0;
  if (/<meta[^>]+name=["']description["']/i.test(html)) n++;
  if (/<meta[^>]+property=["']og:/i.test(html)) n++;
  if (/<script[^>]+type=["']application\/ld\+json["']/i.test(html)) n++;
  if (/data-nit-section=["']faq["']/i.test(html)) n++;
  return n;
}

export type RenameTargets = {
  brand?: string;
  heading?: string;
};

export function parseRenameTargets(userRequest: string): RenameTargets {
  const out: RenameTargets = {};
  const brand =
    userRequest.match(/названи[еяю]\s+(?:на\s+)?["«]?(.+?)["»]?(?:\s*,\s*|\s+и\s+|\s*$)/iu)?.[1] ??
    userRequest.match(/бренд\s+(?:на\s+)?["«]?(.+?)["»]?(?:\s*,\s*|\s+и\s+|\s*$)/iu)?.[1];
  const heading = userRequest.match(
    /заголово?к\s+(?:на\s+)?["«]?(.+?)["»]?(?:\s*,\s*|\s+и\s+|\s*$)/iu,
  )?.[1];
  if (brand) out.brand = brand.trim().replace(/[.,]$/, "");
  if (heading) out.heading = heading.trim().replace(/[.,]$/, "");
  return out;
}

function shortPrompt(text: string, max = 72): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function describePolishChanges(
  beforeHtml: string,
  afterHtml: string,
  userRequest: string,
): string[] {
  const changes: string[] = [];
  const edits = parseExplicitPolishEdits(userRequest);

  const beforeSections = describeSections(beforeHtml);
  const afterSections = describeSections(afterHtml);
  const added = afterSections.filter((s) => !beforeSections.includes(s));
  const removed = beforeSections.filter((s) => !afterSections.includes(s));
  if (added.length) changes.push(`Добавил: ${added.join(", ")}`);
  if (removed.length) changes.push(`Убрал: ${removed.join(", ")}`);

  const titleBefore = extractTitleTag(beforeHtml);
  const titleAfter = extractTitleTag(afterHtml);
  if (titleBefore !== titleAfter && titleAfter) {
    changes.push(`Title → «${titleAfter}»`);
  }

  const h1Before = extractTagText(beforeHtml, "h1");
  const h1After = extractTagText(afterHtml, "h1");
  if (h1Before !== h1After && h1After) {
    changes.push(`Заголовок H1 → «${h1After}»`);
  }

  const brandBefore = extractNavBrand(beforeHtml);
  const brandAfter = extractNavBrand(afterHtml);
  if (brandBefore !== brandAfter && brandAfter) {
    changes.push(`Название в шапке → «${brandAfter}»`);
  }

  const seoDelta = countSeoSignals(afterHtml) - countSeoSignals(beforeHtml);
  if (/seo|сео/i.test(userRequest) && seoDelta > 0) {
    changes.push(`SEO: +${seoDelta} элемент(ов) в разметке`);
  }

  if (edits.brandName) {
    const found = afterHtml.toLowerCase().includes(edits.brandName.toLowerCase());
    if (!found) {
      changes.push(`⚠️ «${edits.brandName}» не найдено в HTML — проверь логотип и title`);
    }
  }
  if (edits.headline) {
    const h1 = h1After?.toLowerCase() ?? "";
    const wanted = edits.headline.toLowerCase();
    if (!h1.includes(wanted) && !afterHtml.toLowerCase().includes(wanted)) {
      changes.push(`⚠️ Заголовок «${edits.headline}» не виден в H1 — уточни, если нужно иначе`);
    }
  }

  if (/seo|сео/i.test(userRequest) && /добав|больше|ещё|еще/i.test(userRequest) && seoDelta <= 0 && added.length === 0) {
    changes.push("⚠️ SEO-блоки могли не добавиться — проверь <head> и FAQ");
  }

  if (changes.length === 0 && beforeHtml !== afterHtml) {
    changes.push(`Применил: «${shortPrompt(userRequest)}»`);
  }
  if (changes.length === 0) {
    changes.push("HTML не изменился — попробуй переформулировать запрос");
  }

  return changes;
}

type Telemetry = Extract<ServerToBrowser, { type: "generate_done" }>["telemetry"];

function buildDiagLine(tel: Telemetry | undefined): string {
  if (!tel) return "";
  const parts: string[] = [];
  if (tel.model && !/embed/i.test(tel.model)) parts.push(tel.model);
  if (tel.promptTokens && tel.contextWindow) {
    const pct = Math.round((tel.promptTokens / tel.contextWindow) * 100);
    parts.push(
      `контекст ${Math.round(tel.promptTokens / 1000)}k/${Math.round(tel.contextWindow / 1000)}k (${pct}%)`,
    );
  } else if (tel.contextWindow) {
    parts.push(`контекст ${Math.round(tel.contextWindow / 1000)}k`);
  }
  if (tel.completionTokens) parts.push(`вывод ${tel.completionTokens.toLocaleString("ru")} ток.`);
  if ((tel.continuationRounds ?? 0) > 0) parts.push(`докрутка ×${tel.continuationRounds}`);
  return parts.length ? `\n\nДиагностика: ${parts.join(" · ")}` : "";
}

function buildWarnings(tel: Telemetry | undefined): string {
  let out = "";
  if (tel?.truncated) {
    out +=
      "\n\n⚠️ Сайт мог получиться обрезанным: модель упёрлась в лимит токенов даже после докрутки. Нажми «Повторить» или упрости запрос — меньше блоков.";
  }
  if (tel?.promptTokens && tel.contextWindow) {
    const pct = Math.round((tel.promptTokens / tel.contextWindow) * 100);
    if (pct >= 80) {
      out +=
        `\n\n⚠️ Контекст занят на ${pct}%. Запас тает — для более сложного сайта увеличь context length в LM Studio или упрости запрос.`;
    }
  }
  return out;
}

export function buildAssistantCompletionMessage(params: {
  html: string;
  previousHtml?: string;
  userPrompt: string;
  isPolish: boolean;
  durationMs: number;
  telemetry?: Telemetry;
}): string {
  const secs = (params.durationMs / 1000).toFixed(0);
  const warnings = buildWarnings(params.telemetry);
  const diag = buildDiagLine(params.telemetry);

  if (params.isPolish && params.previousHtml) {
    const changes = describePolishChanges(params.previousHtml, params.html, params.userPrompt);
    const body = changes.map((c) => `• ${c}`).join("\n");
    return `Готово ✨ Применил за ${secs}с:\n\n${body}${warnings}${diag}`;
  }

  const blocks = describeSections(params.html);
  const blocksLine = blocks.length
    ? `Внутри ${blocks.length} ${pluralBlocks(blocks.length)}: ${blocks.join(", ")}.`
    : "Сайт готов.";
  return `Готово ✨ ${blocksLine} Собрал за ${secs}с.${warnings}${diag}`;
}
