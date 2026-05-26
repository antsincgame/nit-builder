import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Unit-тесты для useGenerationFlow, включая передачу выбранного style preset.
 *
 * Стратегия: mock'аем runHttpPipeline (его SSE-логика покрыта в
 * pipelineHttpFallback.test.ts) + saveToHistory/saveRemoteSite (storage),
 * проверяем переходы state и action-flow.
 *
 * Не покрываем: WebSocket path. Реальный socket-flow — integration-уровень,
 * сложно симулировать без полного e2e. handleWsEvent покрыт на уровне
 * вызовов через сам useControlSocket в home.tsx (производит интеграция).
 */

// ─── Mocks BEFORE import ─────────────────────────────────────────

vi.mock("~/lib/services/pipelineHttpFallback", () => ({
  runHttpPipeline: vi.fn(),
}));

vi.mock("~/lib/stores/historyStore", () => ({
  saveToHistory: vi.fn(),
}));

vi.mock("~/lib/stores/remoteHistoryStore", () => ({
  saveRemoteSite: vi.fn().mockResolvedValue(undefined),
  updateRemoteSite: vi.fn().mockResolvedValue(true),
}));

vi.mock("~/lib/stores/toastStore", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("~/lib/utils/uuid", () => ({
  uuid: vi.fn(() => "test-uuid"),
}));

import {
  useGenerationFlow,
  type ControlSocketLike,
  type GenerationAuth,
} from "~/lib/hooks/useGenerationFlow";
import { runHttpPipeline } from "~/lib/services/pipelineHttpFallback";
import { saveToHistory } from "~/lib/stores/historyStore";
import { saveRemoteSite } from "~/lib/stores/remoteHistoryStore";
import { toast } from "~/lib/stores/toastStore";

const mockedRunHttp = runHttpPipeline as unknown as ReturnType<typeof vi.fn>;
const mockedSaveLocal = saveToHistory as unknown as ReturnType<typeof vi.fn>;
const mockedSaveRemote = saveRemoteSite as unknown as ReturnType<typeof vi.fn>;

function makeFakeSocket(overrides?: Partial<ControlSocketLike>): ControlSocketLike {
  return {
    status: "idle",
    tunnelStatus: "unknown",
    sendGenerate: vi.fn(() => true),
    sendAbort: vi.fn(),
    ...overrides,
  };
}

const guestAuth: GenerationAuth = { status: "unauthenticated" };
const authedAuth: GenerationAuth = {
  status: "authenticated",
  userId: "u-1",
  email: "alice@example.com",
};

// requestAnimationFrame в jsdom не вызывает callback синхронно — нужен mock
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  mockedRunHttp.mockReset();
  mockedSaveLocal.mockReset();
  mockedSaveRemote.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Initial state ───────────────────────────────────────────────────

describe("useGenerationFlow — initial state", () => {
  it("стартует в welcome mode, html пустой, loading=false", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    expect(result.current.mode).toBe("welcome");
    expect(result.current.html).toBe("");
    expect(result.current.streamingHtml).toBe("");
    expect(result.current.loading).toBe(false);
    expect(result.current.currentStep).toBe("plan");
    expect(result.current.chatMessages).toEqual([]);
    expect(result.current.lastPrompt).toBe("");
  });
});

// ─── createSite via HTTP fallback ────────────────────────────────────

