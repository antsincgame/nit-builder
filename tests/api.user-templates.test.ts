import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Тесты на /api/user-templates и /api/user-templates/:id (v2.1 Save as Template).
 *
 * Покрывают:
 *   - GET /api/user-templates — список (summary без html)
 *   - POST /api/user-templates — успех/validation/limit 50/JSON-error
 *   - GET /api/user-templates/:id — full body, 404 ownership
 *   - DELETE /api/user-templates/:id — успех/404
 *
 * Mock-стратегия: vi.mock на appwrite.server (4 функции + requireAuth).
 */

vi.mock("~/lib/server/appwrite.server", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/appwrite.server")
  >("~/lib/server/appwrite.server");
  return {
    ...actual,
    saveUserTemplate: vi.fn(),
    listUserTemplates: vi.fn(),
    getUserTemplate: vi.fn(),
    deleteUserTemplate: vi.fn(),
  };
});

vi.mock("~/lib/server/requireAuth.server", () => ({
  requireAuth: vi.fn(),
}));

import {
  action as listAction,
  loader as listLoader,
} from "~/routes/api.user-templates";
import {
  action as idAction,
  loader as idLoader,
} from "~/routes/api.user-templates.$id";
import {
  saveUserTemplate,
  listUserTemplates,
  getUserTemplate,
  deleteUserTemplate,
} from "~/lib/server/appwrite.server";
import { requireAuth } from "~/lib/server/requireAuth.server";

const mockedRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;
const mockedSave = saveUserTemplate as unknown as ReturnType<typeof vi.fn>;
const mockedList = listUserTemplates as unknown as ReturnType<typeof vi.fn>;
const mockedGet = getUserTemplate as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = deleteUserTemplate as unknown as ReturnType<typeof vi.fn>;

