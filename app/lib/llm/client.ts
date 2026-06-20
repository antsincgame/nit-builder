import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * NITGEN runs LOCAL LLMs only.
 *
 * Раньше здесь были fallback'и на Groq и OpenRouter. Они удалены — продукт
 * позиционируется как peer-to-peer, "ваш GPU, ваш inference, без облака".
 * Кодовая поддержка облачных провайдеров противоречит этому позиционированию
 * и создаёт риск что юзерский промпт случайно уйдёт во внешнее API.
 *
 * Единственный вариант — LM Studio (или совместимый OpenAI-API сервер) на
 * локальной машине пользователя. Запросы идут через WebSocket tunnel
 * (см. tunnelRegistry.server.ts) — браузер юзера → наш сервер → его
 * desktop-клиент → его LM Studio.
 */

export type ProviderId = "lmstudio";

export type ProviderConfig = {
  id: ProviderId;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  contextWindow: number;
};

const DEFAULT_LMSTUDIO_BASE_URL = "http://localhost:1234";

// ─── Legacy env detection ──────────────────────────────────
//
// Если юзер мигрирует с v1 и оставил GROQ_API_KEY / OPENROUTER_API_KEY в .env,
// в v2 эти переменные не делают НИЧЕГО — провайдеры удалены. Без явного
// warning юзер думает что cloud-fallback работает, а на самом деле каждый
// запрос ловит ECONNREFUSED от LM Studio (если тот не запущен) или просто
// тихо игнорирует ключ. Один раз на процесс пишем чёткое сообщение в stderr.
//
// stderr, а не logger.warn — logger ещё не инициализирован на этом этапе
// загрузки модулей; console.warn гарантированно работает на cold start.

let legacyWarningEmitted = false;
function warnAboutLegacyProvidersOnce(): void {
  if (legacyWarningEmitted) return;
  legacyWarningEmitted = true;

  const legacy: string[] = [];
  if (process.env.GROQ_API_KEY?.trim()) legacy.push("GROQ_API_KEY");
  if (process.env.GROQ_MODEL?.trim()) legacy.push("GROQ_MODEL");
  if (process.env.OPENROUTER_API_KEY?.trim()) legacy.push("OPENROUTER_API_KEY");
  if (process.env.OPENROUTER_MODEL?.trim()) legacy.push("OPENROUTER_MODEL");

  if (legacy.length === 0) return;

  console.warn(
    `[nit-llm] legacy v1 env detected and IGNORED: ${legacy.join(", ")}.\n` +
    `[nit-llm] v2 supports only LM Studio (peer-to-peer). Cloud providers were removed.\n` +
    `[nit-llm] See README.md → "Architecture (v2)" for the rationale. Remove these vars from .env to silence this warning.`,
  );
}
warnAboutLegacyProvidersOnce();

export function normalizeLmStudioBaseUrl(
  rawBaseUrl: string | undefined = process.env.LMSTUDIO_BASE_URL,
): string {
  const baseUrl = (rawBaseUrl?.trim() || DEFAULT_LMSTUDIO_BASE_URL).replace(/\/+$/, "");
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

const DEFAULT_CONTEXT_WINDOW = 32_000;

/**
 * Длина контекста модели. Раньше была хардкодом 32_000 — но на 8GB GPU LM Studio
 * по умолчанию грузит Qwen с 4096 (YaRN до 32k включают вручную). Бюджет
 * (calcMaxOutput / checkContextBudget) считал запас от 32k → молча переполнял
 * реальный контекст и обрезал вход, ломая генерацию. Теперь берём из env:
 * оператор выставляет фактическую длину, загруженную в LM Studio, без передеплоя.
 *
 * NB: глубокий фикс (авто-определение длины через desktop-клиент туннеля) —
 * отдельный батч (нужен протокол shared/ + tunnel). Здесь — управляемый дефолт.
 */
export function resolveContextWindow(): number {
  const raw = process.env.LMSTUDIO_CONTEXT_WINDOW?.trim();
  if (!raw) return DEFAULT_CONTEXT_WINDOW;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1024 ? n : DEFAULT_CONTEXT_WINDOW;
}

export function getAvailableProviders(): ProviderConfig[] {
  return [
    {
      id: "lmstudio",
      baseUrl: normalizeLmStudioBaseUrl(),
      apiKey: "lm-studio",
      defaultModel: process.env.LMSTUDIO_MODEL ?? "qwen2.5-coder-7b-instruct",
      contextWindow: resolveContextWindow(),
    },
  ];
}

export function getPreferredProvider(
  override?: { modelName?: string },
): ProviderConfig | null {
  const all = getAvailableProviders();
  if (!all.length) return null;
  const base = all[0]!;
  return override?.modelName ? { ...base, defaultModel: override.modelName } : base;
}

export function getModel(provider: ProviderConfig): LanguageModel {
  const client = createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
  });
  return client(provider.defaultModel);
}

