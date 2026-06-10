/**
 * Skeleton Direct Injection (Tier 3 + 4 extended).
 *
 * Идея. Если Planner уже выдал весь копирайт (hero/benefits/social_proof/cta +
 * опц. pricing/faq/hours/contact) — Coder НЕ НУЖЕН. Мы прямо подставляем тексты
 * в шаблон через server-side DOM-replacement по эвристическим селекторам.
 *
 * Эффект:
 *   - Coder вызывается в ~10-20% случаев вместо 100%
 *   - latency падает с ~15s до ~50ms на successful injection
 *   - токены: 0 Coder tokens (раньше 6000+ prompt + 4000+ completion)
 *   - гарантия: HTML-структура шаблона не ломается
 *
 * Core слоты (всегда учитываются в fillRatio, в порядке приоритета):
 *   1. <title> — из plan.business_type (SEO, всегда работает)
 *   2. <h1> в #hero → hero_headline
 *   3. Первый <p> после h1 в #hero → hero_subheadline
 *   4. <h3>+<p> в features/benefits/why-us/about → key_benefits[i]
 *   5. social_proof_line → #testimonials/#social-proof/#reviews
 *   6. cta_microcopy → <small class="cta-microcopy"> под первой <a> в hero
 *
 * Extended слоты (Tier 4, opt-in: считаются в slotsTotal ТОЛЬКО если данные в plan
 * есть И соответствующая <section> найдена в шаблоне; иначе тихо пропускаются —
 * не штрафуют fillRatio и не вызывают fallback на Coder):
 *   7. pricing_tiers → карточки в #pricing
 *   8. faq → h3/h4+p или dt+dd в #faq
 *   9. hours_text → текст в #hours или #contact
 *  10. contact_phone/email/address → <a href="tel/mailto"> и <address> в #contact/#footer
 *  11. brand_name → лого в <nav> и название в <footer>
 *  12. team → карточки имя+роль в #team/#masters/#staff/...
 *
 * Порог. Если < SLOT_FILL_THRESHOLD core-слотов реально заменено → фолбэк на Coder.
 *
 * Backward-compat. Если plan без hero_headline (legacy planner) — сразу ok:false,
 * оркестратор пойдёт через старый Coder pipeline.
 *
 * ENV NIT_SKELETON_INJECT_ENABLED=0 — kill-switch.
 */

import { logger } from "~/lib/utils/logger";
import type { Plan, PlanFaqItem, PlanPricingTier } from "~/lib/utils/planSchema";

const SCOPE = "skeletonInjector";
const SLOT_FILL_THRESHOLD = 0.6;

export function isSkeletonInjectEnabled(): boolean {
  return process.env.NIT_SKELETON_INJECT_ENABLED !== "0";
}

export type InjectionResult =
  | {
      ok: true;
      html: string;
      slotsFilled: number;
      slotsTotal: number;
      fillRatio: number;
      extendedSlotsFilled: number;
    }
  | {
      ok: false;
      reason: string;
      slotsFilled: number;
      slotsTotal: number;
      fillRatio: number;
      extendedSlotsFilled: number;
    };