describe("useGenerationFlow > createSite (HTTP fallback)", () => {
  it("guest → HTTP fallback, успех → editing mode + история", async () => {
    // Симулируем onEvent callback — runHttpPipeline шлёт template_selected
    // во время stream'а, и hook вызывает setTemplateName. Без этого симула
    // только final result доезжает до state.
    mockedRunHttp.mockImplementationOnce(async (params: {
      onEvent: (e: { type: string; templateId?: string; templateName?: string }) => void;
    }) => {
      params.onEvent({
        type: "template_selected",
        templateId: "coffee",
        templateName: "Coffee shop",
      });
      return {
        finalHtml: "<html>final</html>",
        templateId: "coffee",
        templateName: "Coffee shop",
        newSessionId: "s-1",
      };
    });

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("site for coffee");
    });

    expect(result.current.mode).toBe("editing");
    expect(result.current.html).toBe("<html>final</html>");
    expect(result.current.lastTemplateId).toBe("coffee");
    expect(result.current.templateName).toBe("Coffee shop");
    expect(result.current.lastPrompt).toBe("site for coffee");
    expect(result.current.loading).toBe(false);

    // История сохранилась локально, но НЕ в облако (юзер не залогинен)
    expect(mockedSaveLocal).toHaveBeenCalledWith({
      prompt: "site for coffee",
      html: "<html>final</html>",
      templateId: "coffee",
      templateName: "Coffee shop",
    });
    expect(mockedSaveRemote).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("guest backend prompt → HTTP fallback получает artifactMode=php-sqlite", async () => {
    mockedRunHttp.mockResolvedValueOnce({
      finalHtml: "<html>backend artifact</html>",
      templateId: "php-sqlite-app",
      templateName: "PHP + SQLite backend",
      newSessionId: "s-backend",
    });

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("магазин на PHP SQLite с товарами, корзиной и оплатой");
    });

    expect(mockedRunHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "create",
        projectId: "p-1",
        prompt: "магазин на PHP SQLite с товарами, корзиной и оплатой",
        artifactMode: "php-sqlite",
      }),
    );
    expect(result.current.lastTemplateId).toBe("php-sqlite-app");
  });

  it("guest обычный HTML prompt → HTTP fallback не форсит backend artifactMode", async () => {
    mockedRunHttp.mockResolvedValueOnce({
      finalHtml: "<html>landing</html>",
      templateId: "coffee-shop",
      templateName: "Coffee shop",
      newSessionId: "s-html",
    });

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("сделай красивый лендинг для кофейни");
    });

    expect(mockedRunHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "сделай красивый лендинг для кофейни",
        artifactMode: undefined,
      }),
    );
  });

  it("guest с выбранным style preset → HTTP fallback получает stylePresetId", async () => {
    mockedRunHttp.mockResolvedValueOnce({
      finalHtml: "<html>styled</html>",
      templateId: "saas-landing",
      templateName: "SaaS",
      newSessionId: "s-style",
    });

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("warm premium SaaS", { stylePresetId: "warm-premium" });
    });

    expect(mockedRunHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "warm premium SaaS",
        stylePresetId: "warm-premium",
      }),
    );
  });

  it("authed → HTTP fallback (если socket не authed) → также saveRemoteSite", async () => {
    mockedRunHttp.mockResolvedValueOnce({
      finalHtml: "<html>x</html>",
      templateId: "tpl",
      templateName: "Tpl",
      newSessionId: "s-2",
    });

    const socket = makeFakeSocket({ status: "idle", tunnelStatus: "offline" });
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("test");
    });

    expect(result.current.mode).toBe("editing");
    expect(mockedSaveLocal).toHaveBeenCalled();
    expect(mockedSaveRemote).toHaveBeenCalledWith({
      prompt: "test",
      html: "<html>x</html>",
      templateId: "tpl",
      templateName: "Tpl",
    });
  });

  it("HTTP fallback — error → возврат в welcome + toast.error", async () => {
    mockedRunHttp.mockRejectedValueOnce(new Error("LLM down"));

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("test");
    });

    expect(result.current.mode).toBe("welcome");
    expect(result.current.loading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("LLM down"));
    expect(mockedSaveLocal).not.toHaveBeenCalled();
  });

  it("HTTP fallback — AbortError не показывает toast.error", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    mockedRunHttp.mockRejectedValueOnce(abortErr);

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("test");
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("welcome");
  });

  it("во время generation: mode='generating', loading=true, chat seeded", async () => {
    let resolveRun: (v: unknown) => void;
    mockedRunHttp.mockReturnValueOnce(
      new Promise((r) => {
        resolveRun = r;
      }),
    );

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    let promise: Promise<void>;
    act(() => {
      promise = result.current.createSite("coffee shop site");
    });

    // Synchronous setState'ы должны успеть прокинуться
    expect(result.current.mode).toBe("generating");
    expect(result.current.loading).toBe(true);
    expect(result.current.chatMessages).toEqual([
      { role: "user", text: "coffee shop site" },
    ]);

    // Завершаем generation
    await act(async () => {
      resolveRun!({
        finalHtml: "<html></html>",
        templateId: "x",
        templateName: "X",
      });
      await promise!;
    });

    expect(result.current.mode).toBe("editing");
    expect(result.current.loading).toBe(false);
  });
});

// ─── createSite via WebSocket tunnel ─────────────────────────────────

