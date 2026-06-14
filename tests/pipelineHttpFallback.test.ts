import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runHttpPipeline, type HttpPipelineEvent } from "~/lib/services/pipelineHttpFallback";

/**
 * Covers HTTP fallback request body including explicit style preset selection.
 *
 * Тесты для HTTP fallback пайплайна. Mock-аем глобальный fetch чтобы
 * вернуть SSE-ответ с известными событиями, проверяем что callback
 * получает корректную последовательность и что результат накапливается.
 */

function makeSseResponse(eventLines: string[]): Response {
  // SSE формат: "data: <json>\n\n" (двойной перевод строки)
  const body = eventLines.map((line) => `data: ${line}\n\n`).join("") + "data: [DONE]\n\n";
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  // По умолчанию все тесты ставят свой mock — этот лишь маркер.
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("runHttpPipeline", () => {
  it("шлёт правильный body на /api/pipeline/simple", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSseResponse([
        JSON.stringify({ type: "session_init", sessionId: "s1" }),
        JSON.stringify({ type: "step_complete", html: "<html></html>" }),
      ]),
    );
    globalThis.fetch = fetchMock;

    await runHttpPipeline({
      mode: "create",
      projectId: "p-123",
      prompt: "site for coffee shop",
      sessionId: undefined,
      providerId: "lmstudio",
      stylePresetId: "warm-premium",
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/pipeline/simple");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      mode: "create",
      projectId: "p-123",
      message: "site for coffee shop",
      providerId: "lmstudio",
      stylePresetId: "warm-premium",
    });
  });

  it("автоматически включает php-sqlite artifact mode для backend PHP запроса", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSseResponse([
        JSON.stringify({ type: "session_init", sessionId: "s1" }),
        JSON.stringify({ type: "step_complete", html: "<html></html>" }),
      ]),
    );
    globalThis.fetch = fetchMock;

    await runHttpPipeline({
      mode: "create",
      projectId: "p-php",
      prompt: "нужен магазин на PHP SQLite с товарами, корзиной и платежками",
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.artifactMode).toBe("php-sqlite");
  });

  it("вызывает onEvent с правильной последовательностью событий", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeSseResponse([
        JSON.stringify({ type: "session_init", sessionId: "s1" }),
        JSON.stringify({ type: "plan_ready" }),
        JSON.stringify({
          type: "template_selected",
          templateId: "coffee",
          templateName: "Coffee shop",
        }),
        JSON.stringify({ type: "step_start", roleName: "Кодер" }),
        JSON.stringify({ type: "text", text: "<html>" }),
        JSON.stringify({ type: "text", text: "</html>" }),
        JSON.stringify({ type: "step_complete", html: "<html></html>" }),
      ]),
    );

    const events: HttpPipelineEvent[] = [];
    await runHttpPipeline({
      mode: "create",
      projectId: "p",
      prompt: "x",
      signal: new AbortController().signal,
      onEvent: (e) => events.push(e),
    });

    const types = events.map((e) => e.type);
    expect(types).toEqual([
      "session_init",
      "plan_ready",
      "template_selected",
      "step_start",
      "text_delta",
      "text_delta",
      "step_complete",
    ]);

    // text_delta должен накапливать в .accumulated
    const deltas = events.filter((e) => e.type === "text_delta");
    expect(deltas[0]?.type === "text_delta" && deltas[0].accumulated).toBe("<html>");
    expect(deltas[1]?.type === "text_delta" && deltas[1].accumulated).toBe("<html></html>");
  });

  it("возвращает finalHtml из step_complete + templateId/templateName", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeSseResponse([
        JSON.stringify({
          type: "template_selected",
          templateId: "coffee",
          templateName: "Coffee shop",
        }),
        JSON.stringify({ type: "text", text: "<html>" }),
        JSON.stringify({ type: "step_complete", html: "<html>final</html>" }),
      ]),
    );

    const result = await runHttpPipeline({
      mode: "create",
      projectId: "p",
      prompt: "x",
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    // finalHtml берёт html из step_complete (а не из accumulated text), потому
    // что сервер шлёт цельный финальный html в этом событии.
    expect(result.finalHtml).toBe("<html>final</html>");
    expect(result.templateId).toBe("coffee");
    expect(result.templateName).toBe("Coffee shop");
  });

  it("возвращает newSessionId из session_init", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeSseResponse([
        JSON.stringify({ type: "session_init", sessionId: "fresh-session" }),
        JSON.stringify({ type: "step_complete", html: "" }),
      ]),
    );

    const result = await runHttpPipeline({
      mode: "create",
      projectId: "p",
      prompt: "x",
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    expect(result.newSessionId).toBe("fresh-session");
  });

  it("кидает Error при error-событии от сервера + onEvent тоже получает событие", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeSseResponse([
        JSON.stringify({ type: "session_init", sessionId: "s1" }),
        JSON.stringify({ type: "error", message: "LLM upstream timeout" }),
      ]),
    );

    const events: HttpPipelineEvent[] = [];
    await expect(
      runHttpPipeline({
        mode: "polish",
        projectId: "p",
        prompt: "x",
        signal: new AbortController().signal,
        onEvent: (e) => events.push(e),
      }),
    ).rejects.toThrow("LLM upstream timeout");

    // onEvent был вызван с error до того как throw сорвал pipeline
    expect(events.some((e) => e.type === "error")).toBe(true);
  });

  it("прокидывает signal в fetch для отмены", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSseResponse([JSON.stringify({ type: "step_complete", html: "" })]),
    );
    globalThis.fetch = fetchMock;

    const ctrl = new AbortController();
    await runHttpPipeline({
      mode: "create",
      projectId: "p",
      prompt: "x",
      signal: ctrl.signal,
      onEvent: () => {},
    });

    const init = fetchMock.mock.calls[0]![1];
    expect(init.signal).toBe(ctrl.signal);
  });

  it("передаёт sessionId в body когда задан (для polish продолжает сессию)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSseResponse([JSON.stringify({ type: "step_complete", html: "" })]),
    );
    globalThis.fetch = fetchMock;

    await runHttpPipeline({
      mode: "polish",
      projectId: "p-1",
      prompt: "fix colors",
      sessionId: "existing-session-abc",
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.sessionId).toBe("existing-session-abc");
    expect(body.mode).toBe("polish");
  });

  it("передаёт previousHtml в body для polish (регидрация session memory)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSseResponse([JSON.stringify({ type: "step_complete", html: "<html>patched</html>" })]),
    );
    globalThis.fetch = fetchMock;

    await runHttpPipeline({
      mode: "polish",
      projectId: "p-1",
      prompt: "сделай шапку синей",
      sessionId: undefined,
      previousHtml: "<html><body>before</body></html>",
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    // previousHtml — источник правды для сервера, когда session memory пуста
    // (редеплой / reload / continue-from-history без sessionId).
    expect(body.previousHtml).toBe("<html><body>before</body></html>");
    expect(body.mode).toBe("polish");
  });
});

