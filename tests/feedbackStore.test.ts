import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  recordGeneration,
  readRecentFeedback,
  readFeedbackForIngest,
  countFeedback,
  _resetFeedbackState,
  _flushPendingWrites,
} from "~/lib/services/feedbackStore";

let tmpPath: string;

// recordGeneration — fire-and-forget. После рефакторинга на write-queue
// все pending записи можно дождаться детерминированно через
// _flushPendingWrites — это устраняет flaky setTimeout(50ms) который
// раньше иногда не успевал на медленных дисках / под нагрузкой и ломал
// `readRecentFeedback ограничивает последними N` (порядок s10..s14).
async function waitForWrites(): Promise<void> {
  await _flushPendingWrites();
}

beforeEach(async () => {
  _resetFeedbackState();
  tmpPath = path.join(
    os.tmpdir(),
    `nit-feedback-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  process.env.NIT_FEEDBACK_LOG_PATH = tmpPath;
  process.env.NIT_FEEDBACK_ENABLED = "1";
});

afterEach(async () => {
  delete process.env.NIT_FEEDBACK_LOG_PATH;
  delete process.env.NIT_FEEDBACK_ENABLED;
  try {
    await fs.unlink(tmpPath);
  } catch {
    /* ok */
  }
});

describe("feedbackStore", () => {
  it("recordGeneration no-op при отключённом флаге", async () => {
    delete process.env.NIT_FEEDBACK_ENABLED;
    recordGeneration({
      sessionId: "s1",
      mode: "create",
      outcome: "success",
      provider: "lmstudio",
      model: "qwen",
      durationMs: 100,
      userMessage: "test",
    });
    await waitForWrites();
    expect(await countFeedback()).toBe(0);
  });

  it("пишет одну запись при включённом флаге", async () => {
    recordGeneration({
      sessionId: "s1",
      mode: "create",
      outcome: "success",
      provider: "lmstudio",
      model: "qwen",
      durationMs: 1234,
      userMessage: "кофейня в Минске",
      templateId: "coffee-shop",
    });
    await waitForWrites();
    expect(await countFeedback()).toBe(1);
    const records = await readRecentFeedback();
    expect(records[0]?.sessionId).toBe("s1");
    expect(records[0]?.templateId).toBe("coffee-shop");
    expect(records[0]?.durationMs).toBe(1234);
    expect(records[0]?.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("append: не затирает предыдущие записи", async () => {
    for (let i = 0; i < 3; i++) {
      recordGeneration({
        sessionId: `s${i}`,
        mode: "create",
        outcome: "success",
        provider: "lmstudio",
        model: "qwen",
        durationMs: i * 100,
        userMessage: `q${i}`,
      });
    }
    await waitForWrites();
    expect(await countFeedback()).toBe(3);
    const records = await readRecentFeedback();
    expect(records.map((r) => r.sessionId).sort()).toEqual(["s0", "s1", "s2"]);
  });

  it("усекает userMessage до 500 chars", async () => {
    const long = "а".repeat(1000);
    recordGeneration({
      sessionId: "s1",
      mode: "create",
      outcome: "success",
      provider: "lmstudio",
      model: "qwen",
      durationMs: 100,
      userMessage: long,
    });
    await waitForWrites();
    const records = await readRecentFeedback();
    expect(records[0]?.userMessage.length).toBe(500);
  });

  it("пишет error-запись с errorReason", async () => {
    recordGeneration({
      sessionId: "s1",
      mode: "polish",
      outcome: "error",
      provider: "lmstudio",
      model: "qwen",
      durationMs: 500,
      userMessage: "test",
      errorReason: "context_overflow",
    });
    await waitForWrites();
    const records = await readRecentFeedback();
    expect(records[0]?.outcome).toBe("error");
    expect(records[0]?.errorReason).toBe("context_overflow");
  });

  it("пишет polish-специфичные поля", async () => {
    recordGeneration({
      sessionId: "s1",
      mode: "polish",
      outcome: "success",
      provider: "lmstudio",
      model: "qwen",
      durationMs: 2000,
      userMessage: "сделай героя синим",
      polishIntent: "css_patch",
      polishTargetSection: "hero",
      cssPatchRuleCount: 3,
    });
    await waitForWrites();
    const records = await readRecentFeedback();
    expect(records[0]?.polishIntent).toBe("css_patch");
    expect(records[0]?.polishTargetSection).toBe("hero");
    expect(records[0]?.cssPatchRuleCount).toBe(3);
  });

  it("readRecentFeedback ограничивает последними N", async () => {
    for (let i = 0; i < 15; i++) {
      recordGeneration({
        sessionId: `s${i}`,
        mode: "create",
        outcome: "success",
        provider: "lmstudio",
        model: "qwen",
        durationMs: 100,
        userMessage: `q${i}`,
      });
    }
    // Детерминированно ждём очередь записей (раньше был хрупкий setTimeout
    // 100ms — не успевал под нагрузкой → flaky CI).
    await waitForWrites();
    const records = await readRecentFeedback(5);
    expect(records.length).toBe(5);
    // Последние 5 — это s10..s14
    expect(records[0]?.sessionId).toBe("s10");
    expect(records[4]?.sessionId).toBe("s14");
  });

  it("readRecentFeedback возвращает [] для несуществующего файла", async () => {
    process.env.NIT_FEEDBACK_LOG_PATH = "/tmp/nonexistent-nit-feedback-xxxxx.jsonl";
    expect(await readRecentFeedback()).toEqual([]);
    expect(await countFeedback()).toBe(0);
  });

  it("readFeedbackForIngest идёт вперёд от курсора, не теряя середину (№8)", async () => {
    // Пишем 6 записей напрямую — контролируем ts (append-order = хронология).
    const recs = Array.from({ length: 6 }, (_, i) => ({
      ts: `2026-01-01T00:00:0${i + 1}.000Z`,
      sessionId: "s",
      mode: "create" as const,
      outcome: "success" as const,
      provider: "lmstudio",
      model: "qwen",
      durationMs: 100,
      userMessage: `msg ${i + 1}`,
    }));
    await fs.writeFile(tmpPath, recs.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

    // limit=2 от начала → 2 СТАРЕЙШИЕ (а не хвост).
    const page1 = await readFeedbackForIngest(null, 2);
    expect(page1.map((r) => r.userMessage)).toEqual(["msg 1", "msg 2"]);

    // Курсор после msg2 → следующие 2 (середина, которую tail-чтение теряло).
    const page2 = await readFeedbackForIngest(page1[1]!.ts, 2);
    expect(page2.map((r) => r.userMessage)).toEqual(["msg 3", "msg 4"]);

    // Курсор после msg4 → последние 2.
    const page3 = await readFeedbackForIngest(page2[1]!.ts, 2);
    expect(page3.map((r) => r.userMessage)).toEqual(["msg 5", "msg 6"]);

    // После последней — пусто.
    expect(await readFeedbackForIngest(page3[1]!.ts, 2)).toEqual([]);
  });
});