describe("useGenerationFlow > createSite (WebSocket)", () => {
  it("authed + tunnel online → шлёт через socket.sendGenerate", async () => {
    const sendGenerate = vi.fn(() => true);
    const socket = makeFakeSocket({
      status: "authed",
      tunnelStatus: "online",
      sendGenerate,
    });

    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("ws test");
    });

    expect(sendGenerate).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^req-/),
      mode: "create",
      prompt: "ws test",
      artifactMode: undefined,
    });
    // HTTP fallback НЕ должен использоваться
    expect(mockedRunHttp).not.toHaveBeenCalled();
    // Stay in generating mode — finished only when WS event "generate_done"
    expect(result.current.mode).toBe("generating");
    expect(result.current.loading).toBe(true);
  });

  it("authed + tunnel online backend prompt → sendGenerate получает artifactMode=php-sqlite", async () => {
    const sendGenerate = vi.fn(() => true);
    const socket = makeFakeSocket({
      status: "authed",
      tunnelStatus: "online",
      sendGenerate,
    });

    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("backend на PHP MySQL: товары заказы админка оплаты");
    });

    expect(sendGenerate).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^req-/),
      mode: "create",
      prompt: "backend на PHP MySQL: товары заказы админка оплаты",
      artifactMode: "php-sqlite",
    });
    expect(mockedRunHttp).not.toHaveBeenCalled();
  });

  it("authed + tunnel online с выбранным style preset → sendGenerate получает stylePresetId", async () => {
    const sendGenerate = vi.fn(() => true);
    const socket = makeFakeSocket({
      status: "authed",
      tunnelStatus: "online",
      sendGenerate,
    });

    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("светлый Apple-style лендинг", { stylePresetId: "clean-saas" });
    });

    expect(sendGenerate).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^req-/),
      mode: "create",
      prompt: "светлый Apple-style лендинг",
      artifactMode: undefined,
      stylePresetId: "clean-saas",
    });
    expect(mockedRunHttp).not.toHaveBeenCalled();
  });

  it("если sendGenerate возвращает false → fail-fast в welcome", async () => {
    const socket = makeFakeSocket({
      status: "authed",
      tunnelStatus: "online",
      sendGenerate: vi.fn(() => false),
    });

    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("ws fail");
    });

    expect(result.current.mode).toBe("welcome");
    expect(result.current.loading).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});

// ─── handleWsEvent ───────────────────────────────────────────────────

describe("useGenerationFlow > handleWsEvent", () => {
  it("generate_done → editing mode + assistant message + saveToHistory", async () => {
    const socket = makeFakeSocket({ status: "authed", tunnelStatus: "online" });
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    // Сначала запустим createSite чтобы установить lastPrompt (сохраняется
    // в history)
    await act(async () => {
      await result.current.createSite("test prompt");
    });

    act(() => {
      result.current.handleWsEvent({
        type: "generate_done",
        requestId: "req-1",
        html: "<html>ws</html>",
        templateId: "barber",
        templateName: "Barbershop",
        durationMs: 12_345,
      });
    });

    expect(result.current.html).toBe("<html>ws</html>");
    expect(result.current.mode).toBe("editing");
    expect(result.current.loading).toBe(false);
    expect(result.current.currentStep).toBe("done");
    expect(result.current.chatMessages.at(-1)?.role).toBe("assistant");
    expect(result.current.chatMessages.at(-1)?.text).toContain("Barbershop");

    // saveToHistory должен получить именно тот prompt что юзер вводил
    expect(mockedSaveLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "test prompt",
        html: "<html>ws</html>",
        templateId: "barber",
      }),
    );
  });

  it("generate_step → обновляет currentStep + templateName", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    act(() => {
      result.current.handleWsEvent({
        type: "generate_step",
        requestId: "r",
        step: "template",
        templateId: "tutor",
        templateName: "Tutor",
      });
    });
    expect(result.current.currentStep).toBe("template");
    expect(result.current.templateName).toBe("Tutor");
    expect(result.current.lastTemplateId).toBe("tutor");

    act(() => {
      result.current.handleWsEvent({
        type: "generate_step",
        requestId: "r",
        step: "code",
      });
    });
    expect(result.current.currentStep).toBe("code");
  });

  it("generate_error с NO_TUNNEL → дружелюбное сообщение + welcome (если html пустой)", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    act(() => {
      result.current.handleWsEvent({
        type: "generate_error",
        requestId: "r",
        error: "raw error",
        code: "NO_TUNNEL",
      });
    });

    expect(result.current.mode).toBe("welcome");
    expect(result.current.chatMessages.at(-1)?.text).toMatch(/туннель не подключён/i);
    expect(toast.error).toHaveBeenCalled();
  });

  it("generate_error не сбрасывает в welcome если html уже сгенерирован", async () => {
    mockedRunHttp.mockResolvedValueOnce({
      finalHtml: "<html>existing</html>",
      templateId: "x",
      templateName: "X",
      newSessionId: undefined,
    });

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("first");
    });

    expect(result.current.mode).toBe("editing");
    expect(result.current.html).toBe("<html>existing</html>");

    // Симулируем error на новый WS-полишь — должны остаться в editing
    act(() => {
      result.current.handleWsEvent({
        type: "generate_error",
        requestId: "r",
        error: "polish failed",
      });
    });

    // Stay in editing (html уже есть)
    expect(result.current.mode).toBe("editing");
  });
});

