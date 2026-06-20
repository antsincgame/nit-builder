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
 *   Фаза 3 (repair, опц.): buildTunnelRepairPhase — auditAdminMarkup HTML
 *                   фазы 2; при промахах админ-разметки готовит узкий
 *                   repair-промпт (зеркало repair-цикла pipelineCreate).
 *                   acceptTunnelRepair принимает результат только если
 *                   промахов стало меньше — иначе остаёмся на исходном.
 *   финализация:    finalizeTunnelHtml — stripCodeFences + post-polish.
 *
 * Всё best-effort и backward-compatible: если retrieval/few-shot недоступны
 * (в BYO-GPU серверного embeddings-провайдера может не быть), планировщик
 * работает без обогащения; если план не распарсился — synthetic plan; если
 * repair-раунд упал или ухудшил разметку — финализируется HTML фазы 2.
 */

import { PlanSchema, extractPlanJson, type Plan } from "~/lib/utils/planSchema";
import { normalizePlanForRequest } from "~/lib/services/planQuality";
import {
  buildPlannerSystemPrompt,
  CODER_SYSTEM_PROMPT,
  CUSTOM_ARTIFACT_SYSTEM_PROMPT,
  buildCoderUserMessage,
  buildCustomArtifactUserMessage,
  buildAdminRepairPrompt,
  POLISHER_SYSTEM_PROMPT,
  buildPolisherUserMessage,
} from "~/lib/config/htmlPrompts";
import { buildAgentPolishPhase } from "~/lib/services/agentPolish";
import { sanitizeUserMessage } from "~/lib/utils/promptSanitizer";
import { tierProfile, type ModelTier } from "~/lib/llm/modelTier";
import {
  applyPremiumBaseLayer,
  applySeoHead,
  applyWowLayer,
  ensureClosedHtml,
  fixBrokenImages,
  normalizeFinalHtml,
} from "~/lib/services/htmlPostPolish";
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
import { inferConfidentTemplateId } from "~/lib/services/templateKeywordSelector";
import { restoreTemplateImages } from "~/lib/services/templateImages";
import { collectImageUrls } from "~/lib/utils/imageInline";
import { pruneTemplateForPlan } from "~/lib/utils/templatePrune";
import { postPolishHtml } from "~/lib/services/htmlPostPolish";
import { auditAdminMarkup } from "~/lib/bake/auditMarkup";
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
/**
 * Бюджет токенов на polish-фазу. Модель возвращает ВЕСЬ HTML заново, поэтому
 * бюджет как у кодера; server-driven continuation добивает хвост при обрыве.
 */
export const TUNNEL_POLISH_MAX_TOKENS = TUNNEL_CODE_MAX_TOKENS;
/** Температура polish-фазы — низкая: правка точечная, без переизобретения сайта. */
export const TUNNEL_POLISH_TEMPERATURE = 0.3;

/**
 * Зажимает output-бюджет так, чтобы (промпт + выход) влезли в контекст модели.
 *
 * Сервер слал фиксированный бюджет (8000–16000) НЕЗАВИСИМО от реального окна
 * пира (capabilities.contextWindow). На модели с маленьким контекстом (оператор
 * выставил NIT_TUNNEL_CONTEXT_WINDOW=4096 под свою сборку) промпт + запрошенный
 * выход переполняли окно, и LM Studio молча срезал НАЧАЛО промпта (system +
 * план) — модель генерила «вслепую». Теперь зажимаем выход под фактический
 * контекст.
 *
 * Свойства:
 *  - contextWindow неизвестен/0 (старый клиент) → НЕ трогаем (как было).
 *  - Для рекомендованного 32k и обычного промпта — НЕ зажимает (no-op).
 *  - Зажимает только когда запрос реально не влезает; математически гарантирует
 *    prompt+output ≤ context. Обрезанный хвост добирает server-driven
 *    continuation (как при finishReason="length").
 *  - Никогда не опускает ниже FLOOR — всегда даём модели шанс что-то сгенерить.
 *
 * Оценка токенов из символов консервативна (3 симв/токен — между ASCII-кодом
 * ~4 и кириллицей ~2.5) + RESERVE на неточность и спец-токены.
 */
