/**
 * Create-режим пайплайна: Planner → Template → Skeleton-injection (Tier 3) → Coder.
 *
 * Skeleton-injection. Если plan содержит весь требуемый копирайт И в шаблоне
 * есть совместимая структура для слотов — Coder LLM пропускается, экономит
 * ~6000+ prompt tokens и ~10s latency. Иначе — стандартный Coder pipeline.
 *
 * Tier 4 — extended slots в skeleton: pricing_tiers / faq / hours_text / contact_*.
 * Заполняются только если plan содержит данные И section найдена в шаблоне.
 */

import { streamText } from "ai";
import type { Plan } from "~/lib/utils/planSchema";
import {
  CODER_SYSTEM_PROMPT,
  CUSTOM_ARTIFACT_SYSTEM_PROMPT,
  buildCoderUserMessage,
  buildCustomArtifactUserMessage,
  shouldUseCustomArtifactMode,
} from "~/lib/config/htmlPrompts";
import {
  getTemplateById,
  getFallbackTemplate,
} from "~/lib/config/htmlTemplatesCatalog";
import {
  loadTemplateHtml,
  loadTemplateHtmlForLlm,
} from "~/lib/config/htmlTemplates.server";
import {
  getPreferredProvider,
  getModel,
  calcCoderMaxOutput,
  checkContextBudget,
} from "~/lib/llm/client";
import { sanitizeUserMessage } from "~/lib/utils/promptSanitizer";
import {
  updateSessionHtml,
  setTruncation,
  clearTruncation,
  type SessionMemory,
} from "~/lib/services/sessionMemory";
import { logger } from "~/lib/utils/logger";
import { metrics } from "~/lib/services/metrics";
import { recordGeneration } from "~/lib/services/feedbackStore";
import { pruneTemplateForPlan } from "~/lib/utils/templatePrune";
import { MAX_CONTINUATION_ATTEMPTS, cleanRawForTail } from "~/lib/services/continuation";
import { injectPlanIntoTemplate } from "~/lib/services/skeletonInjector";
import { buildCustomArtifactHtml } from "~/lib/services/customArtifactBuilder";
import {
  buildPhpSqliteArtifact,
  renderPhpSqliteArtifactPreview,
} from "~/lib/services/phpSqliteArtifactBuilder";
import { injectStylePreset, type StylePresetId } from "~/lib/llm/style-presets";
import { obtainPlan } from "~/lib/services/pipelinePlanner";
import {
  stripCodeFences,
  readUsage,
  readFinishReason,
  HTML_STOP_SEQUENCES,
  SCOPE,
} from "~/lib/services/htmlOrchestrator.helpers";
import type {
  PipelineEvent,
  OrchestratorOptions,
} from "~/lib/services/htmlOrchestrator.types";

function htmlContainsPrimaryCta(html: string, plan: Plan): boolean {
  if (!plan.cta_primary?.trim()) return true;
  return html.toLowerCase().includes(plan.cta_primary.toLowerCase());
}

function resolveArtifactMode(
  sanitizedUserMessage: string,
  options: OrchestratorOptions,
): "template" | "custom" | "php-sqlite" {
  if (options.artifactMode === "php-sqlite") return "php-sqlite";
  if (options.artifactMode === "custom") return "custom";
  if (options.artifactMode === "template") return "template";
  return shouldUseCustomArtifactMode(sanitizedUserMessage) ? "custom" : "template";
}