describe("runHttpPipeline — не-SSE ошибки ответа", () => {
  it("429 rate-limit → бросает Error с message из тела + retryAfter", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many requests", retryAfter: 5 }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      runHttpPipeline({
        mode: "create",
        projectId: "p-1",
        prompt: "site",
        signal: new AbortController().signal,
        onEvent: () => {},
      }),
    ).rejects.toThrow(/Too many requests\. Повтори через 5s\./);
  });

  it("400 validation → бросает Error с message из тела", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "message too long" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      runHttpPipeline({
        mode: "create",
        projectId: "p-1",
        prompt: "x",
        signal: new AbortController().signal,
        onEvent: () => {},
      }),
    ).rejects.toThrow(/message too long/);
  });

  it("5xx с не-JSON телом → generic Error с кодом статуса", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    await expect(
      runHttpPipeline({
        mode: "create",
        projectId: "p-1",
        prompt: "x",
        signal: new AbortController().signal,
        onEvent: () => {},
      }),
    ).rejects.toThrow(/HTTP 500/);
  });

  it("не дёргает onEvent при не-SSE ошибке (нет пустого результата)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onEvent = vi.fn();

    await expect(
      runHttpPipeline({
        mode: "create",
        projectId: "p-1",
        prompt: "x",
        signal: new AbortController().signal,
        onEvent,
      }),
    ).rejects.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
  });
});