export function clampOutputToContext(
  contextWindow: number | undefined,
  promptChars: number,
  requestedMaxOutput: number,
): number {
  if (!contextWindow || contextWindow <= 0) return requestedMaxOutput;
  const CHARS_PER_TOKEN = 3.0;
  const RESERVE_TOKENS = 1024;
  const FLOOR_TOKENS = 768;
  const estPromptTokens = Math.ceil(promptChars / CHARS_PER_TOKEN);
  const available = contextWindow - estPromptTokens - RESERVE_TOKENS;
  if (available >= requestedMaxOutput) return requestedMaxOutput;
  return Math.max(FLOOR_TOKENS, available);
}
/** Лимит на best-effort retrieval, чтобы не подвешивать запрос если
 *  embeddings-провайдер недоступен/медленный. */
const RETRIEVAL_TIMEOUT_MS = 4000;

/**
 * Разблокирует artifact-режим (bespoke microsite с нуля) для класса L на
 * туннельном пути. Раньше CUSTOM_ARTIFACT был только на серверном HTTP-пути,
 * поэтому через туннель (BYO-GPU) дизайн с нуля был недоступен в принципе.
 * NIT_TUNNEL_ARTIFACT="0" — отключить (L пойдёт обычным шаблонным coder):
 * мгновенный откат без релиза, если bespoke на чьей-то L-модели даёт регресс.
 */
const TUNNEL_ARTIFACT_ENABLED = process.env.NIT_TUNNEL_ARTIFACT !== "0";

/**
 * Детерминированный премиум-слой (база красоты) поверх любого вывода. На него
 * сильнее всего опираются слабые модели (7-9B). NIT_TUNNEL_POLISH="0" —
 * отключить (мгновенный откат без релиза).
 */
const TUNNEL_POLISH_ENABLED = process.env.NIT_TUNNEL_POLISH !== "0";

/**
 * SEO-голова из плана (description/OG/Twitter/JSON-LD). Полезна всем — дефолт ON.
 * NIT_TUNNEL_SEO="0" — отключить.
 */
const TUNNEL_SEO_ENABLED = process.env.NIT_TUNNEL_SEO !== "0";

/**
 * Вау-слой (фирменный характер) для нейтральной ветки. Дефолт ON —
 * NIT_TUNNEL_WOW="0" отключает. Тематические пресеты не трогает. Акцент
 * сид-зависимый от бизнеса (var --wow-a) — у каждого нейтрального сайта свой
 * оттенок, не общий фиолет (№11 v4).
 */
const TUNNEL_WOW_ENABLED = process.env.NIT_TUNNEL_WOW !== "0";

/**
 * Детерминированная подстановка картинок шаблона в <img> вывода. Слабая модель
 * переписывает src на нерелевантные/битые ссылки, промпт-правило игнорит.
 * Дефолт ON; NIT_TUNNEL_RESTORE_IMAGES="0" — отключить (мгновенный откат).
 */
const TUNNEL_RESTORE_IMAGES_ENABLED = process.env.NIT_TUNNEL_RESTORE_IMAGES !== "0";

// Allowlist картинок шаблона по tpl.id (read-only). templateHtml иммутабелен в
// рантайме, а finalizeTunnelHtml зовётся на каждую финализацию (вкл. дозаправку)
// — без кэша collectImageUrls пере-парсил бы шаблон каждый раз.
const templateImageUrlCache = new Map<string, Set<string>>();

/** Нейтральные пресеты, к которым применим вау-слой (у остальных свой характер). */
function isNeutralPreset(id: StylePresetId): boolean {
  return id === "generic" || id === "clean-saas";
}

