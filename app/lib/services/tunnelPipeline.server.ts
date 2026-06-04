/**
 * TunnelPipeline — двухфазный планировщик для туннельного (BYO-GPU) пути.
 *
 * Раньше туннельный путь был одношаговым: эвристический analyzePrompt →
 * один enriched-промпт → локальная модель. Серверный путь (executeHtmlSimple)
 * при этом гонял полноценный пайплайн (structured plan + RAG few-shot →
 * skeleton-injection / pruned template → Coder → post-polish). Это давало
 * заметную разницу в качестве между fallback и флагманским путём.
 *
 * Здесь паритет восстановлен. LLM-вызовы делегируются модели юзера за
 * туннелем (планировщик и кодер), а ВСЕ детерминированные стадии считаются
 * на сервере:
 *   Фаза 1 (plan):  buildTunnelPlanPrompt — RAG few-shot + retriever shortlist
 *                   + planner system prompt. Текст плана (JSON) генерит туннель.
 *   разбор:         parseTunnelPlan — extractPlanJson + PlanSchema + normalize,
 *                   synthetic-fallback если модель вернула мусор.
 *   резолюция:      resolveTunnelPlan — выбор шаблона; skeleton-injection
 *                   (детерминированно, без второго LLM-вызова) ИЛИ pruned
 *                   template + coder-промпт для фазы 2.
 *   Фаза 2 (code):  HTML генерит туннель по coder-промпту.
 *   финализация:    finalizeTunnelHtml — stripCodeFences + post-polish.
 *
 * Всё best-effort и backward-compatible: если retrieval/few-shot недоступны
 * (в BYO-GPU серверного embeddings-провайдера может не быть), планировщик
 * работает без обогащения; если план не распарсился — synthetic plan.
 */

import { PlanSchema, extractPlanJson, type Plan } from "~/lib/utils/planSchema";
import { normalizePlanForRequest } from "~/lib/services/planQuality";
import {
  buildPlannerSystemPrompt,
  CODER_SYSTEM_PROMPT,
  buildCoderUserMessage,
} from "~/lib/config/htmlPrompts";
import { retrieveTemplates } from "~/lib/services/templateRetriever";
import { buildFewShotPlansAdaptive } from "~/lib/services/fewShotBuilder";
import {
  getTemplateById,
  getFallbackTemplate,
} from "~/lib/config/htmlTemplatesCatalog";
import {
  loadTemplateHtml,
  loadTemplateHtmlForLlm,
} from "~/lib/config/htmlTemplates.server";
import { injectPlanIntoTemplate } from "~/lib/services/skeletonInjector";
import { pruneTemplateForPlan } from "~/lib/utils/templatePrune";
import { postPolishHtml } from "~/lib/services/htmlPostPolish";
import {
  inferStylePresetId,
  injectStylePreset,
  type StylePresetId,
} from "~/lib/llm/style-presets";
import { stripCodeFences } from "~/lib/services/htmlOrchestrator.helpers";
import { logger } from "~/lib/utils/logger";

const SCOPE = "tunnelPipeline";

/** Бюджет токенов на фазу планировщика (JSON-план короткий). */
export const TUNNEL_PLAN_MAX_TOKENS = 2500;
/** Бюджет токенов на фазу кодера (большой HTML). */
export const TUNNEL_CODE_MAX_TOKENS = 8000;
/** Лимит на best-effort retrieval, чтобы не подвешивать запрос если
 *  embeddings-провайдер недоступен/медленный. */
const RETRIEVAL_TIMEOUT_MS = 4000;

export type TunnelPlanPrompt = { system: string; prompt: string };

/**
 * Строит promter-промпт фазы 1 (на сервере, без LLM). Подмешивает RAG
 * few-shot и retriever-shortlist если доступны (best-effort, со своим
 * таймаутом). Никогда не бросает — при любой ошибке/таймауте обогащение
 * просто пустое.
 */
export async function buildTunnelPlanPrompt(
  sanitizedMessage: string,
): Promise<TunnelPlanPrompt> {
  const retrievalSignal = AbortSignal.timeout(RETRIEVAL_TIMEOUT_MS);

  let candidateIds: string[] | undefined;
  try {
    const retrieved = await retrieveTemplates(sanitizedMessage, 5, retrievalSignal);
    candidateIds = retrieved ?? undefined;
  } catch {
    // retriever недоступен/таймаут — продолжаем без shortlist
  }

  let fewShotBlock = "";
  try {
    const fs = await buildFewShotPlansAdaptive(sanitizedMessage, retrievalSignal);
    fewShotBlock = fs.block;
  } catch {
    // few-shot недоступен/таймаут — продолжаем без него
  }

  return {
    system: buildPlannerSystemPrompt(candidateIds, fewShotBlock),
    prompt: sanitizedMessage,
  };
}