/** Находит [start, end) индексы секции по id. */
function findSectionRange(
  html: string,
  sectionId: string,
): { start: number; end: number } | null {
  const startMatch = html.match(
    new RegExp(`<section[^>]*id=["']${sectionId}["'][^>]*>`, "i"),
  );
  if (!startMatch || startMatch.index === undefined) return null;
  const start = startMatch.index;
  const endMatch = html.slice(start).match(/<\/section\s*>/i);
  if (!endMatch || endMatch.index === undefined) return null;
  return { start, end: start + endMatch.index + endMatch[0].length };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Seeded-акцент для skeleton-вывода. Шаблоны, мигрированные на CSS-переменную
// --nit-accent (значение по умолчанию = их собственный цвет в <style>), получают
// при наличии plan.variantSeed позднюю :root-перебивку → разный акцент на
// одинаковый промпт. Немигрированные шаблоны переменную не используют → стиль
// инертен (безопасный поэтапный rollout). Пул — насыщенные цвета, читаемые на
// светлом фоне.
const SKEL_ACCENT_POOL = [
  "#6d28d9", "#0d9488", "#b45309", "#be123c", "#1d4ed8", "#047857", "#9333ea",
] as const;

function injectSkeletonAccent(html: string, seed: number): string {
  // Перебивка имеет смысл только для шаблонов, реально использующих
  // var(--nit-accent) (мигрированных). На остальных — строгий no-op, чтобы
  // не плодить мёртвый <style>. Кодер-путь переписывает цвета сам, поэтому
  // на нём переменная всё равно не доживает — механизм только для skeleton.
  if (!html.includes("--nit-accent")) return html;
  if (html.includes('id="nit-skel-accent"')) return html;
  const accent = SKEL_ACCENT_POOL[(seed >>> 0) % SKEL_ACCENT_POOL.length]!;
  const style = `<style id="nit-skel-accent">:root{--nit-accent:${accent}}</style>`;
  return html.includes("</head>")
    ? html.replace("</head>", `${style}\n</head>`)
    : `${style}\n${html}`;
}

/**
 * Заменить внутренний текст первого тэга (сохраняет все атрибуты).
 */
function replaceFirstTagInRange(
  html: string,
  range: { start: number; end: number },
  tagName: string,
  newInnerText: string,
): { html: string; replaced: boolean } {
  const sectionHtml = html.slice(range.start, range.end);
  const tagOpenRe = new RegExp(`<${tagName}\\b[^>]*>`, "i");
  const openMatch = sectionHtml.match(tagOpenRe);
  if (!openMatch || openMatch.index === undefined) {
    return { html, replaced: false };
  }
  const openEnd = openMatch.index + openMatch[0].length;
  const closeRe = new RegExp(`</${tagName}\\s*>`, "i");
  const closeMatch = sectionHtml.slice(openEnd).match(closeRe);
  if (!closeMatch || closeMatch.index === undefined) {
    return { html, replaced: false };
  }
  const closeStart = openEnd + closeMatch.index;

  const before = html.slice(0, range.start) + sectionHtml.slice(0, openEnd);
  const after = sectionHtml.slice(closeStart) + html.slice(range.end);
  const newHtml = before + escapeHtml(newInnerText) + after;
  return { html: newHtml, replaced: true };
}

/** Похоже ли содержимое секции на прайс/меню, а не на карточки-преимущества.
 *  Признак: валюта (≥2 символа) или явный price-класс. */
function looksLikePriceSection(sectionHtml: string): boolean {
  const currencyHits = (sectionHtml.match(/[₽$€£]|(?<![\p{L}\d])руб(?:л[а-яё]*)?(?![\p{L}\d])|\b(?:byn|usd|eur)\b/giu) ?? []).length;
  if (currencyHits >= 2) return true;
  return /class=["'][^"']*\bprice\b/i.test(sectionHtml);
}

function replaceBenefitCards(
  html: string,
  sectionRange: { start: number; end: number },
  benefits: Array<{ title: string; description: string }>,
): { html: string; replaced: number } {
  const sectionHtml = html.slice(sectionRange.start, sectionRange.end);
  // Не затираем прайс/меню-секции: у нишевых шаблонов (барбершоп, ресторан)
  // секция services — это сетка цен, и benefit-инжект превратил бы прайс в
  // «Быстрый ответ». Пропускаем (replaced:0) — цикл попробует следующую секцию.
  if (looksLikePriceSection(sectionHtml)) return { html, replaced: 0 };
  const headingRe = /<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  type Heading = { tag: string; openIdx: number; closeEnd: number };
  const headings: Heading[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(sectionHtml)) !== null) {
    headings.push({
      tag: m[1]!.toLowerCase(),
      openIdx: m.index,
      closeEnd: m.index + m[0].length,
    });
  }
  if (headings.length === 0) return { html, replaced: 0 };

  const cardLevel = headings.some((h) => h.tag === "h3") ? "h3" : "h2";
  const cards = headings.filter((h) => h.tag === cardLevel);
  if (cards.length === 0) return { html, replaced: 0 };

  type Replacement = { from: number; to: number; text: string };
  const replacements: Replacement[] = [];
  const limit = Math.min(cards.length, benefits.length);
  for (let i = 0; i < limit; i++) {
    const card = cards[i]!;
    const benefit = benefits[i]!;
    const nextCard = cards[i + 1];
    const cardEnd = nextCard ? nextCard.openIdx : sectionHtml.length;

    const headingOpenRe = new RegExp(`<${card.tag}\\b[^>]*>`, "i");
    const headingTextStart =
      card.openIdx +
      (sectionHtml.slice(card.openIdx).match(headingOpenRe)?.[0].length ?? 0);
    const headingTextEnd = card.closeEnd - `</${card.tag}>`.length;
    replacements.push({
      from: headingTextStart,
      to: headingTextEnd,
      text: escapeHtml(benefit.title),
    });

    const after = sectionHtml.slice(card.closeEnd, cardEnd);
    const pMatch = after.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch && pMatch.index !== undefined) {
      const pOpenLen = pMatch[0].indexOf(">") + 1;
      const pTextStart = card.closeEnd + pMatch.index + pOpenLen;
      const pTextEnd =
        card.closeEnd + pMatch.index + pMatch[0].length - "</p>".length;
      replacements.push({
        from: pTextStart,
        to: pTextEnd,
        text: escapeHtml(benefit.description),
      });
    }
  }

  if (replacements.length === 0) return { html, replaced: 0 };

  replacements.sort((a, b) => b.from - a.from);
  let updatedSection = sectionHtml;
  for (const r of replacements) {
    updatedSection =
      updatedSection.slice(0, r.from) + r.text + updatedSection.slice(r.to);
  }

  const newHtml =
    html.slice(0, sectionRange.start) +
    updatedSection +
    html.slice(sectionRange.end);
  return { html: newHtml, replaced: limit };
}

