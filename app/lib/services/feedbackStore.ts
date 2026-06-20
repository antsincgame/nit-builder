/**
 * Feedback loop: append-only JSONL с результатами каждой генерации.
 *
 * Зачем: накапливаем корпус (query → plan → template → success/ms) для:
 * - анализа какие запросы чаще всего ломают pipeline (какие бизнесы не покрыты)
 * - будущего LoRA fine-tune Qwen2.5-Coder (нужно 500-1000 пар)
 * - few-shot example bank (лучшие генерации как exemplars для Planner)
 * - benchmarking старыей версии промптов против новых
 *
 * Требования: NIT_FEEDBACK_ENABLED=1 + (опц.) NIT_FEEDBACK_LOG_PATH.
 * По умолчанию отключён чтобы не мусорить в локальной разработке.
 *
 * Non-blocking: все записи fire-and-forget с try/catch, ошибки лишь логгируются.
 * Сбой записи фидбэка НЕ должен ломать основной флоу пользователя.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { Plan } from "~/lib/utils/planSchema";
import { logger } from "~/lib/utils/logger";

const SCOPE = "feedbackStore";
const DEFAULT_PATH = "/tmp/nit-feedback.jsonl";
const MAX_MESSAGE_LEN = 500;

// Ротация append-only лога: раньше файл рос без границ (на проде с persistent
// volume забивал диск, а readRecentFeedback/countFeedback читали его целиком в
// память). Каждые COMPACT_EVERY записей проверяем размер; если перерос
// MAX_LOG_BYTES — оставляем последние COMPACT_KEEP_LINES строк. Компакция идёт
// внутри writeQueue (сериализовано) → без гонок; recency сохраняется для ingest.
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const COMPACT_KEEP_LINES = 5000;
const COMPACT_EVERY = 200;
let writesSinceCompactCheck = 0;

export type FeedbackRecordMode = "create" | "polish";
export type FeedbackRecordOutcome = "success" | "error";
export type FeedbackInjectMethod = "skeleton" | "coder";
/**
 * Способ выполнения polish-генерации (Tier 3.5):
 * - 'css'     — applyCssPatch, generateObject CssPatchSchema (~200-500 prompt токенов)
 * - 'section' — section-only rewrite, узкий контекст одной <section> (~400 prompt)
 * - 'full'    — full HTML rewrite, передан весь currentHtml (~1500-3000 prompt)
 */
export type FeedbackPolishScope = "css" | "section" | "full";

export type FeedbackRecord = {
  /** ISO-8601 timestamp. */
  ts: string;
  sessionId: string;
  mode: FeedbackRecordMode;
  outcome: FeedbackRecordOutcome;
  provider: string;
  model: string;
  durationMs: number;
  /** Усечённое до 500 chars сообщение пользователя (уже прошло через sanitizer). */
  userMessage: string;
  /** Полный plan (уже валидный PlanSchema). */
  plan?: Plan;
  templateId?: string;
  /** Для polish-режима. */
  polishIntent?: "css_patch" | "full_rewrite";
  polishTargetSection?: string;
  /** Какой scope контекста реально использовался в polish (не путать с polishIntent — тот про намерение, этот про факт). */
  polishScope?: FeedbackPolishScope;
  cssPatchRuleCount?: number;
  /** Только при outcome="error". */
  errorReason?: string;
  /**
   * Произвольный тег для НЕ-ошибочных исходов (outcome="success"): например
   * "truncated", "php-sqlite-artifact", "tunnel-continued". Раньше для этого
   * переиспользовался errorReason при success — это загрязняло аналитику
   * ошибок (success-записи попадали в выборку по errorReason). Теперь errorReason
   * строго про ошибки, note — про пометки успешных генераций.
   */
  note?: string;
  /** План был возвращён из кеша. */
  planCached?: boolean;
  /**
   * Как HTML был сгенерирован (Tier 3): 'skeleton' — server-side direct injection без Coder LLM,
   * 'coder' — традиционный streaming через LLM. Нужно для анализа распределения и фильтрования
   * в feedback ingest (skeleton-records НЕ инжестятся в plan_example RAG — их plan идёт не от лучшего
   * Coder, а прямо от Planner; добавлять их в корпус безопасно но не даёт новой информации).
   */
  injectMethod?: FeedbackInjectMethod;
  /** Только для injectMethod='skeleton': доля заполненных слотов 0..1. */
  skeletonFillRatio?: number;
};

function isEnabled(): boolean {
  return process.env.NIT_FEEDBACK_ENABLED === "1";
}

function getLogPath(): string {
  return process.env.NIT_FEEDBACK_LOG_PATH ?? DEFAULT_PATH;
}

let ensureDirPromise: Promise<void> | null = null;

async function ensureDir(filePath: string): Promise<void> {
  if (!ensureDirPromise) {
    ensureDirPromise = (async () => {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    })();
  }
  try {
    await ensureDirPromise;
  } catch (err) {
    ensureDirPromise = null;
    throw err;
  }
}