// Пул характерных, но «лёгких» пресетов для seeded-разнообразия artifact-пути,
// когда промпт стиль не задал (иначе схлопывается в generic → один и тот же вид).
// Тяжёлые пресеты (neon-cyber/tech-terminal/dark-luxe) сюда НЕ входят — остаются
// строго по явному запросу юзера. Индексация по seed детерминирована.
const SEEDED_AESTHETIC_PRESETS: StylePresetId[] = [
  "clean-saas",
  "warm-premium",
  "editorial",
  "earth-craft",
  "bold-pop",
];

function pickSeededAestheticPreset(seed: number): StylePresetId {
  return SEEDED_AESTHETIC_PRESETS[(seed >>> 0) % SEEDED_AESTHETIC_PRESETS.length]!;
}

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

export type TunnelPolishPhase = {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
};

/**
 * Строит polish-фазу для туннеля (mode="polish"): правку СУЩЕСТВУЮЩЕГО сайта по
 * запросу, без планировщика и выбора шаблона. Модель получает текущий HTML
 * (previousHtml) + правку и возвращает новый полный HTML — это одна code-фаза.
 *
 * Раньше WS-обработчик игнорировал mode/previousHtml: любой уточняющий запрос
 * («сделай шапку синей», «добавь блок цен») молча уходил как ТЗ на НОВЫЙ сайт,
 * и память о текущем сайте терялась. Теперь правки применяются к нему.
 *
 * На финализации план отсутствует → finalizeTunnelDone делает только
 * stripCodeFences (post-polish не нужен — структура уже готова). Запрос
 * пользователя санитизируется, как на HTTP-polish-пути.
 *
 * Возвращает null если previousHtml пуст — нечего полировать; вызывающий отдаёт
 * честную ошибку «сначала создай сайт» вместо молчаливой новой генерации.
 */
export function buildTunnelPolishPhase(
  previousHtml: string,
  userRequest: string,
): TunnelPolishPhase | null {
  if (!previousHtml.trim()) return null;
  const sanitized = sanitizeUserMessage(userRequest);
  return {
    system: POLISHER_SYSTEM_PROMPT,
    prompt: buildPolisherUserMessage({
      currentHtml: previousHtml,
      userRequest: sanitized,
    }),
    maxOutputTokens: TUNNEL_POLISH_MAX_TOKENS,
    temperature: TUNNEL_POLISH_TEMPERATURE,
  };
}

/**
 * Эксперимент Agent polish для туннеля: conversational prompt + выше temperature.
 * Включается только когда клиент шлёт agentPolish=true.
 */