function replaceTitle(html: string, plan: Plan): { html: string; replaced: boolean } {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!titleMatch || titleMatch.index === undefined) {
    return { html, replaced: false };
  }
  const newTitle =
    plan.hero_headline && plan.hero_headline.length < 60
      ? `${plan.hero_headline} — ${plan.business_type}`
      : plan.business_type;
  const truncated = newTitle.slice(0, 70);
  const before = html.slice(0, titleMatch.index);
  const after = html.slice(titleMatch.index + titleMatch[0].length);
  return {
    html: `${before}<title>${escapeHtml(truncated)}</title>${after}`,
    replaced: true,
  };
}

function replaceSocialProof(
  html: string,
  socialProofLine: string,
): { html: string; replaced: boolean } {
  const sectionIds = ["testimonials", "social-proof", "reviews", "social_proof"];
  for (const sid of sectionIds) {
    const range = findSectionRange(html, sid);
    if (!range) continue;
    const r = replaceFirstTagInRange(html, range, "p", socialProofLine);
    if (r.replaced) return r;
  }
  return { html, replaced: false };
}

function injectCtaMicrocopy(
  html: string,
  microcopy: string,
): { html: string; replaced: boolean } {
  const heroRange = findSectionRange(html, "hero");
  if (!heroRange) return { html, replaced: false };
  const sectionHtml = html.slice(heroRange.start, heroRange.end);

  const existingMatch = sectionHtml.match(
    /<small\s+class=["'][^"']*cta-microcopy[^"']*["'][^>]*>[\s\S]*?<\/small>/i,
  );
  if (existingMatch && existingMatch.index !== undefined) {
    const replacement = `<small class="cta-microcopy text-xs opacity-70 block mt-2">${escapeHtml(microcopy)}</small>`;
    const before =
      html.slice(0, heroRange.start) +
      sectionHtml.slice(0, existingMatch.index);
    const after =
      sectionHtml.slice(existingMatch.index + existingMatch[0].length) +
      html.slice(heroRange.end);
    return { html: before + replacement + after, replaced: true };
  }

  const aMatch = sectionHtml.match(/<a\b[^>]*>[\s\S]*?<\/a>/i);
  if (!aMatch || aMatch.index === undefined) return { html, replaced: false };
  const insertAt =
    heroRange.start + aMatch.index + aMatch[0].length;
  const insertion = `\n<small class="cta-microcopy text-xs opacity-70 block mt-2">${escapeHtml(microcopy)}</small>`;
  return {
    html: html.slice(0, insertAt) + insertion + html.slice(insertAt),
    replaced: true,
  };
}

function replaceHeroPrimaryCta(
  html: string,
  ctaText: string,
): { html: string; replaced: boolean } {
  const heroRange = findSectionRange(html, "hero");
  if (!heroRange || !ctaText.trim()) return { html, replaced: false };

  const sectionHtml = html.slice(heroRange.start, heroRange.end);
  const ctaMatch = sectionHtml.match(/<(a|button)\b[^>]*>[\s\S]*?<\/\1>/i);
  if (!ctaMatch || ctaMatch.index === undefined) {
    return { html, replaced: false };
  }

  const openEndInElement = ctaMatch[0].indexOf(">");
  if (openEndInElement < 0) return { html, replaced: false };

  const tagName = ctaMatch[1] ?? "a";
  const closeTag = `</${tagName}>`;
  const textStart = heroRange.start + ctaMatch.index + openEndInElement + 1;
  const textEnd =
    heroRange.start +
    ctaMatch.index +
    ctaMatch[0].length -
    closeTag.length;

  return {
    html: html.slice(0, textStart) + escapeHtml(ctaText) + html.slice(textEnd),
    replaced: true,
  };
}

// ───────────────────────────────────────────────────────────────────────
// EXTENDED SLOTS (Tier 4)
// ───────────────────────────────────────────────────────────────────────

/**
 * Pricing tiers. Стратегия: ищем h3 headings в #pricing (один h3 = один тариф).
 * Под каждым h3 ожидаем найти:
 *   - элемент с ценой (.price/.tier-price/первая большая цифра)
 *   - <ul>/<ol> с features
 * Заменяем минимум name+price+features. period/highlighted — best effort,
 * только если есть явные классы (.period, .featured/.highlighted).
 *
 * Если структура не совпадает (нет h3 или ul) — replaced=0, тихо пропускаем.
 */
function replacePricingTiers(
  html: string,
  range: { start: number; end: number },
  tiers: PlanPricingTier[],
): { html: string; replaced: number } {
  const sectionHtml = html.slice(range.start, range.end);
  const headingRe = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  type Heading = { openIdx: number; closeEnd: number };
  const headings: Heading[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(sectionHtml)) !== null) {
    headings.push({ openIdx: m.index, closeEnd: m.index + m[0].length });
  }
  if (headings.length < 2) return { html, replaced: 0 };

  const cards = headings.slice(0, Math.min(headings.length, tiers.length));
  type Replacement = { from: number; to: number; text: string };
  const replacements: Replacement[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    const tier = tiers[i]!;
    const nextCard = cards[i + 1];
    const cardEnd = nextCard ? nextCard.openIdx : sectionHtml.length;

    // 1. Заменить h3 текст
    const h3OpenLen = (sectionHtml.slice(card.openIdx).match(/<h3\b[^>]*>/i)?.[0].length ?? 0);
    replacements.push({
      from: card.openIdx + h3OpenLen,
      to: card.closeEnd - "</h3>".length,
      text: escapeHtml(tier.name),
    });

    const cardSlice = sectionHtml.slice(card.closeEnd, cardEnd);

    // 2. Заменить цену — ищем .price или первый <span>/<p>/<div> класса с "price"
    const priceMatch = cardSlice.match(
      /<(span|p|div|strong)\b[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i,
    );
    if (priceMatch && priceMatch.index !== undefined) {
      const tagOpenLen = priceMatch[0].indexOf(">") + 1;
      const tagCloseLen = `</${priceMatch[1]}>`.length;
      const priceText =
        tier.period && !/\b(мес|month|year|год|сеанс|раз)\b/i.test(tier.price)
          ? `${tier.price} ${tier.period}`
          : tier.price;
      replacements.push({
        from: card.closeEnd + priceMatch.index + tagOpenLen,
        to: card.closeEnd + priceMatch.index + priceMatch[0].length - tagCloseLen,
        text: escapeHtml(priceText),
      });
    }

    // 3. Заменить features — первый <ul> или <ol> в карточке
    const ulMatch = cardSlice.match(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/i);
    if (ulMatch && ulMatch.index !== undefined) {
      const ulTag = ulMatch[1]!.toLowerCase();
      const liItems = tier.features
        .map((f) => `<li>${escapeHtml(f)}</li>`)
        .join("\n");
      const ulOpenMatch = ulMatch[0].match(/^<(?:ul|ol)\b[^>]*>/i);
      const ulOpen = ulOpenMatch?.[0] ?? `<${ulTag}>`;
      replacements.push({
        from: card.closeEnd + ulMatch.index,
        to: card.closeEnd + ulMatch.index + ulMatch[0].length,
        text: `${ulOpen}\n${liItems}\n</${ulTag}>`,
      });
    }
  }

  if (replacements.length === 0) return { html, replaced: 0 };

  replacements.sort((a, b) => b.from - a.from);
  let updatedSection = sectionHtml;
  for (const r of replacements) {
    updatedSection =
      updatedSection.slice(0, r.from) + r.text + updatedSection.slice(r.to);
  }

  const newHtml =
    html.slice(0, range.start) + updatedSection + html.slice(range.end);
  return { html: newHtml, replaced: cards.length };
}

/**
 * FAQ. Стратегия: ищем повторяющиеся пары h3/h4+p или dt+dd.
 * Заменяем минимум первые N=faq.length пар.
 * Шаблоны без структурированного FAQ (только один <details>) — пропускаются.
 */
function replaceFaqItems(
  html: string,
  range: { start: number; end: number },
  faq: PlanFaqItem[],
): { html: string; replaced: number } {
  const sectionHtml = html.slice(range.start, range.end);

  // Стратегия А: h3/h4 + p
  const headingRe = /<(h3|h4)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  type Pair = {
    qOpenIdx: number;
    qCloseEnd: number;
    qTag: string;
    aMatch?: { idx: number; openLen: number; len: number };
  };
  const headings: Array<{ openIdx: number; closeEnd: number; tag: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(sectionHtml)) !== null) {
    headings.push({
      openIdx: m.index,
      closeEnd: m.index + m[0].length,
      tag: m[1]!.toLowerCase(),
    });
  }

  if (headings.length >= 2) {
    const pairs: Pair[] = [];
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i]!;
      const nextH = headings[i + 1];
      const tail = sectionHtml.slice(
        h.closeEnd,
        nextH ? nextH.openIdx : sectionHtml.length,
      );
      const pMatch = tail.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
      if (pMatch && pMatch.index !== undefined) {
        pairs.push({
          qOpenIdx: h.openIdx,
          qCloseEnd: h.closeEnd,
          qTag: h.tag,
          aMatch: {
            idx: h.closeEnd + pMatch.index,
            openLen: pMatch[0].indexOf(">") + 1,
            len: pMatch[0].length,
          },
        });
      }
    }

    if (pairs.length >= 2) {
      const limit = Math.min(pairs.length, faq.length);
      type R = { from: number; to: number; text: string };
      const reps: R[] = [];
      for (let i = 0; i < limit; i++) {
        const pair = pairs[i]!;
        const item = faq[i]!;
        const qOpenLen = (sectionHtml.slice(pair.qOpenIdx).match(new RegExp(`<${pair.qTag}\\b[^>]*>`, "i"))?.[0].length ?? 0);
        reps.push({
          from: pair.qOpenIdx + qOpenLen,
          to: pair.qCloseEnd - `</${pair.qTag}>`.length,
          text: escapeHtml(item.question),
        });
        if (pair.aMatch) {
          reps.push({
            from: pair.aMatch.idx + pair.aMatch.openLen,
            to: pair.aMatch.idx + pair.aMatch.len - "</p>".length,
            text: escapeHtml(item.answer),
          });
        }
      }
      reps.sort((a, b) => b.from - a.from);
      let updated = sectionHtml;
      for (const r of reps) {
        updated = updated.slice(0, r.from) + r.text + updated.slice(r.to);
      }
      return {
        html: html.slice(0, range.start) + updated + html.slice(range.end),
        replaced: limit,
      };
    }
  }

  // Стратегия Б: dt + dd
  const dtRe = /<dt\b[^>]*>([\s\S]*?)<\/dt>/gi;
  const ddRe = /<dd\b[^>]*>([\s\S]*?)<\/dd>/gi;
  const dts: Array<{ openIdx: number; closeEnd: number }> = [];
  const dds: Array<{ openIdx: number; closeEnd: number }> = [];
  let mm: RegExpExecArray | null;
  while ((mm = dtRe.exec(sectionHtml)) !== null) {
    dts.push({ openIdx: mm.index, closeEnd: mm.index + mm[0].length });
  }
  while ((mm = ddRe.exec(sectionHtml)) !== null) {
    dds.push({ openIdx: mm.index, closeEnd: mm.index + mm[0].length });
  }
  if (dts.length >= 2 && dds.length >= 2) {
    const limit = Math.min(dts.length, dds.length, faq.length);
    type R = { from: number; to: number; text: string };
    const reps: R[] = [];
    for (let i = 0; i < limit; i++) {
      const dt = dts[i]!;
      const dd = dds[i]!;
      const item = faq[i]!;
      const dtOpenLen = (sectionHtml.slice(dt.openIdx).match(/<dt\b[^>]*>/i)?.[0].length ?? 0);
      const ddOpenLen = (sectionHtml.slice(dd.openIdx).match(/<dd\b[^>]*>/i)?.[0].length ?? 0);
      reps.push({
        from: dt.openIdx + dtOpenLen,
        to: dt.closeEnd - "</dt>".length,
        text: escapeHtml(item.question),
      });
      reps.push({
        from: dd.openIdx + ddOpenLen,
        to: dd.closeEnd - "</dd>".length,
        text: escapeHtml(item.answer),
      });
    }
    reps.sort((a, b) => b.from - a.from);
    let updated = sectionHtml;
    for (const r of reps) {
      updated = updated.slice(0, r.from) + r.text + updated.slice(r.to);
    }
    return {
      html: html.slice(0, range.start) + updated + html.slice(range.end),
      replaced: limit,
    };
  }

  return { html, replaced: 0 };
}