// ─── reset / loadFromHistory / cancelGeneration ──────────────────────

describe("useGenerationFlow > misc actions", () => {
  it("reset → welcome + чистый state", async () => {
    mockedRunHttp.mockResolvedValueOnce({
      finalHtml: "<html></html>",
      templateId: "x",
      templateName: "X",
      newSessionId: undefined,
    });

    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await result.current.createSite("test");
    });
    expect(result.current.mode).toBe("editing");

    act(() => result.current.reset());

    expect(result.current.mode).toBe("welcome");
    expect(result.current.html).toBe("");
    expect(result.current.streamingHtml).toBe("");
    expect(result.current.chatMessages).toEqual([]);
    expect(result.current.templateName).toBe("");
    expect(result.current.currentStep).toBe("plan");
  });

  it("loadFromHistory → editing с загруженным контентом", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    act(() =>
      result.current.loadFromHistory({
        id: "h-1",
        createdAt: 0,
        prompt: "old prompt",
        templateId: "old-tpl",
        templateName: "Old Template",
        html: "<html>old</html>",
      }),
    );

    expect(result.current.mode).toBe("editing");
    expect(result.current.html).toBe("<html>old</html>");
    expect(result.current.lastPrompt).toBe("old prompt");
    expect(result.current.lastTemplateId).toBe("old-tpl");
    expect(result.current.templateName).toBe("Old Template");
    expect(result.current.chatMessages).toEqual([]);
  });

  it("loadFromHistory (v2.1) восстанавливает chatMessages из JSON-string", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    const stored = JSON.stringify([
      { role: "user", text: "сделай кнопки больше" },
      { role: "assistant", text: "Готово ✨" },
      { role: "user", text: "и добавь форму" },
      { role: "assistant", text: "Готово ✨" },
    ]);

    act(() =>
      result.current.loadFromHistory({
        id: "site-abc",
        createdAt: 0,
        prompt: "лендинг кофейни",
        templateId: "coffee",
        templateName: "Coffee Shop",
        html: "<html>v3</html>",
        chatMessages: stored,
      }),
    );

    expect(result.current.chatMessages).toHaveLength(4);
    expect(result.current.chatMessages[0]).toEqual({
      role: "user",
      text: "сделай кнопки больше",
    });
    expect(result.current.chatMessages[3]).toEqual({
      role: "assistant",
      text: "Готово ✨",
    });
    // currentSiteId должен встать в id из entry, чтобы дальше polish PATCH'ил
    expect(result.current.currentSiteId).toBe("site-abc");
  });

  it("loadFromHistory с невалидным chatMessages JSON → пустой chat (graceful)", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    act(() =>
      result.current.loadFromHistory({
        id: "site-bad",
        createdAt: 0,
        prompt: "p",
        templateId: "t",
        templateName: "T",
        html: "<html/>",
        chatMessages: "{not-valid-json",
      }),
    );

    expect(result.current.chatMessages).toEqual([]);
    expect(result.current.mode).toBe("editing"); // всё равно открыли
  });

  it("loadFromHistory отфильтровывает невалидные элементы chatMessages массива", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    // Подсовываем массив где не все элементы — валидные ChatMessage
    const dirty = JSON.stringify([
      { role: "user", text: "ok" },
      { role: "system", text: "невалидная role" },
      null,
      "string",
      { role: "assistant", text: 42 }, // невалидный text
      { role: "assistant", text: "тоже ok" },
    ]);

    act(() =>
      result.current.loadFromHistory({
        id: "site-dirty",
        createdAt: 0,
        prompt: "p",
        templateId: "t",
        templateName: "T",
        html: "<html/>",
        chatMessages: dirty,
      }),
    );

    expect(result.current.chatMessages).toEqual([
      { role: "user", text: "ok" },
      { role: "assistant", text: "тоже ok" },
    ]);
  });

  it("cancelGeneration → loading=false + welcome + sendAbort если есть active request", async () => {
    const sendAbort = vi.fn();
    const socket = makeFakeSocket({
      status: "authed",
      tunnelStatus: "online",
      sendAbort,
    });

    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: authedAuth,
        getSocket: () => socket,
      }),
    );

    // Запустим WS-генерацию — она зависнет в "generating"
    await act(async () => {
      await result.current.createSite("infinite");
    });
    expect(result.current.mode).toBe("generating");

    act(() => result.current.cancelGeneration());

    expect(result.current.mode).toBe("welcome");
    expect(result.current.loading).toBe(false);
    expect(sendAbort).toHaveBeenCalledWith(expect.stringMatching(/^req-/));
    expect(toast.warning).toHaveBeenCalled();
  });
});