/**
 * Записать запись в JSONL. Fire-and-forget: не ждём промис, ловим ошибки.
 *
 * Сериализуем запись через write-queue (chained promise). Без queue 15
 * параллельных recordGeneration → 15 параллельных fs.appendFile к одному
 * файлу. На macOS/Linux POSIX-семантика "atomic append" в большинстве
 * случаев сохраняет порядок, но не гарантирует — отсюда был flaky тест
 * `readRecentFeedback ограничивает последними N` (s10..s14 могли
 * перемешаться). Queue делает порядок детерминированным и не блокирует
 * вызывающий код.
 */
let writeQueue: Promise<void> = Promise.resolve();

export function recordGeneration(record: Omit<FeedbackRecord, "ts">): void {
  if (!isEnabled()) return;

  const full: FeedbackRecord = {
    ts: new Date().toISOString(),
    ...record,
    userMessage: record.userMessage.slice(0, MAX_MESSAGE_LEN),
  };

  // Каждая новая запись цепляется в хвост очереди и игнорирует ошибки
  // предыдущих (чтобы один сбой не блокировал последующие записи).
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() => writeRecord(full))
    .catch((err: Error) => {
      logger.warn(SCOPE, `Feedback write failed: ${err.message}`);
    });
}

/**
 * Дождаться завершения всех pending записей. Только для тестов и
 * graceful shutdown — production-код не должен звать (recordGeneration
 * fire-and-forget by design).
 *
 * @internal
 */
export function _flushPendingWrites(): Promise<void> {
  return writeQueue.catch(() => undefined);
}

async function writeRecord(record: FeedbackRecord): Promise<void> {
  const logPath = getLogPath();
  await ensureDir(logPath);
  const line = `${JSON.stringify(record)}\n`;
  await fs.appendFile(logPath, line, "utf8");
  await compactIfNeeded(logPath);
}

/**
 * Периодическая компакция лога до последних COMPACT_KEEP_LINES строк, если файл
 * перерос MAX_LOG_BYTES. Best-effort: любая ошибка глотается (фидбэк не критичен).
 * Вызывается из writeRecord, т.е. внутри сериализованного writeQueue.
 */
async function compactIfNeeded(logPath: string): Promise<void> {
  if (++writesSinceCompactCheck < COMPACT_EVERY) return;
  writesSinceCompactCheck = 0;
  try {
    const { size } = await fs.stat(logPath);
    if (size <= MAX_LOG_BYTES) return;
    const content = await fs.readFile(logPath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    if (lines.length <= COMPACT_KEEP_LINES) return;
    const kept = `${lines.slice(-COMPACT_KEEP_LINES).join("\n")}\n`;
    await fs.writeFile(logPath, kept, "utf8");
    logger.info(SCOPE, `Compacted feedback log: ${lines.length} → ${COMPACT_KEEP_LINES} lines`);
  } catch {
    // best-effort
  }
}

/**
 * Прочитать последние N записей. Для анализа/админки. Для очень больших логов
 * (десятки MB) лучше использовать streaming reader — но пока этого достаточно.
 */
export async function readRecentFeedback(limit = 100): Promise<FeedbackRecord[]> {
  const logPath = getLogPath();
  try {
    const content = await fs.readFile(logPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const tail = lines.slice(-limit);
    const records: FeedbackRecord[] = [];
    for (const line of tail) {
      try {
        records.push(JSON.parse(line) as FeedbackRecord);
      } catch {
        // битая строка — пропускаем
      }
    }
    return records;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * Записи СТРОГО ПОСЛЕ afterTs в порядке файла (старые → новые), не более limit.
 *
 * Для ingest: читать ХВОСТ (readRecentFeedback) нельзя — при >limit новых
 * записей между прогонами середина терялась навсегда (курсор прыгал на максимум,
 * а прочитан был только хвост). Здесь идём ВПЕРЁД от курсора, поэтому следующий
 * прогон продолжит с того места, где остановились.
 */
export async function readFeedbackForIngest(
  afterTs: string | null,
  limit: number,
): Promise<FeedbackRecord[]> {
  const logPath = getLogPath();
  try {
    const content = await fs.readFile(logPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const out: FeedbackRecord[] = [];
    for (const line of lines) {
      let rec: FeedbackRecord;
      try {
        rec = JSON.parse(line) as FeedbackRecord;
      } catch {
        continue; // битая строка
      }
      if (afterTs && rec.ts <= afterTs) continue;
      out.push(rec);
      if (out.length >= limit) break;
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * Кол-во записей в логе (быстрее чем readRecentFeedback для простой проверки объёма).
 */
export async function countFeedback(): Promise<number> {
  const logPath = getLogPath();
  try {
    const content = await fs.readFile(logPath, "utf8");
    return content.trim() === "" ? 0 : content.trim().split("\n").length;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
}

/** Для тестов: сброс состояния между it(). */
export function _resetFeedbackState(): void {
  ensureDirPromise = null;
  writeQueue = Promise.resolve();
}