/** Эвристика лимита output токенов — оставляем запас для input */
export function calcMaxOutput(provider: ProviderConfig, estimatedInputChars: number): number {
  const estimatedInputTokens = Math.ceil(estimatedInputChars / 3.5);
  const available = provider.contextWindow - estimatedInputTokens - 500;
  return Math.max(2000, Math.min(16000, available));
}

/**
 * Точный расчёт max output для Coder-стадии.
 *
 * Эмпирически выход ≈ 1.3× от размера шаблона (тексты переведены/расширены,
 * структура сохранена). Хардкод 16000 раздувал бюджет на коротких шаблонах
 * и провоцировал модель "дофантазировать" лишние секции.
 */
export function calcCoderMaxOutput(
  provider: ProviderConfig,
  templateChars: number,
  planChars: number,
  systemChars: number = 2000,
): number {
  const inputChars = templateChars + planChars + systemChars;
  const inputTokens = Math.ceil(inputChars / 3.5);
  const desiredOutput = Math.ceil((templateChars * 1.3) / 3.5) + 500;
  const available = provider.contextWindow - inputTokens - 300;
  const cap = Math.min(desiredOutput, available);
  // Floor 2000 — даже на крошечных шаблонах модели нужен минимум для манёвра.
  // Ceil 16000 — выше уже бессмысленно, скорее всего модель зациклилась.
  return Math.max(2000, Math.min(16_000, cap));
}

/**
 * Проверка переполнения контекстного окна.
 * Возвращает предупреждение если input + желаемый output не помещаются.
 */
export function checkContextBudget(
  provider: ProviderConfig,
  estimatedInputChars: number,
  desiredOutputTokens: number = 8000,
): { ok: boolean; warning?: string; estimatedInputTokens: number } {
  const estimatedInputTokens = Math.ceil(estimatedInputChars / 3.5);
  const total = estimatedInputTokens + desiredOutputTokens + 500;

  if (total > provider.contextWindow) {
    return {
      ok: false,
      estimatedInputTokens,
      warning:
        `Input (${estimatedInputTokens} tok) + output (${desiredOutputTokens} tok) ` +
        `превышает контекст модели (${provider.contextWindow} tok). ` +
        `Рекомендация: включи YaRN в LM Studio (Advanced Configuration → RoPE scaling → yarn) ` +
        `или выбери модель с большим контекстом.`,
    };
  }

  // Предупреждение если занимаем >80% контекста — работает, но YaRN улучшит качество
  if (total > provider.contextWindow * 0.8) {
    return {
      ok: true,
      estimatedInputTokens,
      warning:
        `Контекст занят на ${Math.round((total / provider.contextWindow) * 100)}%. ` +
        `Для стабильности рассмотри YaRN scaling в LM Studio.`,
    };
  }

  return { ok: true, estimatedInputTokens };
}
