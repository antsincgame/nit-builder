/**
 * Классификатор класса локальной модели для туннельного (BYO-GPU) пути.
 *
 * nitgen по природе BYO-GPU: пользователи подключают свои локальные модели
 * через LM Studio — от 7B на ноутбуке до 70B на мощной видеокарте. Облачных
 * моделей в системе нет принципиально (вся генерация локальная, потолок —
 * крупная локальная модель, а не GPT/Claude). Качество вывода сильно зависит
 * от класса модели, поэтому пайплайн подбирает под неё режим генерации,
 * бюджеты токенов и интенсивность «обвязки» (harness).
 *
 * Класс определяется в два этапа:
 *   1. Априорно — по тому, что туннель сообщает в hello (имя модели → размер +
 *      квантование, размер контекста, опц. VRAM). Мгновенно, но грубо.
 *   2. Апостериорно — по фактам прошлых генераций (обрывы, скорость). Точнее,
 *      но появляется только после первой генерации. Корректирует априорную оценку
 *      вниз (если модель не справилась) — см. applyRuntimeDowngrade.
 *
 * Это фундамент: на классе строится выбор режима (skeleton/coder/artifact),
 * бюджеты токенов и набор harness-стадий.
 */

export type ModelTier = "S" | "M" | "L";

/** Порядок классов от слабого к сильному — для понижения/повышения на ступень. */
const TIER_ORDER: ModelTier[] = ["S", "M", "L"];

function downgrade(tier: ModelTier): ModelTier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.max(0, i - 1)];
}

/**
 * Оверрайды для моделей, где размерный парсинг имени врёт или размера в имени
 * нет. Проверяются ДО парсинга размера. Примеры: Mixtral 8x7B — MoE, сильнее
 * своих «7b» в имени; phi-4 — 14B, но в имени нет «14b».
 */
const KNOWN_OVERRIDES: Array<{ match: RegExp; tier: ModelTier }> = [
  { match: /mixtral[^a-z]*8x22b/i, tier: "L" },
  { match: /mixtral[^a-z]*8x7b/i, tier: "M" },
  { match: /deepseek-coder-v2-lite/i, tier: "M" },
  { match: /deepseek-coder-v2(?!-lite)/i, tier: "L" },
  { match: /deepseek-v[23]/i, tier: "L" },
  { match: /\bcodestral\b/i, tier: "M" },
  { match: /\bphi-?4\b/i, tier: "M" },
  { match: /\bphi-?3(?:\.5)?\b/i, tier: "S" },
];

/**
 * Извлекает число параметров (в миллиардах) из имени модели, если оно там есть.
 * Ловит паттерн «<число>b» (7b, 32b, 1.5b), но НЕ «4bit»/«q4» и не версии без b.
 * Работает и на полных GGUF-путях (lmstudio-community/...-32B-...-Q4_K_M.gguf).
 */
export function parseModelSizeB(modelName: string): number | undefined {
  const m = modelName.toLowerCase().match(/(\d+(?:\.\d+)?)\s*b(?![a-z0-9])/);
  return m ? parseFloat(m[1]) : undefined;
}

/**
 * Извлекает битность квантования из имени (q4_k_m → 4, Q6_K → 6, iq2_xs → 2).
 * undefined — квант не указан или fp16/full (трактуется как полное качество).
 */
export function parseQuantBits(modelName: string): number | undefined {
  const lower = modelName.toLowerCase();
  // GGUF-стиль: q4_k_m, Q6_K, iq2_xs, q4bit.
  const gguf = lower.match(/(?:^|[-_.\s])i?q(\d)(?:[_\-.]|bit|$)/);
  if (gguf) return parseInt(gguf[1], 10);
  // MLX-стиль: ...-3bit, ...-4bit (без префикса q) — частый формат на Apple Silicon (№23).
  const mlx = lower.match(/(?:^|[-_.\s])(\d)bit(?![a-z0-9])/);
  if (mlx) return parseInt(mlx[1], 10);
  return undefined;
}

/** Априорный класс только по имени: оверрайд → размер → безопасный дефолт S. */
function baseTierFromName(model: string): ModelTier {
  const lower = model.toLowerCase();
  const override = KNOWN_OVERRIDES.find((k) => k.match.test(lower));
  if (override) return override.tier;

  const sizeB = parseModelSizeB(lower);
  if (sizeB !== undefined) {
    if (sizeB >= 30) return "L";
    if (sizeB >= 12) return "M";
    return "S";
  }

  // Ни оверрайда, ни размера в имени — неизвестная модель. Безопаснее всего
  // считать её слабой и идти надёжным путём, чем переоценить и отдать мусор.
  return "S";
}