/**
 * Парсит текст плана от туннеля. extractPlanJson + PlanSchema + normalize.
 * При неудаче — synthetic-fallback (как obtainPlan), чтобы фаза 2 всё равно
 * могла выполниться. Не бросает.
 */
export function parseTunnelPlan(rawPlanText: string, sanitizedMessage: string): Plan {
  try {
    const raw = extractPlanJson(rawPlanText);
    const parsed = PlanSchema.safeParse(raw);
    if (parsed.success) {
      return normalizePlanForRequest(parsed.data, sanitizedMessage);
    }
    logger.warn(SCOPE, "Tunnel plan schema validation failed, using synthetic plan");
  } catch (err) {
    logger.warn(SCOPE, `Tunnel plan JSON extract failed: ${(err as Error).message}`);
  }

  const synthetic: Plan = {
    business_type: sanitizedMessage.slice(0, 100) || "универсальный сайт",
    target_audience: "",
    tone: "профессиональный",
    style_hints: "",
    color_mood: "light-minimal",
    sections: ["hero", "about", "features", "contact"],
    keywords: [],
    cta_primary: "Связаться",
    language: "ru",
    suggested_template_id: "blank-landing",
  };
  return normalizePlanForRequest(synthetic, sanitizedMessage);
}

function htmlContainsPrimaryCta(html: string, plan: Plan): boolean {
  if (!plan.cta_primary?.trim()) return true;
  return html.toLowerCase().includes(plan.cta_primary.toLowerCase());
}

export type PlanResolution =
  | {
      kind: "skeleton";
      html: string;
      templateId: string;
      templateName: string;
    }
  | {
      kind: "coder";
      system: string;
      prompt: string;
      templateId: string;
      templateName: string;
      presetId: StylePresetId;
    };

/**
 * Резолвит план в действие фазы 2. Зеркалит логику executeHtmlSimple:
 * для generic-пресета пробует skeleton-injection (без второго LLM-вызова);
 * если слоты заполнились и primary CTA на месте — возвращает готовый HTML.
 * Иначе — pruned template + coder-промпт для отправки в туннель.
 */
export function resolveTunnelPlan(
  plan: Plan,
  sanitizedMessage: string,
  stylePresetIdInput?: StylePresetId,
): PlanResolution {
  const template = getTemplateById(plan.suggested_template_id) ?? getFallbackTemplate();
  const presetId: StylePresetId =
    stylePresetIdInput ?? inferStylePresetId(sanitizedMessage, plan);

  // Skeleton-injection пробуем только для generic-пресета (как в pipelineCreate)
  // и только для русских планов: шаблоны lang="ru", без Кодера их статичные
  // тексты не переводятся. Стилевые пресеты требуют генерации кодером.
  if (presetId === "generic" && plan.language === "ru") {
    const cleanTemplateHtml = loadTemplateHtml(template.id);
    const injection = injectPlanIntoTemplate(cleanTemplateHtml, plan);
    if (injection.ok && htmlContainsPrimaryCta(injection.html, plan)) {
      // pipelineCreate для skeleton-пути НЕ применяет post-polish, только
      // stripCodeFences — повторяем 1-в-1.
      return {
        kind: "skeleton",
        html: stripCodeFences(injection.html),
        templateId: template.id,
        templateName: template.name,
      };
    }
  }

  const rawTemplateHtml = loadTemplateHtmlForLlm(template.id);
  const pruned = pruneTemplateForPlan(rawTemplateHtml, plan.sections);
  return {
    kind: "coder",
    system: injectStylePreset(CODER_SYSTEM_PROMPT, presetId),
    prompt: buildCoderUserMessage({ templateHtml: pruned.html, plan }),
    templateId: template.id,
    templateName: template.name,
    presetId,
  };
}

/**
 * Финализирует HTML фазы кодера: stripCodeFences + post-polish (как
 * серверный путь). Для skeleton-результата вызывать НЕ нужно — он уже готов.
 */
export function finalizeTunnelHtml(
  rawHtml: string,
  plan: Plan,
  presetId: StylePresetId,
): string {
  const cleaned = stripCodeFences(rawHtml);
  return postPolishHtml({ html: cleaned, presetId, plan }).html;
}