/**
 * Hours text. Ищет в #hours или #contact:
 *   - <p class="...hours..."> или <span class="...hours...">
 *   - <time>
 *   - первый <p> в #hours
 */
function replaceHoursText(
  html: string,
  hoursText: string,
): { html: string; replaced: boolean } {
  const sectionIds = ["hours", "schedule", "contact"];
  for (const sid of sectionIds) {
    const range = findSectionRange(html, sid);
    if (!range) continue;
    const sectionHtml = html.slice(range.start, range.end);

    // Приоритет 1: явный класс hours/schedule/working-hours
    const classMatch = sectionHtml.match(
      /<(span|p|div|time)\b[^>]*class=["'][^"']*(hours|schedule|working|time)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i,
    );
    if (classMatch && classMatch.index !== undefined) {
      const tagOpenLen = classMatch[0].indexOf(">") + 1;
      const tagCloseLen = `</${classMatch[1]}>`.length;
      const before =
        html.slice(0, range.start) + sectionHtml.slice(0, classMatch.index + tagOpenLen);
      const after =
        sectionHtml.slice(classMatch.index + classMatch[0].length - tagCloseLen) +
        html.slice(range.end);
      return {
        html: before + escapeHtml(hoursText) + after,
        replaced: true,
      };
    }

    // Приоритет 2: <time>
    const timeMatch = sectionHtml.match(/<time\b[^>]*>([\s\S]*?)<\/time>/i);
    if (timeMatch && timeMatch.index !== undefined) {
      const tagOpenLen = timeMatch[0].indexOf(">") + 1;
      const before =
        html.slice(0, range.start) + sectionHtml.slice(0, timeMatch.index + tagOpenLen);
      const after =
        sectionHtml.slice(timeMatch.index + timeMatch[0].length - "</time>".length) +
        html.slice(range.end);
      return { html: before + escapeHtml(hoursText) + after, replaced: true };
    }

    // Приоритет 3: для #hours — первый <p>
    if (sid === "hours") {
      const r = replaceFirstTagInRange(html, range, "p", hoursText);
      if (r.replaced) return r;
    }
  }
  return { html, replaced: false };
}

/**
 * Contact info. Стратегия:
 *   - <a href="tel:..."> → href + текст
 *   - <a href="mailto:..."> → href + текст
 *   - <address> или <span class="address"> → текст
 * Возвращает кол-во реально заменённых полей (0..3).
 */
function replaceContactInfo(
  html: string,
  plan: Plan,
): { html: string; replaced: number } {
  let updated = html;
  let replacedCount = 0;

  if (plan.contact_phone) {
    const phone = plan.contact_phone;
    const phoneDigits = phone.replace(/[^\d+]/g, "");
    // Меняем ВСЕ tel:-ссылки (hero/booking/footer), иначе на странице остаются
    // два разных номера: новый в одной кнопке и шаблонный в остальных (№16).
    const phoneReG = /<a\b[^>]*href=["']tel:[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
    let phoneReplaced = false;
    updated = updated.replace(phoneReG, (full) => {
      phoneReplaced = true;
      const openTag = full.slice(0, full.indexOf(">") + 1);
      const newOpen = openTag.replace(
        /href=["']tel:[^"']*["']/i,
        `href="tel:${escapeHtml(phoneDigits)}"`,
      );
      return `${newOpen}${escapeHtml(phone)}</a>`;
    });
    if (phoneReplaced) replacedCount++;
  }

  if (plan.contact_email) {
    const email = plan.contact_email;
    // Аналогично телефону — меняем все mailto:-ссылки.
    const emailReG = /<a\b[^>]*href=["']mailto:[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
    let emailReplaced = false;
    updated = updated.replace(emailReG, (full) => {
      emailReplaced = true;
      const openTag = full.slice(0, full.indexOf(">") + 1);
      const newOpen = openTag.replace(
        /href=["']mailto:[^"']*["']/i,
        `href="mailto:${escapeHtml(email)}"`,
      );
      return `${newOpen}${escapeHtml(email)}</a>`;
    });
    if (emailReplaced) replacedCount++;
  }

  if (plan.contact_address) {
    // Сначала <address>, потом span/p с классом address
    const addrRe = /<address\b[^>]*>([\s\S]*?)<\/address>/i;
    const am = updated.match(addrRe);
    if (am && am.index !== undefined) {
      const tagOpenLen = am[0].indexOf(">") + 1;
      const before = updated.slice(0, am.index + tagOpenLen);
      const after = updated.slice(am.index + am[0].length - "</address>".length);
      updated = before + escapeHtml(plan.contact_address) + after;
      replacedCount++;
    } else {
      const classRe =
        /<(span|p|div)\b[^>]*class=["'][^"']*address[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i;
      const cm = updated.match(classRe);
      if (cm && cm.index !== undefined) {
        const tagOpenLen = cm[0].indexOf(">") + 1;
        const tagCloseLen = `</${cm[1]}>`.length;
        const before = updated.slice(0, cm.index + tagOpenLen);
        const after = updated.slice(cm.index + cm[0].length - tagCloseLen);
        updated = before + escapeHtml(plan.contact_address) + after;
        replacedCount++;
      }
    }
  }

  return { html: updated, replaced: replacedCount };
}

/**
 * Бренд/название бизнеса. Меняет логотип в <nav> (первый <a>) и название в
 * <footer>. Эвристика, шаблоно-агностична: эмодзи/иконка-префикс сохраняется,
 * меняется только словесная часть. <title> не трогаем — его ставит replaceTitle.
 */
function replaceBrand(
  html: string,
  brandName: string,
): { html: string; replaced: number } {
  if (!brandName.trim()) return { html, replaced: 0 };

  const navMatch = html.match(/<nav\b[\s\S]*?<\/nav>/i);
  if (!navMatch || navMatch.index === undefined) return { html, replaced: 0 };
  const navStart = navMatch.index;
  const navHtml = navMatch[0];

  const aMatch = navHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  if (!aMatch || aMatch.index === undefined) return { html, replaced: 0 };
  const innerText = (aMatch[1] ?? "").replace(/<[^>]+>/g, "").trim();
  if (innerText.length < 2) return { html, replaced: 0 };

  // Префикс из эмодзи/символов перед словами ("💈 ") сохраняем.
  const leadPrefix = innerText.match(/^[^\p{L}\p{N}]*/u)?.[0] ?? "";
  const oldCore = innerText.slice(leadPrefix.length).trim();
  if (oldCore.length < 2) return { html, replaced: 0 };

  const aOpenLen = aMatch[0].indexOf(">") + 1;
  const aInnerStart = navStart + aMatch.index + aOpenLen;
  const aInnerEnd = navStart + aMatch.index + aMatch[0].length - "</a>".length;
  let updated =
    html.slice(0, aInnerStart) +
    `${leadPrefix}${escapeHtml(brandName)}` +
    html.slice(aInnerEnd);
  let replaced = 1;

  // Футер: меняем словесную часть бренда (эмодзи и разметка сохраняются,
  // бьём только по словам oldCore).
  const footMatch = updated.match(/<footer\b[\s\S]*?<\/footer>/i);
  if (
    footMatch &&
    footMatch.index !== undefined &&
    footMatch[0].includes(oldCore)
  ) {
    const newFoot = footMatch[0].split(oldCore).join(escapeHtml(brandName));
    updated =
      updated.slice(0, footMatch.index) +
      newFoot +
      updated.slice(footMatch.index + footMatch[0].length);
    replaced++;
  }

  return { html: updated, replaced };
}

/**
 * Команда/мастера. В team/masters/staff-секции каждая карточка: h3 = имя,
 * следующий <p> = роль. Зеркало replaceBenefitCards, но роль опциональна.
 */
function replaceTeamCards(
  html: string,
  sectionRange: { start: number; end: number },
  team: Array<{ name: string; role?: string }>,
): { html: string; replaced: number } {
  const sectionHtml = html.slice(sectionRange.start, sectionRange.end);
  const headingRe = /<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  type Heading = { tag: string; openIdx: number; closeEnd: number };
  const headings: Heading[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(sectionHtml)) !== null) {
    headings.push({
      tag: m[1]!.toLowerCase(),
      openIdx: m.index,
      closeEnd: m.index + m[0].length,
    });
  }
  if (headings.length === 0) return { html, replaced: 0 };

  const cardLevel = headings.some((h) => h.tag === "h3") ? "h3" : "h2";
  const cards = headings.filter((h) => h.tag === cardLevel);
  if (cards.length === 0) return { html, replaced: 0 };

  type Replacement = { from: number; to: number; text: string };
  const replacements: Replacement[] = [];
  const limit = Math.min(cards.length, team.length);
  for (let i = 0; i < limit; i++) {
    const card = cards[i]!;
    const member = team[i]!;
    const nextCard = cards[i + 1];
    const cardEnd = nextCard ? nextCard.openIdx : sectionHtml.length;

    const headingOpenRe = new RegExp(`<${card.tag}\\b[^>]*>`, "i");
    const headingTextStart =
      card.openIdx +
      (sectionHtml.slice(card.openIdx).match(headingOpenRe)?.[0].length ?? 0);
    const headingTextEnd = card.closeEnd - `</${card.tag}>`.length;
    replacements.push({
      from: headingTextStart,
      to: headingTextEnd,
      text: escapeHtml(member.name),
    });

    if (member.role) {
      const after = sectionHtml.slice(card.closeEnd, cardEnd);
      const pMatch = after.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
      if (pMatch && pMatch.index !== undefined) {
        const pOpenLen = pMatch[0].indexOf(">") + 1;
        const pTextStart = card.closeEnd + pMatch.index + pOpenLen;
        const pTextEnd =
          card.closeEnd + pMatch.index + pMatch[0].length - "</p>".length;
        replacements.push({
          from: pTextStart,
          to: pTextEnd,
          text: escapeHtml(member.role),
        });
      }
    }
  }

  if (replacements.length === 0) return { html, replaced: 0 };

  replacements.sort((a, b) => b.from - a.from);
  let updatedSection = sectionHtml;
  for (const r of replacements) {
    updatedSection =
      updatedSection.slice(0, r.from) + r.text + updatedSection.slice(r.to);
  }

  const newHtml =
    html.slice(0, sectionRange.start) +
    updatedSection +
    html.slice(sectionRange.end);
  return { html: newHtml, replaced: limit };
}

export function injectPlanIntoTemplate(
  templateHtml: string,
  plan: Plan,
): InjectionResult {
  if (!isSkeletonInjectEnabled()) {
    return {
      ok: false,
      reason: "disabled",
      slotsFilled: 0,
      slotsTotal: 0,
      fillRatio: 0,
      extendedSlotsFilled: 0,
    };
  }

  // Core слоты — учитываются в fillRatio
  const slots: Array<{ name: string; required: boolean; available: boolean }> = [
    { name: "hero_headline", required: true, available: !!plan.hero_headline },
    { name: "hero_subheadline", required: false, available: !!plan.hero_subheadline },
    { name: "key_benefits", required: false, available: (plan.key_benefits?.length ?? 0) >= 3 },
    { name: "social_proof", required: false, available: !!plan.social_proof_line },
    { name: "cta_primary", required: false, available: !!plan.cta_primary },
    { name: "cta_microcopy", required: false, available: !!plan.cta_microcopy },
    { name: "title", required: false, available: !!plan.business_type },
  ];

  const requiredMissing = slots.filter((s) => s.required && !s.available);
  if (requiredMissing.length > 0) {
    return {
      ok: false,
      reason: `missing_required:${requiredMissing.map((s) => s.name).join(",")}`,
      slotsFilled: 0,
      slotsTotal: slots.length,
      fillRatio: 0,
      extendedSlotsFilled: 0,
    };
  }

  let html = templateHtml;
  let filled = 0;
  let extendedFilled = 0;
  const slotsTotal = slots.filter((s) => s.available).length;

  // 1. <title>
  if (plan.business_type) {
    const r = replaceTitle(html, plan);
    if (r.replaced) {
      html = r.html;
      filled++;
    }
  }

  // 2. Hero headline
  const heroRange = findSectionRange(html, "hero");
  if (heroRange && plan.hero_headline) {
    const r = replaceFirstTagInRange(html, heroRange, "h1", plan.hero_headline);
    if (r.replaced) {
      html = r.html;
      filled++;
    }
  }

  // 3. Hero subheadline
  if (plan.hero_subheadline) {
    const heroRange2 = findSectionRange(html, "hero");
    if (heroRange2) {
      const sectionHtml = html.slice(heroRange2.start, heroRange2.end);
      const h1End = sectionHtml.search(/<\/h1\s*>/i);
      if (h1End >= 0) {
        const after = sectionHtml.slice(h1End);
        const pMatch = after.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
        if (pMatch && pMatch.index !== undefined) {
          const pOpenLen = pMatch[0].indexOf(">") + 1;
          const pTextStart =
            heroRange2.start + h1End + pMatch.index + pOpenLen;
          const pTextEnd =
            heroRange2.start +
            h1End +
            pMatch.index +
            pMatch[0].length -
            "</p>".length;
          html =
            html.slice(0, pTextStart) +
            escapeHtml(plan.hero_subheadline) +
            html.slice(pTextEnd);
          filled++;
        }
      }
    }
  }

  // 4. Key benefits
  if (plan.key_benefits && plan.key_benefits.length >= 3) {
    const benefitsSectionIds = [
      "benefits",
      "features",
      "why-us",
      "about",
    ];
    let injectedBenefits = false;
    for (const sid of benefitsSectionIds) {
      const range = findSectionRange(html, sid);
      if (!range) continue;
      const r = replaceBenefitCards(html, range, plan.key_benefits);
      if (r.replaced >= Math.min(3, plan.key_benefits.length)) {
        html = r.html;
        filled++;
        injectedBenefits = true;
        break;
      }
    }
    if (!injectedBenefits) {
      logger.info(
        SCOPE,
        `Couldn't find suitable section for benefits in template`,
      );
    }
  }

  // 5. Social proof
  if (plan.social_proof_line) {
    const r = replaceSocialProof(html, plan.social_proof_line);
    if (r.replaced) {
      html = r.html;
      filled++;
    }
  }

  // 6. Primary CTA button
  if (plan.cta_primary) {
    const r = replaceHeroPrimaryCta(html, plan.cta_primary);
    if (r.replaced) {
      html = r.html;
      filled++;
    }
  }

  // 7. CTA microcopy
  if (plan.cta_microcopy) {
    const r = injectCtaMicrocopy(html, plan.cta_microcopy);
    if (r.replaced) {
      html = r.html;
      filled++;
    }
  }

  // ─── EXTENDED SLOTS (Tier 4, opt-in: НЕ в slotsTotal) ───
  // Учитываем только если plan содержит данные И section найдена.
  // Если section нет — тихо пропускаем без штрафа fillRatio.
  // Если section есть но replace не сработал — тоже пропускаем (возможно
  // нестандартная структура шаблона; Coder лучше не звать ради этого).

  if (plan.pricing_tiers && plan.pricing_tiers.length >= 2) {
    const range = findSectionRange(html, "pricing");
    if (range) {
      const r = replacePricingTiers(html, range, plan.pricing_tiers);
      if (r.replaced > 0) {
        html = r.html;
        extendedFilled++;
      }
    }
  }

  if (plan.faq && plan.faq.length >= 3) {
    const range = findSectionRange(html, "faq");
    if (range) {
      const r = replaceFaqItems(html, range, plan.faq);
      if (r.replaced > 0) {
        html = r.html;
        extendedFilled++;
      }
    }
  }

  if (plan.hours_text) {
    const r = replaceHoursText(html, plan.hours_text);
    if (r.replaced) {
      html = r.html;
      extendedFilled++;
    }
  }

  if (plan.contact_phone || plan.contact_email || plan.contact_address) {
    const r = replaceContactInfo(html, plan);
    if (r.replaced > 0) {
      html = r.html;
      extendedFilled++;
    }
  }

  // Бренд (лого в nav + название в footer). Opt-in, без штрафа fillRatio.
  if (plan.brand_name) {
    const r = replaceBrand(html, plan.brand_name);
    if (r.replaced > 0) {
      html = r.html;
      extendedFilled++;
    }
  }

  // Команда/мастера. Ищем профильную секцию людей, ставим имя+роль по карточкам.
  if (plan.team && plan.team.length > 0) {
    const teamSectionIds = [
      "team",
      "masters",
      "staff",
      "barbers",
      "instructors",
      "doctors",
      "stylists",
      "trainers",
      "crew",
    ];
    for (const sid of teamSectionIds) {
      const range = findSectionRange(html, sid);
      if (!range) continue;
      const r = replaceTeamCards(html, range, plan.team);
      if (r.replaced > 0) {
        html = r.html;
        extendedFilled++;
        break;
      }
    }
  }

  // Seeded-акцент (косметика, поверх заполненных слотов). Только при наличии
  // variantSeed — иначе (тесты, дефолт-вызовы) HTML не меняется.
  if (typeof plan.variantSeed === "number") {
    html = injectSkeletonAccent(html, plan.variantSeed);
  }

  const fillRatio = slotsTotal > 0 ? filled / slotsTotal : 0;

  if (fillRatio < SLOT_FILL_THRESHOLD) {
    return {
      ok: false,
      reason: `low_fill_ratio:${fillRatio.toFixed(2)}<${SLOT_FILL_THRESHOLD}`,
      slotsFilled: filled,
      slotsTotal,
      fillRatio,
      extendedSlotsFilled: extendedFilled,
    };
  }

  if (extendedFilled > 0) {
    logger.info(
      SCOPE,
      `Extended slots filled: ${extendedFilled} (pricing/faq/hours/contact)`,
    );
  }

  return {
    ok: true,
    html,
    slotsFilled: filled,
    slotsTotal,
    fillRatio,
    extendedSlotsFilled: extendedFilled,
  };
}