function customArtifactLooksTooThin(html: string): boolean {
  if (html.length < 20_000) return true;
  if (/<!--\s*(add|todo|здесь|placeholder)/i.test(html)) return true;
  const sectionCount = (html.match(/<section\b/gi) ?? []).length;
  const keyframesCount = (html.match(/@keyframes\b/gi) ?? []).length;
  const cardishCount = (html.match(/class=["'][^"']*(card|panel|tile|widget|stat|feature)/gi) ?? []).length;
  return sectionCount < 6 || keyframesCount < 2 || cardishCount < 8;
}

function normalizeBackendPlanForPrompt(plan: Plan, prompt: string): Plan {
  const text = prompt.toLowerCase();
  const match = [
    { re: /косметик|beauty|cosmetic/, type: "интернет-магазин косметики", keywords: ["косметика", "каталог", "корзина", "заказы"] },
    { re: /доставк.*ед|еда|restaurant|food/, type: "сервис доставки еды", keywords: ["меню", "доставка", "корзина", "заказы"] },
    { re: /аренд.*авто|машин|car rental|автопрокат/, type: "сервис аренды авто", keywords: ["авто", "аренда", "заявки", "оплата"] },
    { re: /клиник|медиц|clinic|doctor/, type: "клиника", keywords: ["услуги", "запись", "заявки", "статусы"] },
    { re: /недвиж|real estate|объект/, type: "агентство недвижимости", keywords: ["объекты", "заявки", "статусы", "админка"] },
    { re: /курс|школ|school|course/, type: "школа онлайн-курсов", keywords: ["курсы", "тарифы", "заявки", "админка"] },
    { re: /crm|клиент/, type: "mini CRM", keywords: ["клиенты", "заказы", "статусы", "админка"] },
    { re: /маркетплейс|marketplace/, type: "маркетплейс услуг", keywords: ["категории", "заказы", "исполнители", "оплаты"] },
  ].find((item) => item.re.test(text));

  if (!match) return plan;

  const sections = Array.from(new Set([
    "hero",
    "catalog",
    "cart",
    "checkout",
    "admin",
    "orders",
    "contact",
  ]));
  return {
    ...plan,
    business_type: match.type,
    sections,
    keywords: Array.from(new Set([...match.keywords, ...plan.keywords])).slice(0, 15),
    hero_headline: `${match.type}: PHP + SQLite backend`,
    hero_subheadline: "Каталог, корзина, checkout, заказы и админка в одном готовом PHP-проекте.",
    suggested_template_id: "blank-landing",
  };
}

export async function* executeHtmlSimple(
  memory: SessionMemory,
  userMessage: string,
  signal: AbortSignal,
  options: OrchestratorOptions = {},
): AsyncGenerator<PipelineEvent> {
  const provider = getPreferredProvider(options.providerOverride);
  if (!provider) {
    yield {
      type: "error",
      message: "Нет доступного LLM провайдера. Запусти LM Studio с загруженной моделью (по умолчанию http://localhost:1234).",
    };
    return;
  }

  const sanitized = sanitizeUserMessage(userMessage);
  const model = getModel(provider);
  const startMs = Date.now();
  metrics.generationStarted("create", provider.id);

  clearTruncation(memory.sessionId);

  let currentPlan: Plan | undefined;
  let planCachedFlag = false;

  yield {
    type: "step_start",
    roleName: "Планировщик",
    model: provider.defaultModel,
    provider: provider.id,
  };

  try {
    const obtained = await obtainPlan(
      model,
      sanitized,
      signal,
      options.skipPlanCache ?? false,
      provider.defaultModel,
    );
    currentPlan = obtained.plan;
    planCachedFlag = obtained.cached;
    memory.planJson = obtained.plan;
    if (obtained.reasoningChars > 0) {
      yield { type: "plan_reasoning", chars: obtained.reasoningChars };
    }
    if (obtained.fewShotCount > 0) {
      yield {
        type: "rag_fewshot",
        count: obtained.fewShotCount,
        topScore: obtained.fewShotTopScore,
        approxTokens: obtained.fewShotApproxTokens,
      };
    }
    yield { type: "plan_ready", plan: obtained.plan, cached: obtained.cached };
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    metrics.generationFailed("create", "planner_error");
    recordGeneration({
      sessionId: memory.sessionId,
      mode: "create",
      outcome: "error",
      provider: provider.id,
      model: provider.defaultModel,
      durationMs: Date.now() - startMs,
      userMessage: sanitized,
      errorReason: `planner: ${(err as Error).message}`,
    });
    yield { type: "error", message: `Ошибка планировщика: ${(err as Error).message}` };
    return;
  }

  const template = getTemplateById(currentPlan.suggested_template_id) ?? getFallbackTemplate();
  memory.templateId = template.id;
  // Раньше дублировался в local `let currentTemplateId` — после селекта
  // template остаётся в том же скоупе и не пере-присваивается, дублёр
  // удалён. Везде ниже используется напрямую template.id.

  const artifactMode = resolveArtifactMode(sanitized, options);
  if (artifactMode === "php-sqlite") {
    currentPlan = normalizeBackendPlanForPrompt(currentPlan, sanitized);
    memory.planJson = currentPlan;
    metrics.skeletonInjectSkipped("php_sqlite_artifact_mode");
    logger.info(SCOPE, "Backend artifact mode: generating deterministic PHP + SQLite project manifest");
    memory.templateId = "php-sqlite-app";

    yield {
      type: "step_start",
      roleName: "Backend builder",
      model: provider.defaultModel,
      provider: provider.id,
    };
    yield {
      type: "template_selected",
      templateId: "php-sqlite-app",
      templateName: "PHP + SQLite backend",
    };

    const artifact = buildPhpSqliteArtifact({
      plan: currentPlan,
      userMessage: sanitized,
    });
    const fullHtml = renderPhpSqliteArtifactPreview({
      artifact,
      plan: currentPlan,
      userMessage: sanitized,
    });
    memory.currentHtml = fullHtml;
    memory.updatedAt = Date.now();
    updateSessionHtml(memory.sessionId, fullHtml);
    const totalMs = Date.now() - startMs;
    metrics.generationCompleted("create", provider.id, totalMs);
    recordGeneration({
      sessionId: memory.sessionId,
      mode: "create",
      outcome: "success",
      provider: provider.id,
      model: provider.defaultModel,
      durationMs: totalMs,
      userMessage: sanitized,
      plan: currentPlan,
      templateId: "php-sqlite-app",
      planCached: planCachedFlag,
      injectMethod: "skeleton",
      errorReason: "php-sqlite-artifact",
    });

    yield { type: "text", text: fullHtml };
    yield { type: "step_complete", html: fullHtml };
    return;
  }

  yield { type: "template_selected", templateId: template.id, templateName: template.name };
  metrics.templateSelected(template.id);

  if (artifactMode === "custom") {
    metrics.skeletonInjectSkipped("custom_artifact_mode");
    logger.info(SCOPE, "Skeleton-injection пропущена (custom_artifact_mode), вызываем Coder с нуля");

    yield {
      type: "step_start",
      roleName: "Кодер",
      model: provider.defaultModel,
      provider: provider.id,
    };

    try {
      const planJsonStr = JSON.stringify(currentPlan);
      const estimatedInputChars =
        CUSTOM_ARTIFACT_SYSTEM_PROMPT.length + planJsonStr.length + sanitized.length + 500;
      const budget = checkContextBudget(provider, estimatedInputChars, 12_000);
      if (budget.warning) logger.warn(SCOPE, budget.warning);
      if (!budget.ok) {
        metrics.generationFailed("create", "context_overflow");
        yield { type: "error", message: budget.warning ?? "Context overflow" };
        return;
      }

      let result: Awaited<ReturnType<typeof streamText>> | null = null;
      let rawHtml = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const attemptPrompt = attempt === 0
          ? buildCustomArtifactUserMessage({ userMessage: sanitized, plan: currentPlan })
          : `${buildCustomArtifactUserMessage({ userMessage: sanitized, plan: currentPlan })}

ПРЕДЫДУЩАЯ ПОПЫТКА БЫЛА СЛИШКОМ КОРОТКОЙ/ШАБЛОННОЙ.
Сейчас обязательно сделай полноценный 25-60KB artifact: большой CSS, 6+ sections, 12+ panels/cards, inline SVG scene, no placeholders.`;

        result = await streamText({
          model,
          system: CUSTOM_ARTIFACT_SYSTEM_PROMPT,
          prompt: attemptPrompt,
          maxOutputTokens: 16_000,
          temperature: 0.55,
          abortSignal: signal,
        });

        rawHtml = "";
        for await (const delta of result.textStream) {
          rawHtml += delta;
          yield { type: "text", text: delta };
        }

        const preview = stripCodeFences(rawHtml);
        if (!customArtifactLooksTooThin(preview)) break;
        logger.warn(SCOPE, `Custom artifact attempt ${attempt + 1} too thin (${preview.length} chars), retrying`);
      }

      const usage = result ? await readUsage(result) : { prompt: 0, completion: 0 };
      if (usage.prompt > 0 || usage.completion > 0) {
        metrics.tokensUsed("create", "prompt", usage.prompt);
        metrics.tokensUsed("create", "completion", usage.completion);
        yield {
          type: "tokens",
          mode: "create",
          prompt: usage.prompt,
          completion: usage.completion,
        };
      }

      const totalMs = Date.now() - startMs;
      const generatedHtml = stripCodeFences(rawHtml);
      const fullHtml = customArtifactLooksTooThin(generatedHtml)
        ? buildCustomArtifactHtml({ plan: currentPlan, userMessage: sanitized })
        : generatedHtml;
      if (fullHtml !== generatedHtml) {
        logger.warn(SCOPE, `Custom artifact fallback builder used (${generatedHtml.length} generated chars)`);
      }
      memory.currentHtml = fullHtml;
      memory.updatedAt = Date.now();
      updateSessionHtml(memory.sessionId, fullHtml);
      metrics.generationCompleted("create", provider.id, totalMs);
      recordGeneration({
        sessionId: memory.sessionId,
        mode: "create",
        outcome: "success",
        provider: provider.id,
        model: provider.defaultModel,
        durationMs: totalMs,
        userMessage: sanitized,
        plan: currentPlan,
        templateId: template.id,
        planCached: planCachedFlag,
        injectMethod: "coder",
      });

      yield { type: "step_complete", html: fullHtml };
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      metrics.generationFailed("create", "coder_error");
      yield { type: "error", message: `Ошибка кодера: ${(err as Error).message}` };
      return;
    }
  }

  metrics.skeletonInjectAttempted();
  const cleanTemplateHtml = loadTemplateHtml(template.id);
  const injection = injectPlanIntoTemplate(cleanTemplateHtml, currentPlan);

  if (injection.ok && htmlContainsPrimaryCta(injection.html, currentPlan)) {
    metrics.skeletonInjectSucceeded(template.id, injection.fillRatio);
    metrics.skeletonExtendedSlotsFilled(injection.extendedSlotsFilled);
    const finalHtml = stripCodeFences(injection.html);
    memory.currentHtml = finalHtml;
    memory.updatedAt = Date.now();
    updateSessionHtml(memory.sessionId, finalHtml);
    const totalMs = Date.now() - startMs;
    metrics.generationCompleted("create", provider.id, totalMs);

    logger.info(
      SCOPE,
      `Skeleton-injection сработала: ${template.id}, slots=${injection.slotsFilled}/${injection.slotsTotal}, ext=${injection.extendedSlotsFilled}, fillRatio=${injection.fillRatio.toFixed(2)}, totalMs=${totalMs} (Coder пропущен)`,
    );

    recordGeneration({
      sessionId: memory.sessionId,
      mode: "create",
      outcome: "success",
      provider: provider.id,
      model: provider.defaultModel,
      durationMs: totalMs,
      userMessage: sanitized,
      plan: currentPlan,
      templateId: template.id,
      planCached: planCachedFlag,
      injectMethod: "skeleton",
      skeletonFillRatio: injection.fillRatio,
    });

    yield {
      type: "skeleton_inject_used",
      templateId: template.id,
      slotsFilled: injection.slotsFilled,
      slotsTotal: injection.slotsTotal,
      fillRatio: injection.fillRatio,
      extendedSlotsFilled: injection.extendedSlotsFilled,
    };
    yield { type: "step_complete", html: finalHtml };
    return;
  }

  const skeletonSkipReason = injection.ok ? "missing_primary_cta" : injection.reason;
  metrics.skeletonInjectSkipped(skeletonSkipReason);
  logger.info(SCOPE, `Skeleton-injection пропущена (${skeletonSkipReason}), вызываем Coder`);

  const rawTemplateHtml = loadTemplateHtmlForLlm(template.id);
  const pruneResult = pruneTemplateForPlan(rawTemplateHtml, currentPlan.sections);
  const templateHtml = pruneResult.html;
  if (pruneResult.removed.length > 0) {
    logger.info(
      SCOPE,
      `Pruned ${pruneResult.removed.length} sections from ${template.id}: removed=[${pruneResult.removed.join(", ")}], kept=[${pruneResult.kept.join(", ")}], saved=${rawTemplateHtml.length - templateHtml.length}ch`,
    );
    metrics.templatePruned(pruneResult.removed.length);
    yield {
      type: "template_pruned",
      removed: pruneResult.removed,
      kept: pruneResult.kept,
    };
  }

  // === Style preset injection для Coder system prompt ===
  // Default "generic" → no-op (возвращает CODER_SYSTEM_PROMPT без изменений).
  // "neon-cyber" → дописывает ~900 chars правил (палитра, шрифты, glitch/hairline).
  // Сохраняем исходный prompt чтобы можно было считать promptDelta для дебага.
  const presetId: StylePresetId = options.stylePresetId ?? "generic";
  const coderSystemPrompt = injectStylePreset(CODER_SYSTEM_PROMPT, presetId);
  const promptDelta = coderSystemPrompt.length - CODER_SYSTEM_PROMPT.length;
  if (promptDelta > 0) {
    yield { type: "style_preset_used", presetId, promptDelta };
  }

  yield {
    type: "step_start",
    roleName: "Кодер",
    model: provider.defaultModel,
    provider: provider.id,
  };

  try {
    const planJsonStr = JSON.stringify(currentPlan);
    const estimatedInputChars =
      templateHtml.length + planJsonStr.length + coderSystemPrompt.length + 200;
    const budget = checkContextBudget(provider, estimatedInputChars, 8000);
    if (budget.warning) logger.warn(SCOPE, budget.warning);
    if (!budget.ok) {
      metrics.generationFailed("create", "context_overflow");
      recordGeneration({
        sessionId: memory.sessionId,
        mode: "create",
        outcome: "error",
        provider: provider.id,
        model: provider.defaultModel,
        durationMs: Date.now() - startMs,
        userMessage: sanitized,
        plan: currentPlan,
        templateId: template.id,
        planCached: planCachedFlag,
        injectMethod: "coder",
        errorReason: "context_overflow",
      });
      yield { type: "error", message: budget.warning ?? "Context overflow" };
      return;
    }

    const maxOutput = calcCoderMaxOutput(
      provider,
      templateHtml.length,
      planJsonStr.length,
      coderSystemPrompt.length,
    );

    const result = await streamText({
      model,
      system: coderSystemPrompt,
      prompt: buildCoderUserMessage({ templateHtml, plan: currentPlan }),
      maxOutputTokens: maxOutput,
      temperature: 0.4,
      stopSequences: HTML_STOP_SEQUENCES,
      abortSignal: signal,
    });

    let rawHtml = "";
    for await (const delta of result.textStream) {
      rawHtml += delta;
      yield { type: "text", text: delta };
    }

    const finishReason = await readFinishReason(result);
    const usage = await readUsage(result);
    if (usage.prompt > 0 || usage.completion > 0) {
      metrics.tokensUsed("create", "prompt", usage.prompt);
      metrics.tokensUsed("create", "completion", usage.completion);
      yield {
        type: "tokens",
        mode: "create",
        prompt: usage.prompt,
        completion: usage.completion,
      };
    }

    const totalMs = Date.now() - startMs;

    if (finishReason === "length") {
      metrics.generationTruncated("create");
      const rawForTail = cleanRawForTail(rawHtml);
      setTruncation(memory.sessionId, {
        mode: "create",
        userMessage: sanitized,
        plan: currentPlan,
        templateId: template.id,
        partialHtml: rawForTail,
        attempt: 0,
        providerId: provider.id,
      });
      const preview = stripCodeFences(rawHtml);
      memory.currentHtml = preview;
      memory.updatedAt = Date.now();
      updateSessionHtml(memory.sessionId, preview);
      metrics.generationCompleted("create", provider.id, totalMs);
      recordGeneration({
        sessionId: memory.sessionId,
        mode: "create",
        outcome: "success",
        provider: provider.id,
        model: provider.defaultModel,
        durationMs: totalMs,
        userMessage: sanitized,
        plan: currentPlan,
        templateId: template.id,
        planCached: planCachedFlag,
        injectMethod: "coder",
        errorReason: "truncated",
      });
      yield {
        type: "truncated",
        canContinue: true,
        attemptsLeft: MAX_CONTINUATION_ATTEMPTS,
        partialChars: rawForTail.length,
      };
      yield { type: "step_complete", html: preview };
      return;
    }

    const fullHtml = stripCodeFences(rawHtml);
    memory.currentHtml = fullHtml;
    memory.updatedAt = Date.now();
    updateSessionHtml(memory.sessionId, fullHtml);
    metrics.generationCompleted("create", provider.id, totalMs);
    recordGeneration({
      sessionId: memory.sessionId,
      mode: "create",
      outcome: "success",
      provider: provider.id,
      model: provider.defaultModel,
      durationMs: totalMs,
      userMessage: sanitized,
      plan: currentPlan,
      templateId: template.id,
      planCached: planCachedFlag,
      injectMethod: "coder",
    });
    yield { type: "step_complete", html: fullHtml };
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    metrics.generationFailed("create", "coder_error");
    recordGeneration({
      sessionId: memory.sessionId,
      mode: "create",
      outcome: "error",
      provider: provider.id,
      model: provider.defaultModel,
      durationMs: Date.now() - startMs,
      userMessage: sanitized,
      plan: currentPlan,
      templateId: template.id,
      planCached: planCachedFlag,
      injectMethod: "coder",
      errorReason: `coder: ${(err as Error).message}`,
    });
    yield { type: "error", message: `Ошибка кодера: ${(err as Error).message}` };
  }
}