export type ModelCapabilitiesLike = {
  model: string;
  contextWindow?: number;
  gpu?: { vramMb?: number };
};

/** Априорный класс по capabilities: имя + квант + окно контекста. */
function classifyFromCapabilities(caps: ModelCapabilitiesLike): ModelTier {
  let tier = baseTierFromName(caps.model ?? "");

  // Квант Q2/Q3 — заметная деградация качества, понижаем на ступень. Q4+ — норма.
  const bits = parseQuantBits(caps.model ?? "");
  if (bits !== undefined && bits <= 3) tier = downgrade(tier);

  // Маленькое окно контекста физически не вмещает большой шаблон + artifact-промпт
  // + план — тяжёлый режим оборвётся. Ограничиваем класс.
  if (caps.contextWindow && caps.contextWindow > 0 && caps.contextWindow < 8192) {
    tier = downgrade(tier);
  }

  return tier;
}

/** Факты прошлых генераций этой модели в текущей сессии (апостериорный сигнал). */
export type RuntimeStats = {
  /** Сколько раз модель оборвалась по длине (finishReason==="length"). */
  lengthTruncations?: number;
  /** Замеренная скорость, токенов/сек (из durationMs + completionTokens). */
  tokensPerSec?: number;
  /** На последней генерации вывод оказался битым/невалидным. */
  lastOutputInvalid?: boolean;
};

/**
 * Корректирует априорный класс по факту работы. Два+ обрыва по длине или битый
 * вывод — модель не тянет текущий режим, понижаем на ступень. Это главный
 * механизм устойчивости к любой модели: априорная оценка по имени неидеальна
 * (тысячи fine-tune’ов, разные кванты), реальность решает.
 */
export function applyRuntimeDowngrade(base: ModelTier, stats: RuntimeStats): ModelTier {
  if ((stats.lengthTruncations ?? 0) >= 2 || stats.lastOutputInvalid === true) {
    return downgrade(base);
  }
  return base;
}

/**
 * Итоговый класс модели. Априорная оценка по capabilities, скорректированная
 * апостериорными фактами, если они есть.
 */
export function classifyModel(
  caps: ModelCapabilitiesLike,
  stats?: RuntimeStats,
): ModelTier {
  const base = classifyFromCapabilities(caps);
  return stats ? applyRuntimeDowngrade(base, stats) : base;
}

// ─── Профиль класса: режим + бюджет + интенсивность обвязки ─────────────────
//
// Связывает класс с поведением пайплайна. Принцип: чем слабее модель, тем
// тяжелее обвязка (декомпозиция + валидаторы компенсируют слабость модели);
// сильной модели даём one-shot bespoke artifact и не мешаем лишними проверками.

/** Режим генерации HTML, предпочтительный для класса. */
export type GenerationApproach = "skeleton" | "coder" | "artifact";

export type TierProfile = {
  tier: ModelTier;
  /** Предпочтительный режим генерации для этого класса. */
  approach: GenerationApproach;
  /** Бюджет токенов на фазу кодера/артефакта. */
  codeMaxTokens: number;
  /** Включать ли тяжёлую обвязку: декомпозиция по секциям, доп. валидация/repair. */
  heavyHarness: boolean;
};

/**
 * Профиль поведения пайплайна для класса. Без облака потолок — крупная
 * локальная модель, поэтому artifact — только для L.
 */
export function tierProfile(tier: ModelTier): TierProfile {
  switch (tier) {
    case "L":
      // Крупная модель (32B+): bespoke artifact с нуля, большой бюджет,
      // лёгкая обвязка — справляется сама.
      return { tier, approach: "artifact", codeMaxTokens: 16_000, heavyHarness: false };
    case "M":
      // Средняя (12–24B): шаблонный coder с расширенным бюджетом + тяжёлая
      // обвязка для надёжности.
      return { tier, approach: "coder", codeMaxTokens: 12_000, heavyHarness: true };
    case "S":
    default:
      // Слабая (3–9B) или неизвестная: шаблонный coder, тяжёлая обвязка.
      // Бюджет вывода поднят до 16k — на 6-8 секций монолитного лендинга 8k не
      // хватало (обрыв на хвосте). Реальный потолок ограничен n_ctx модели в
      // LM Studio: если контекст мал, надо поднять и его.
      return { tier, approach: "coder", codeMaxTokens: 16_000, heavyHarness: true };
  }
}