// ─── handleWsEvent stable reference ──────────────────────────────────

describe("useGenerationFlow > handleWsEvent stability", () => {
  it("handleWsEvent не пересоздаётся между ре-рендерами (важно для useControlSocket subscribe)", async () => {
    const socket = makeFakeSocket();
    const { result, rerender } = renderHook(
      ({ auth }: { auth: GenerationAuth }) =>
        useGenerationFlow({
          projectId: "p-1",
          auth,
          getSocket: () => socket,
        }),
      { initialProps: { auth: guestAuth as GenerationAuth } },
    );

    const firstHandler = result.current.handleWsEvent;

    rerender({ auth: authedAuth as GenerationAuth });

    // handleWsEvent должен быть тем же reference — иначе useControlSocket
    // переподпишется на каждый ре-рендер и потеряет in-flight генерации.
    expect(result.current.handleWsEvent).toBe(firstHandler);

    // Ждём чтобы useEffect (authRef update) тоже сработал
    await waitFor(() => {
      expect(result.current.handleWsEvent).toBe(firstHandler);
    });
  });
});

// ─── Polish undo/redo ────────────────────────────────────────────────

describe("useGenerationFlow > versions / undo / redo", () => {
  /**
   * Универсальный helper: HTTP create + N HTTP polishes, чтобы накопить
   * версии. Использует mockedRunHttp в "очередь" и реальный result.current
   * для прогона actions.
   */
  async function buildVersions(
    createHtml: string,
    polishHtmls: string[],
  ): Promise<ReturnType<typeof renderHook<ReturnType<typeof useGenerationFlow>, unknown>>> {
    mockedRunHttp.mockImplementationOnce(async (params: {
      onEvent: (e: { type: string; templateId?: string; templateName?: string }) => void;
    }) => {
      params.onEvent({ type: "template_selected", templateId: "coffee", templateName: "Coffee" });
      return {
        finalHtml: createHtml,
        templateId: "coffee",
        templateName: "Coffee",
        newSessionId: "s-1",
      };
    });
    for (const html of polishHtmls) {
      mockedRunHttp.mockImplementationOnce(async () => ({
        finalHtml: html,
        templateId: "coffee",
        templateName: "Coffee",
        newSessionId: "s-1",
      }));
    }

    const socket = makeFakeSocket();
    const hook = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    await act(async () => {
      await hook.result.current.createSite("coffee shop");
    });
    for (const _ of polishHtmls) {
      await act(async () => {
        await hook.result.current.polishSite("more accents");
      });
    }
    return hook;
  }

  it("initial state: versions пустой, currentVersionIndex=-1, canUndo/canRedo=false", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useGenerationFlow({
        projectId: "p-1",
        auth: guestAuth,
        getSocket: () => socket,
      }),
    );

    expect(result.current.versions).toEqual([]);
    expect(result.current.currentVersionIndex).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("успешный createSite → одна версия (kind='create'), canUndo=false (только одна)", async () => {
    const hook = await buildVersions("<html>v1</html>", []);
    expect(hook.result.current.versions).toHaveLength(1);
    expect(hook.result.current.versions[0]?.html).toBe("<html>v1</html>");
    expect(hook.result.current.versions[0]?.kind).toBe("create");
    expect(hook.result.current.currentVersionIndex).toBe(0);
    expect(hook.result.current.canUndo).toBe(false);
    expect(hook.result.current.canRedo).toBe(false);
  });

  it("create + 2 polish → 3 версии, индекс=2, canUndo=true, canRedo=false", async () => {
    const hook = await buildVersions("<html>v1</html>", [
      "<html>v2</html>",
      "<html>v3</html>",
    ]);
    expect(hook.result.current.versions).toHaveLength(3);
    expect(hook.result.current.versions[1]?.kind).toBe("polish");
    expect(hook.result.current.versions[2]?.kind).toBe("polish");
    expect(hook.result.current.currentVersionIndex).toBe(2);
    expect(hook.result.current.canUndo).toBe(true);
    expect(hook.result.current.canRedo).toBe(false);
  });

  it("undo на 1 шаг → html прошлой версии, canRedo=true", async () => {
    const hook = await buildVersions("<html>v1</html>", [
      "<html>v2</html>",
      "<html>v3</html>",
    ]);
    act(() => hook.result.current.undoVersion());
    expect(hook.result.current.html).toBe("<html>v2</html>");
    expect(hook.result.current.currentVersionIndex).toBe(1);
    expect(hook.result.current.canUndo).toBe(true);
    expect(hook.result.current.canRedo).toBe(true);
  });

  it("undo до начала → canUndo=false, дальше undo не двигает", async () => {
    const hook = await buildVersions("<html>v1</html>", ["<html>v2</html>"]);
    act(() => hook.result.current.undoVersion()); // v2 → v1
    expect(hook.result.current.currentVersionIndex).toBe(0);
    expect(hook.result.current.canUndo).toBe(false);
    act(() => hook.result.current.undoVersion()); // не должен сдвинуть
    expect(hook.result.current.currentVersionIndex).toBe(0);
    expect(hook.result.current.html).toBe("<html>v1</html>");
  });

  it("undo + redo → возврат к актуальной", async () => {
    const hook = await buildVersions("<html>v1</html>", ["<html>v2</html>"]);
    act(() => hook.result.current.undoVersion());
    expect(hook.result.current.html).toBe("<html>v1</html>");
    act(() => hook.result.current.redoVersion());
    expect(hook.result.current.html).toBe("<html>v2</html>");
    expect(hook.result.current.currentVersionIndex).toBe(1);
  });

  it("после undo новый polish отрезает redo-хвост", async () => {
    // v1, v2, v3 — стоим на v3, undo → v2, новый polish (v4) — версии
    // должны стать [v1, v2, v4], индекс=2, canRedo=false.
    const hook = await buildVersions("<html>v1</html>", [
      "<html>v2</html>",
      "<html>v3</html>",
    ]);
    act(() => hook.result.current.undoVersion()); // index=1 (v2)
    expect(hook.result.current.currentVersionIndex).toBe(1);

    mockedRunHttp.mockImplementationOnce(async () => ({
      finalHtml: "<html>v4</html>",
      templateId: "coffee",
      templateName: "Coffee",
      newSessionId: "s-1",
    }));
    await act(async () => {
      await hook.result.current.polishSite("alternate path");
    });

    expect(hook.result.current.versions).toHaveLength(3);
    expect(hook.result.current.versions[2]?.html).toBe("<html>v4</html>");
    expect(hook.result.current.html).toBe("<html>v4</html>");
    expect(hook.result.current.currentVersionIndex).toBe(2);
    expect(hook.result.current.canRedo).toBe(false);
  });

  it("loadFromHistory сбрасывает стек версий до одной начальной", async () => {
    const hook = await buildVersions("<html>v1</html>", ["<html>v2</html>"]);
    expect(hook.result.current.versions).toHaveLength(2);

    act(() => {
      hook.result.current.loadFromHistory({
        id: "h-1",
        createdAt: Date.now(),
        prompt: "из истории",
        templateId: "barber",
        templateName: "Barber",
        html: "<html>history-site</html>",
      });
    });

    expect(hook.result.current.versions).toHaveLength(1);
    expect(hook.result.current.versions[0]?.html).toBe("<html>history-site</html>");
    expect(hook.result.current.versions[0]?.kind).toBe("create");
    expect(hook.result.current.currentVersionIndex).toBe(0);
    expect(hook.result.current.canUndo).toBe(false);
  });

  it("reset очищает стек версий", async () => {
    const hook = await buildVersions("<html>v1</html>", ["<html>v2</html>"]);
    act(() => hook.result.current.reset());
    expect(hook.result.current.versions).toEqual([]);
    expect(hook.result.current.currentVersionIndex).toBe(-1);
    expect(hook.result.current.canUndo).toBe(false);
  });
});