export function buildTunnelAgentPolishPhase(
  previousHtml: string,
  userRequest: string,
): TunnelPolishPhase | null {
  if (!previousHtml.trim()) return null;
  const sanitized = sanitizeUserMessage(userRequest);
  return buildAgentPolishPhase(previousHtml, sanitized, TUNNEL_POLISH_MAX_TOKENS);
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
  tier: ModelTier = "S",
  variantSeed?: number,
): PlanResolution {
  const template = getTemplateById(plan.suggested_template_id) ?? getFallbackTemplate();
  const presetId: StylePresetId =
    stylePresetIdInput ?? inferStylePresetId(sanitizedMessage, plan);

  // Seeded-разнообразие artifact-пути: если стиль не задан ни юзером, ни планом
  // (схлопнулся в generic) — выбираем характерный пресет по variantSeed (по
  // умолчанию случайный на каждую генерацию). Применяется ТОЛЬКО к artifact-ветке
  // ниже; skeleton/coder работают по оригинальному presetId, поэтому быстрый
  // skeleton-путь слабых моделей не демотируется, а слабая модель не получает
  // тяжёлый стилевой addon.
  const artifactPresetId: StylePresetId =
    !stylePresetIdInput && presetId === "generic"
      ? pickSeededAestheticPreset(variantSeed ?? Math.floor(Math.random() * 0x100000000))
      : presetId;

  // Artifact-режим для сильных моделей (класс L): bespoke microsite с нуля,
  // БЕЗ адаптации шаблона. Сильная локальная модель тянет award-уровень, и
  // шаблонная адаптация ей только мешает. tierProfile решает, что L → artifact;
  // S/M остаются на шаблонном coder/skeleton — слабая модель не вытянет 900
  // строк bespoke (получился бы обрыв/каша). Гейтится env-флагом для отката.
  if (tierProfile(tier).approach === "artifact" && TUNNEL_ARTIFACT_ENABLED) {
    return {
      kind: "coder",
      system: injectStylePreset(CUSTOM_ARTIFACT_SYSTEM_PROMPT, artifactPresetId),
      prompt: buildCustomArtifactUserMessage({ userMessage: sanitizedMessage, plan }),
      templateId: template.id,
      templateName: template.name,
      presetId: artifactPresetId,
    };
  }

  // Skeleton-injection пробуем только для generic-пресета (как в pipelineCreate)
  // и только для русских планов: шаблоны lang="ru", без Кодера их статичные
  // тексты не переводятся. Стилевые пресеты требуют генерации кодером.
  // Admin-сайты (зоны/коллекции) тоже всегда через Coder — зеркало guard'а
  // pipelineCreate: статичные шаблоны не несут data-edit/data-collection
  // разметку, skeleton отдал бы юзеру «админку» без единой редактируемой зоны.
  const adminNeedsCoder =
    plan.needs_admin === true &&
    ((plan.editable_zones?.length ?? 0) > 0 ||
      (plan.collections?.length ?? 0) > 0);
  // Нишевый шаблон уже полностью свёрстан (barbershop.html: тёмный, фон-фото,
  // шрифты, амбер). Для него skeleton (подстановка текстов в готовый дизайн)
  // даёт шаблон 1:1, а coder/пресет перекрашивает и упрощает (барбершоп выходил
  // белым/плоским). Уверенную нишу гоним через skeleton даже при не-generic
  // пресете — но только если юзер НЕ задал стиль явно (UI-пресет или стилевое
  // слово в промпте): иначе уважаем запрос и идём в coder с этим пресетом.
  const nicheId = inferConfidentTemplateId(sanitizedMessage);
  const preferTemplateSkeleton =
    nicheId !== null &&
    template.id === nicheId &&
    !stylePresetIdInput &&
    inferStylePresetId(sanitizedMessage) === "generic";
  if (
    (presetId === "generic" || preferTemplateSkeleton) &&
    // by: шаблоны lang="ru", но BY-аудитория читает их нормально — допускаем (№14 v4)
    (plan.language === "ru" || plan.language === "by") &&
    !adminNeedsCoder
  ) {
    const cleanTemplateHtml = loadTemplateHtml(template.id);
    // Seeded-акцент skeleton-вывода: на одинаковый промпт — разный акцент
    // (на мигрированных шаблонах). variantSeed по умолчанию случайный на генерацию.
    const injection = injectPlanIntoTemplate(cleanTemplateHtml, {
      ...plan,
      variantSeed: variantSeed ?? plan.variantSeed ?? Math.floor(Math.random() * 0x100000000),
    });
    if (injection.ok && htmlContainsPrimaryCta(injection.html, plan)) {
      // Skeleton — самый частый путь слабых моделей. post-polish ему не нужен
      // (шаблон уже свёрстан), но SEO-голова (description/OG/JSON-LD) на нём
      // терялась: applySeoHead вызывался только в finalizeTunnelHtml (coder).
      // Он идемпотентен и дёшев — ставим её и здесь, под тем же флагом (№7 v4).
      const skeletonHtml = stripCodeFences(injection.html);
      return {
        kind: "skeleton",
        html: TUNNEL_SEO_ENABLED ? applySeoHead(skeletonHtml, plan) : skeletonHtml,
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

// ─── Фаза 3 (repair, опц.): админ-разметка ──────────────────────────
//
// Зеркало repairAdminMarkupIfNeeded из pipelineCreate, разложенное на
// «приготовить промпт» / «принять результат» — LLM-вызов между ними делает
// оркестратор (tunnelRegistry) через тот же туннельный generate, что и
// остальные фазы. Один раунд максимум, best-effort.

/** Бюджет токенов repair-фазы (полный HTML на выходе, как у кодера). */
export const TUNNEL_REPAIR_MAX_TOKENS = 16_000;
/** Температура repair-фазы: точечная правка, не творчество. */
export const TUNNEL_REPAIR_TEMPERATURE = 0.2;

export type TunnelRepairPhase = {
  system: string;
  prompt: string;
  /** Сколько промахов нашёл аудит — для логов оркестратора. */
  missingBefore: number;
};

function adminDeclarations(plan: Plan) {
  const zones = plan.needs_admin ? plan.editable_zones ?? [] : [];
  const collections = plan.needs_admin ? plan.collections ?? [] : [];
  return { zones, collections };
}

function countMissing(audit: ReturnType<typeof auditAdminMarkup>): number {
  return (
    audit.missingZones.length +
    audit.missingCollections.length +
    audit.missingFields.length
  );
}

/**
 * LLM-repair админ-разметки на туннеле ВЫКЛЮЧЕН по умолчанию. Это был ВТОРОЙ
 * полный проход генерации (бюджет 16k токенов) на локальной модели юзера:
 * после готового сайта пользователь видел долгое «Пишу код» и считал, что
 * всё зависло (на слабом/среднем железе второй проход — минуты). Разметку
 * теперь ставит Кодер за один проход по zones/collections-hint coder-промпта.
 * NIT_TUNNEL_ADMIN_REPAIR="1" — вернуть repair (например, на быстром пути).
 */
const TUNNEL_ADMIN_REPAIR_ENABLED = process.env.NIT_TUNNEL_ADMIN_REPAIR === "1";

/**
 * Решает, нужна ли repair-фаза для HTML фазы кодера. null — разметка полная
 * (план без админки, либо repair выключен флагом), фаза пропускается. Иначе —
 * готовый туннельный generate-промпт со списком промахов.
 */
export function buildTunnelRepairPhase(
  rawHtml: string,
  plan: Plan,
): TunnelRepairPhase | null {
  if (!TUNNEL_ADMIN_REPAIR_ENABLED) return null;
  const { zones, collections } = adminDeclarations(plan);
  if (zones.length === 0 && collections.length === 0) return null;

  const cleaned = stripCodeFences(rawHtml);
  const audit = auditAdminMarkup(cleaned, zones, collections);
  if (audit.ok) return null;

  const missingBefore = countMissing(audit);
  logger.warn(
    SCOPE,
    `Admin markup incomplete (${missingBefore}): zones=[${audit.missingZones.map((z) => z.id).join(",")}] collections=[${audit.missingCollections.map((c) => c.id).join(",")}] fields=[${audit.missingFields.map((m) => `${m.collection.id}.${m.field.id}`).join(",")}] — tunnel repair round`,
  );

  return {
    system:
      "Ты — HTML-Кодер. Точечно дополняешь готовый HTML недостающими атрибутами админ-разметки, ничего больше не меняя. Возвращаешь ТОЛЬКО полный HTML от <!DOCTYPE html> до </html>.",
    prompt: buildAdminRepairPrompt({
      currentHtml: cleaned,
      missingZones: audit.missingZones,
      missingCollections: audit.missingCollections,
      missingFields: audit.missingFields,
    }),
    missingBefore,
  };
}

/**
 * Принимает результат repair-фазы: возвращает починенный HTML только если
 * промахов разметки стало меньше, чем в исходном. Иначе — исходный HTML
 * фазы кодера. Не бросает.
 *
 * Обрыв по токенам здесь НЕ детектируется намеренно: stripCodeFences
 * дописывает </html> отсутствующим хвостам (это норма — стоп-секвенции
 * съедают закрывающий тег у честных ответов), а repairTruncatedHtml
 * дочинивает теги, поэтому текстовый чек «кончается ли </html>» всегда
 * проходил бы. Честный сигнал обрыва — finishReason==="length" из
 * done-события туннеля; его проверяет оркестратор (tunnelRegistry) ДО
 * вызова этой функции и откатывается без неё.
 */
export function acceptTunnelRepair(
  originalRawHtml: string,
  repairedRawHtml: string,
  plan: Plan,
): string {
  const { zones, collections } = adminDeclarations(plan);
  if (zones.length === 0 && collections.length === 0) return originalRawHtml;

  const repaired = stripCodeFences(repairedRawHtml);
  const original = stripCodeFences(originalRawHtml);
  const before = countMissing(auditAdminMarkup(original, zones, collections));
  const after = countMissing(auditAdminMarkup(repaired, zones, collections));
  if (after < before) {
    logger.info(
      SCOPE,
      `Tunnel repair: ${before} промахов → ${after}${after === 0 ? " (разметка полная)" : ""}`,
    );
    return repaired;
  }
  logger.warn(
    SCOPE,
    `Tunnel repair не улучшил разметку (${before} → ${after}) — оставляем исходный HTML`,
  );
  return originalRawHtml;
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
  // Сначала лечим оборванный вывод модели — иначе вставки ниже приклеятся в конец
  // сломанного DOM и станут видимым текстом.
  const cleaned = normalizeFinalHtml(ensureClosedHtml(stripCodeFences(rawHtml)));
  let html = postPolishHtml({ html: cleaned, presetId, plan }).html;
  // Детерминированно возвращаем курированные картинки шаблона: слабая модель
  // переписывает <img src> на нерелевантные/битые ссылки (барбершопу — лес),
  // а промпт-правило игнорит. Ниша-агностично; no-op если у шаблона нет <img>.
  // Курированные картинки шаблона в allowlist: restoreTemplateImages вернёт их
  // в <img>, а fixBrokenImages ниже не должен перетереть их (и CSS-фоны) на
  // случайный picsum (№3). Allowlist считаем из шаблона.
  const tpl = getTemplateById(plan.suggested_template_id) ?? getFallbackTemplate();
  const templateHtml = loadTemplateHtml(tpl.id);
  if (TUNNEL_RESTORE_IMAGES_ENABLED) {
    html = restoreTemplateImages(html, templateHtml).html;
  }
  // Битые Unsplash-картинки (галлюцинации модели, не из шаблона) → picsum.
  let imgAllowlist = templateImageUrlCache.get(tpl.id);
  if (!imgAllowlist) {
    imgAllowlist = new Set(collectImageUrls(templateHtml));
    templateImageUrlCache.set(tpl.id, imgAllowlist);
  }
  html = fixBrokenImages(html, imgAllowlist);
  // SEO-голова из плана (детерминированно, идемпотентно) — слабая модель её почти
  // не ставит.
  if (TUNNEL_SEO_ENABLED) html = applySeoHead(html, plan);
  // Премиум-база поверх — :where-слой нулевой специфичности, только заполняет
  // пустоту, не ломая то, что задала модель. Главный вклад в красоту на 7-9B.
  if (TUNNEL_POLISH_ENABLED) html = applyPremiumBaseLayer(html);
  // Вау-слой — фирменный характер, только для нейтральной ветки (тематические
  // пресеты имеют свой и вызваны юзером явно).
  if (TUNNEL_WOW_ENABLED && isNeutralPreset(presetId)) html = applyWowLayer(html, plan);
  return html;
}