function makeReq(url: string, opts?: { method?: string; body?: unknown }): Request {
  return new Request(`http://localhost${url}`, {
    method: opts?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

beforeEach(() => {
  mockedRequireAuth.mockReset().mockResolvedValue({ userId: "u1", email: "u1@test" });
  mockedSave.mockReset();
  mockedList.mockReset();
  mockedGet.mockReset();
  mockedDelete.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/user-templates — list", () => {
  it("возвращает summary без html, с hasZones флагом", async () => {
    mockedList.mockResolvedValue([
      {
        $id: "t1",
        $createdAt: "2026-05-18T10:00:00Z",
        userId: "u1",
        name: "Coffee dark",
        prompt: "лендинг кофейни",
        html: "<html>VERY-LARGE</html>",
        zones: '[{"id":"hero"}]',
        isPublic: false,
        votes: 0,
      },
      {
        $id: "t2",
        $createdAt: "2026-05-17T10:00:00Z",
        userId: "u1",
        name: "Barber neon",
        html: "<html>another</html>",
        isPublic: false,
        votes: 0,
      },
    ]);

    const req = makeReq("/api/user-templates");
    const res = await listLoader({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listLoader>[0]);
    const body = await (res as Response).json();

    expect(body.templates).toHaveLength(2);
    expect(body.templates[0]).toEqual({
      id: "t1",
      name: "Coffee dark",
      prompt: "лендинг кофейни",
      createdAt: "2026-05-18T10:00:00Z",
      isPublic: false,
      votes: 0,
      hasZones: true,
    });
    // html не должно быть в summary
    expect(body.templates[0].html).toBeUndefined();
    // t2 без prompt + без zones — null/false
    expect(body.templates[1].prompt).toBe(null);
    expect(body.templates[1].hasZones).toBe(false);
  });

  it("500 если listUserTemplates бросает", async () => {
    mockedList.mockRejectedValue(new Error("appwrite down"));
    const req = makeReq("/api/user-templates");
    const res = await listLoader({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listLoader>[0]);
    expect((res as Response).status).toBe(500);
  });
});

describe("POST /api/user-templates — save", () => {
  it("успех: 201 с id", async () => {
    mockedSave.mockResolvedValue("new-template-id");

    const req = makeReq("/api/user-templates", {
      method: "POST",
      body: { name: "My template", html: "<html>x</html>", prompt: "p" },
    });
    const res = await listAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listAction>[0]);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(201);
    expect(body.id).toBe("new-template-id");
    expect(mockedSave).toHaveBeenCalledWith({
      userId: "u1",
      name: "My template",
      html: "<html>x</html>",
      prompt: "p",
    });
  });

  it("400 на пустое name", async () => {
    const req = makeReq("/api/user-templates", {
      method: "POST",
      body: { name: "", html: "<x/>" },
    });
    const res = await listAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listAction>[0]);
    expect((res as Response).status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("400 на html > 1_000_000 chars", async () => {
    const req = makeReq("/api/user-templates", {
      method: "POST",
      body: { name: "n", html: "x".repeat(1_000_001) },
    });
    const res = await listAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listAction>[0]);
    expect((res as Response).status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("403 + code LIMIT_EXCEEDED если сервер бросает USER_TEMPLATE_LIMIT_EXCEEDED", async () => {
    mockedSave.mockRejectedValue(new Error("USER_TEMPLATE_LIMIT_EXCEEDED"));

    const req = makeReq("/api/user-templates", {
      method: "POST",
      body: { name: "n", html: "<x/>" },
    });
    const res = await listAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listAction>[0]);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(403);
    expect(body.code).toBe("LIMIT_EXCEEDED");
  });

  it("400 на невалидный JSON body", async () => {
    const req = new Request("http://localhost/api/user-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await listAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listAction>[0]);
    expect((res as Response).status).toBe(400);
  });

  it("405 на GET через action", async () => {
    const req = makeReq("/api/user-templates", { method: "PUT", body: {} });
    const res = await listAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listAction>[0]);
    expect((res as Response).status).toBe(405);
  });
});

describe("GET /api/user-templates/:id — one template", () => {
  it("возвращает full body включая html и zones", async () => {
    mockedGet.mockResolvedValue({
      $id: "t1",
      $createdAt: "2026-05-18T10:00:00Z",
      userId: "u1",
      name: "Coffee dark",
      prompt: "p",
      html: "<html>full content here</html>",
      zones: '[{"id":"hero","label":"Hero"}]',
      isPublic: false,
      votes: 5,
    });

    const req = makeReq("/api/user-templates/t1");
    const res = await idLoader({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof idLoader>[0]);
    const body = await (res as Response).json();

    expect(body.html).toBe("<html>full content here</html>");
    expect(body.zones).toBe('[{"id":"hero","label":"Hero"}]');
    expect(body.votes).toBe(5);
    expect(mockedGet).toHaveBeenCalledWith("u1", "t1");
  });

  it("404 если getUserTemplate вернул null (чужой / не существует)", async () => {
    mockedGet.mockResolvedValue(null);
    const req = makeReq("/api/user-templates/t-bad");
    const res = await idLoader({
      request: req,
      params: { id: "t-bad" },
      context: {},
    } as unknown as Parameters<typeof idLoader>[0]);
    expect((res as Response).status).toBe(404);
  });

  it("400 на отсутствующий id в params", async () => {
    const req = makeReq("/api/user-templates/");
    const res = await idLoader({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof idLoader>[0]);
    expect((res as Response).status).toBe(400);
  });
});

describe("DELETE /api/user-templates/:id", () => {
  it("успех: deleteUserTemplate=true → 200", async () => {
    mockedDelete.mockResolvedValue(true);
    const req = makeReq("/api/user-templates/t1", { method: "DELETE" });
    const res = await idAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof idAction>[0]);
    expect((res as Response).status).toBe(200);
    expect(mockedDelete).toHaveBeenCalledWith("u1", "t1");
  });

  it("404 если deleteUserTemplate=false", async () => {
    mockedDelete.mockResolvedValue(false);
    const req = makeReq("/api/user-templates/t1", { method: "DELETE" });
    const res = await idAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof idAction>[0]);
    expect((res as Response).status).toBe(404);
  });

  it("405 на PATCH (не поддерживается на :id)", async () => {
    const req = makeReq("/api/user-templates/t1", { method: "PATCH" });
    const res = await idAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof idAction>[0]);
    expect((res as Response).status).toBe(405);
  });
});
