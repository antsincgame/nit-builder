/**
 * Load seeds в ragStore при первом обращении. Idempotent через sentinel-запись.
 *
 * Zero-cost если sentinel текущей версии уже есть: hasDocument() → return.
 * При первом запуске или bump SEED_VERSION:
 *   - добавляет plan_example seeds из planExamples.ts (24 базовых)
 *   - добавляет extended seeds из planExamplesExtended.ts (8 с pricing/faq/hours/contact)
 *   - добавляет v8 seeds из planExamplesV8.ts (6 новых ниш)
 *   - добавляет admin seeds из planExamplesAdmin.ts и planExamplesAdmin2.ts
 *     (6 с needs_admin/editable_zones)
 *   - добавляет collection seeds из planExamplesCollections.ts (2 с collections)
 *   - добавляет hero_headline / benefits / social_proof / cta_microcopy
 *     из copywritingBank.ts и copywritingBankV8.ts
 *   - пишет sentinel
 *
 * Старые seed:plan:* из предыдущей версии остаются в JSONL — id-дедупликация
 * в addDocument гарантирует что повторно они не зальются. Новые добавятся.
 *
 * Доливка сидов БЕЗ бампа версии (как admin-сиды): repair-ветка ниже видит
 * totalPlanSeeds < EXPECTED_PLAN_SEEDS и прогоняет все сиды заново: существующие
 * дедупятся мгновенно (addDocument возвращает existing с эмбеддингом),
 * новые встают в корпус без дублей контента. Бамп нужен только при ИЗМЕНЕНИИ
 * текста/плана существующего сида (иначе старая версия останется в Map).
 *
 * Tier 2 (since v3): plan_example seeds индексируются с contextual prefix
 * `[niche | tone | mood] query` — это даёт +30-50% recall на medium queries
 * (перефразировки, билингвал, гибридные ниши).
 *
 * Tier 4 (v4): отдельный массив PLAN_EXAMPLE_SEEDS_EXTENDED с примерами pricing_tiers/
 * faq/hours_text/contact_*. Позволяет Planner через few-shot увидеть как выдавать
 * расширенные поля — 7B модель без живых примеров в корпусе редко берёт optional поля.
 *
 * v5: repair partial bootstrap (sentinel без embedded seeds) + craft workshop seed.
 * v6: premium beauty seed + stricter weak-model template/language guidance.
 * v7: medical translation seed + deterministic weak-model RU copy repair.
 * v8: 6 новых ниш в planExamplesV8.ts — vet, home-services, digital-agency,
 *     moving, renovation, hotel. Все с extended-полями и копирайтом по планке
 *     planQuality (цифры в benefits, без штампов).
 * v8 (доливка): 3 admin-сида в planExamplesAdmin.ts — needs_admin=true,
 *     editable_zones разных структур (прайс услуг / richtext-программы /
 *     мини-каталог с image-зонами), explicit и inferred confidence.
 * v8 (доливка 2): ещё 3 admin-сида в planExamplesAdmin2.ts — клининг
 *     (редактируемые цены тарифов), кондитерская (каталог тортов:
 *     фото+название+цена), психолог (richtext-статьи и расписание, inferred).
 * v8 (доливка 3): копирайт-банк для ниш v8 в copywritingBankV8.ts —
 *     hero/benefits/social_proof/microcopy. Копирайт-доки без явных id
 *     дедупятся в addDocument по контенту.
 * v8 (доливка 4): 2 сида с collections (Tier 6) в planExamplesCollections.ts —
 *     ресторан (меню как коллекция, explicit) и магазин чехлов (товары,
 *     inferred). Учат разделению: единичное — зоны, повторяемое — коллекции.
 *
 * Вызывается ленивыми точками: buildFewShotPlansAdaptive, admin endpoints.
 * Если RAG_ENABLED=0 или embedding недоступен — ничего не делает.
 */

import { logger } from "~/lib/utils/logger";
import { addDocument, getSeedCoverage, hasDocument } from "~/lib/services/ragStore";
import { isRagDisabled } from "~/lib/services/ragEmbeddings";
import { PLAN_EXAMPLE_SEEDS } from "~/lib/rag/seeds/planExamples";
import { PLAN_EXAMPLE_SEEDS_EXTENDED } from "~/lib/rag/seeds/planExamplesExtended";
import { PLAN_EXAMPLE_SEEDS_V8 } from "~/lib/rag/seeds/planExamplesV8";
import { PLAN_EXAMPLE_SEEDS_ADMIN } from "~/lib/rag/seeds/planExamplesAdmin";
import { PLAN_EXAMPLE_SEEDS_ADMIN_2 } from "~/lib/rag/seeds/planExamplesAdmin2";
import { PLAN_EXAMPLE_SEEDS_COLLECTIONS } from "~/lib/rag/seeds/planExamplesCollections";
import {
  HERO_HEADLINE_SEEDS,
  BENEFITS_SEEDS,
  SOCIAL_PROOF_SEEDS,
  MICROCOPY_SEEDS,
} from "~/lib/rag/seeds/copywritingBank";
import {
  HERO_HEADLINE_SEEDS_V8,
  BENEFITS_SEEDS_V8,
  SOCIAL_PROOF_SEEDS_V8,
  MICROCOPY_SEEDS_V8,
} from "~/lib/rag/seeds/copywritingBankV8";
import { buildContextualText } from "~/lib/services/contextualEmbed";

const SCOPE = "ragBootstrap";
const SEED_VERSION = "v8";
const SENTINEL_ID = `__seed_sentinel:${SEED_VERSION}`;
const EXPECTED_PLAN_SEEDS =
  PLAN_EXAMPLE_SEEDS.length +
  PLAN_EXAMPLE_SEEDS_EXTENDED.length +
  PLAN_EXAMPLE_SEEDS_V8.length +
  PLAN_EXAMPLE_SEEDS_ADMIN.length +
  PLAN_EXAMPLE_SEEDS_ADMIN_2.length +
  PLAN_EXAMPLE_SEEDS_COLLECTIONS.length;

let bootstrapPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (isRagDisabled()) return;
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = doBootstrap().catch((err) => {
    logger.warn(SCOPE, `Bootstrap failed: ${(err as Error).message}`);
    bootstrapPromise = null; // позволим retry
    throw err;
  });
  return bootstrapPromise;
}

async function doBootstrap(): Promise<void> {
  if (await hasDocument(SENTINEL_ID)) {
    const coverage = await getSeedCoverage(SEED_VERSION);
    if (
      coverage.totalPlanSeeds >= EXPECTED_PLAN_SEEDS &&
      coverage.embeddedPlanSeeds >= EXPECTED_PLAN_SEEDS
    ) {
      logger.info(SCOPE, `Seeds ${SEED_VERSION} already present, skipping`);
      return;
    }
    logger.warn(
      SCOPE,
      `Seeds ${SEED_VERSION} incomplete (${coverage.embeddedPlanSeeds}/${EXPECTED_PLAN_SEEDS} embedded), repairing`,
    );
  }

  let added = 0;
  let embeddedPlanSeeds = 0;
  let missingPlanEmbeddings = 0;
  let optionalFailed = 0;

  // Base (24 ниши) + extended (8 с pricing/faq/hours/contact) + v8 (6 новых ниш)
  // + admin×2 (6 видов админки) + collections (2 сида Tier 6)
  const allPlanSeeds = [
    ...PLAN_EXAMPLE_SEEDS,
    ...PLAN_EXAMPLE_SEEDS_EXTENDED,
    ...PLAN_EXAMPLE_SEEDS_V8,
    ...PLAN_EXAMPLE_SEEDS_ADMIN,
    ...PLAN_EXAMPLE_SEEDS_ADMIN_2,
    ...PLAN_EXAMPLE_SEEDS_COLLECTIONS,
  ];

  for (const seed of allPlanSeeds) {
    // Contextual prefix: ниша + tone + mood
    const contextualText = buildContextualText(seed.query, {
      niche: seed.niche,
      tone: seed.plan.tone,
      mood: seed.plan.color_mood,
    });
    const result = await addDocument({
      id: `seed:plan:${seed.id}:${SEED_VERSION}`,
      text: seed.query,
      contextualText,
      category: "plan_example",
      metadata: {
        query: seed.query,
        plan: seed.plan,
        niche: seed.niche,
        source: `seed_${SEED_VERSION}`,
      },
    });
    if (result?.embedding && result.embedding.length > 0) {
      added++;
      embeddedPlanSeeds++;
    } else {
      missingPlanEmbeddings++;
    }
  }

  for (const hero of [...HERO_HEADLINE_SEEDS, ...HERO_HEADLINE_SEEDS_V8]) {
    const result = await addDocument({
      text: hero.text,
      category: "hero_headline",
      metadata: {
        niche: hero.niche,
        tone: hero.tone,
        language: hero.language,
        source: `seed_${SEED_VERSION}`,
      },
    });
    if (result) added++;
    else optionalFailed++;
  }

  for (const benefits of [...BENEFITS_SEEDS, ...BENEFITS_SEEDS_V8]) {
    const result = await addDocument({
      text: benefits.items.map((b) => `${b.title}: ${b.description}`).join(" | "),
      category: "benefits",
      metadata: {
        items: benefits.items,
        niche: benefits.niche,
        language: benefits.language,
        source: `seed_${SEED_VERSION}`,
      },
    });
    if (result) added++;
    else optionalFailed++;
  }

  for (const proof of [...SOCIAL_PROOF_SEEDS, ...SOCIAL_PROOF_SEEDS_V8]) {
    const result = await addDocument({
      text: proof.text,
      category: "social_proof",
      metadata: {
        niche: proof.niche,
        language: proof.language,
        source: `seed_${SEED_VERSION}`,
      },
    });
    if (result) added++;
    else optionalFailed++;
  }

  for (const mc of [...MICROCOPY_SEEDS, ...MICROCOPY_SEEDS_V8]) {
    const result = await addDocument({
      text: mc.text,
      category: "cta_microcopy",
      metadata: { niche: mc.niche, purpose: mc.purpose, source: `seed_${SEED_VERSION}` },
    });
    if (result) added++;
    else optionalFailed++;
  }

  // Sentinel пишем только если ключевой plan_example корпус реально searchable.
  // Иначе один сбой embedding API создаст вечный "успешный" bootstrap с пустым RAG.
  if (embeddedPlanSeeds >= EXPECTED_PLAN_SEEDS) {
    await addDocument({
      id: SENTINEL_ID,
      text: `seed sentinel ${SEED_VERSION}`,
      category: "plan_example",
      metadata: { isSentinel: true, version: SEED_VERSION },
      skipEmbed: true,
    });
    logger.info(
      SCOPE,
      `Bootstrap ${SEED_VERSION}: plan seeds embedded=${embeddedPlanSeeds}/${EXPECTED_PLAN_SEEDS}, optional docs added=${added - embeddedPlanSeeds}, optional failed=${optionalFailed}`,
    );
  } else {
    logger.warn(
      SCOPE,
      `Bootstrap ${SEED_VERSION} incomplete: plan seeds embedded=${embeddedPlanSeeds}/${EXPECTED_PLAN_SEEDS}, missing=${missingPlanEmbeddings}. Retry later.`,
    );
  }
}

export function _resetBootstrapState(): void {
  bootstrapPromise = null;
}
