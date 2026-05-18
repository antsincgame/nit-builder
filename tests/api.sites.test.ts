import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Тесты на /api/sites/:id v2.1.
 *
 * Покрывают новую функциональность Continue-from-history:
 *   - PATCH /api/sites/:id — обновление html/chatMessages/thumbnail
 *     (success, ownership-404, validation, empty patch, method-not-allowed)
 *   - GET /api/sites/:id — chatMessages поле в ответе
 *
 * Стратегия: mock appwrite.server (updateSite + getAdminDatabases для GET).
 */

vi.mock("~/lib/server/appwrite.server", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/appwrite.server")
  >("~/lib/server/appwrite.server");
  return {
    ...actual,
    getAdminDatabases: vi.fn(),
    updateSite: vi.fn(),
    deleteSite: vi.fn(),
  };
});

vi.mock("~/lib/server/requireAuth.server", () => ({
  requireAuth: vi.fn(),
}));

import { action as siteIdAction, loader as siteIdLoader } from "~/routes/api.sites.$id";
import {
  deleteSite,
  getAdminDatabases,
  updateSite,
} from "~/lib/server/appwrite.server";
import { requireAuth } from "~/lib/server/requireAuth.server";

const mockedRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;
const mockedGetDb = getAdminDatabases as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = updateSite as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = deleteSite as unknown as ReturnType<typeof vi.fn>;

function makeReq(url: string, opts?: { method?: string; body?: unknown }): Request {
  return new Request(`http://localhost${url}`, {
    method: opts?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-request-remote-ip": "127.0.0.1",
    },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

beforeEach(() => {
  mockedRequireAuth.mockReset();
  mockedGetDb.mockReset();
  mockedUpdate.mockReset();
  mockedDelete.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/sites/:id — v2.1 chatMessages в ответе", () => {
  it("возвращает chatMessages поле (null если не было)", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });
    mockedGetDb.mockReturnValue({
      getDocument: vi.fn().mockResolvedValue({
        $id: "s1",
        $createdAt: "2026-05-18T00:00:00Z",
        $updatedAt: "2026-05-18T00:00:00Z",
        userId: "u1",
        prompt: "p",
        html: "<html/>",
        templateId: "t1",
        templateName: "T",
        thumbnail: null,
        // chatMessages не задано — должно вернуть null
      }),
    });

    const req = makeReq("/api/sites/s1");
    const res = await siteIdLoader({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdLoader>[0]);
    const body = await (res as Response).json();

    expect(body.chatMessages).toBe(null);
    expect(body.id).toBe("s1");
  });

  it("возвращает chatMessages если они есть в документе", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });
    const chatJson = JSON.stringify([
      { role: "user", text: "hi" },
      { role: "assistant", text: "Готово ✨" },
    ]);
    mockedGetDb.mockReturnValue({
      getDocument: vi.fn().mockResolvedValue({
        $id: "s1",
        $createdAt: "2026-05-18T00:00:00Z",
        $updatedAt: "2026-05-18T00:00:00Z",
        userId: "u1",
        prompt: "p",
        html: "<html/>",
        templateId: "t1",
        templateName: "T",
        chatMessages: chatJson,
      }),
    });

    const req = makeReq("/api/sites/s1");
    const res = await siteIdLoader({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdLoader>[0]);
    const body = await (res as Response).json();

    expect(body.chatMessages).toBe(chatJson);
  });
});

describe("PATCH /api/sites/:id — v2.1 Continue from history", () => {
  it("успех: обновляет html + chatMessages, возвращает 200", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });
    mockedUpdate.mockResolvedValue(true);

    const req = makeReq("/api/sites/s1", {
      method: "PATCH",
      body: {
        html: "<html>new</html>",
        chatMessages: '[{"role":"user","text":"новый промпт"}]',
      },
    });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith(
      "u1",
      "s1",
      expect.objectContaining({
        html: "<html>new</html>",
        chatMessages: '[{"role":"user","text":"новый промпт"}]',
      }),
    );
  });

  it("успех: обновляет только chatMessages (partial)", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });
    mockedUpdate.mockResolvedValue(true);

    const req = makeReq("/api/sites/s1", {
      method: "PATCH",
      body: { chatMessages: "[]" },
    });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(200);
    const call = mockedUpdate.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(call).toEqual({ chatMessages: "[]" });
    // html не должно попасть в patch
    expect(call.html).toBeUndefined();
  });

  it("404 если updateSite вернул false (чужой сайт / не существует)", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });
    mockedUpdate.mockResolvedValue(false);

    const req = makeReq("/api/sites/s1", {
      method: "PATCH",
      body: { html: "<x/>" },
    });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(404);
  });

  it("400 на html > 1_000_000 символов (Zod max)", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });

    const oversized = "x".repeat(1_000_001);
    const req = makeReq("/api/sites/s1", {
      method: "PATCH",
      body: { html: oversized },
    });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(400);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("400 на chatMessages > 100_000 символов", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });

    const oversized = "x".repeat(100_001);
    const req = makeReq("/api/sites/s1", {
      method: "PATCH",
      body: { chatMessages: oversized },
    });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(400);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("200 на пустой patch без вызова updateSite (idempotent)", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });

    const req = makeReq("/api/sites/s1", {
      method: "PATCH",
      body: {},
    });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(200);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("400 на невалидный JSON в body", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });

    // Делаем «битый» JSON-body вручную
    const req = new Request("http://localhost/api/sites/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(400);
  });

  it("400 на отсутствующий site id в params", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });

    const req = makeReq("/api/sites/", { method: "PATCH", body: { html: "<x/>" } });
    const res = await siteIdAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(400);
  });

  it("405 на неподдерживаемый метод (POST на /:id)", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });

    const req = makeReq("/api/sites/s1", { method: "POST", body: {} });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(405);
  });
});

describe("DELETE /api/sites/:id — regression", () => {
  it("успех: deleteSite=true → 200", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });
    mockedDelete.mockResolvedValue(true);

    const req = makeReq("/api/sites/s1", { method: "DELETE" });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(200);
    expect(mockedDelete).toHaveBeenCalledWith("u1", "s1");
  });

  it("404 если deleteSite вернул false", async () => {
    mockedRequireAuth.mockResolvedValue({ userId: "u1", email: "u1@test" });
    mockedDelete.mockResolvedValue(false);

    const req = makeReq("/api/sites/s1", { method: "DELETE" });
    const res = await siteIdAction({
      request: req,
      params: { id: "s1" },
      context: {},
    } as unknown as Parameters<typeof siteIdAction>[0]);

    expect((res as Response).status).toBe(404);
  });
});
