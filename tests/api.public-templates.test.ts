import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Тесты на /api/public-templates и /api/admin/templates/:id/approve
 * (v2.2 Community templates).
 *
 * Покрывают:
 *   - GET /api/public-templates — публичный список (без auth)
 *   - GET /api/public-templates/:id — full body, 404 если не публичный
 *   - POST /api/admin/templates/:id/approve — admin token, action=approve/reject
 */

vi.mock("~/lib/server/appwrite.server", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/appwrite.server")
  >("~/lib/server/appwrite.server");
  return {
    ...actual,
    listPublicTemplates: vi.fn(),
    getPublicTemplate: vi.fn(),
    setTemplatePublicState: vi.fn(),
  };
});

import {
  loader as listLoader,
} from "~/routes/api.public-templates";
import {
  loader as idLoader,
} from "~/routes/api.public-templates.$id";
import {
  action as adminAction,
} from "~/routes/api.admin.templates.approve.$id";
import {
  listPublicTemplates,
  getPublicTemplate,
  setTemplatePublicState,
} from "~/lib/server/appwrite.server";

const mockedList = listPublicTemplates as unknown as ReturnType<typeof vi.fn>;
const mockedGet = getPublicTemplate as unknown as ReturnType<typeof vi.fn>;
const mockedSetPublic = setTemplatePublicState as unknown as ReturnType<typeof vi.fn>;

const ADMIN_TOKEN = "test-admin-token-32-chars-long-xx";

function makeReq(
  url: string,
  opts?: {
    method?: string;
    body?: unknown;
    adminToken?: string;
  },
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.adminToken) {
    headers["x-nit-admin-token"] = opts.adminToken;
  }
  return new Request(`http://localhost${url}`, {
    method: opts?.method ?? "GET",
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

beforeEach(() => {
  process.env.NIT_ADMIN_TOKEN = ADMIN_TOKEN;
  mockedList.mockReset();
  mockedGet.mockReset();
  mockedSetPublic.mockReset();
});

afterEach(() => {
  delete process.env.NIT_ADMIN_TOKEN;
  vi.restoreAllMocks();
});

describe("GET /api/public-templates — public list", () => {
  it("возвращает summary без html, без auth", async () => {
    mockedList.mockResolvedValue([
      {
        $id: "t1",
        $createdAt: "2026-05-18T10:00:00Z",
        userId: "u1",
        name: "Coffee public",
        prompt: "лендинг кофейни",
        html: "<html>FULL</html>",
        zones: '[{"id":"hero"}]',
        isPublic: true,
        votes: 5,
      },
      {
        $id: "t2",
        $createdAt: "2026-05-17T10:00:00Z",
        userId: "u2",
        name: "Barber public",
        html: "<html>FULL</html>",
        isPublic: true,
        votes: 2,
      },
    ]);

    const req = makeReq("/api/public-templates");
    const res = await listLoader({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listLoader>[0]);
    const body = await (res as Response).json();

    expect(body.templates).toHaveLength(2);
    expect(body.templates[0]).toEqual({
      id: "t1",
      name: "Coffee public",
      prompt: "лендинг кофейни",
      createdAt: "2026-05-18T10:00:00Z",
      votes: 5,
      hasZones: true,
    });
    // html не возвращается в summary
    expect(body.templates[0].html).toBeUndefined();
    // t2 без prompt — null
    expect(body.templates[1].prompt).toBe(null);
    expect(body.templates[1].hasZones).toBe(false);
  });

  it("500 если listPublicTemplates бросает", async () => {
    mockedList.mockRejectedValue(new Error("appwrite down"));
    const req = makeReq("/api/public-templates");
    const res = await listLoader({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof listLoader>[0]);
    expect((res as Response).status).toBe(500);
  });
});

describe("GET /api/public-templates/:id — fetch one", () => {
  it("возвращает full body для публичного шаблона", async () => {
    mockedGet.mockResolvedValue({
      $id: "t1",
      $createdAt: "2026-05-18T10:00:00Z",
      userId: "u1",
      name: "Coffee public",
      prompt: "лендинг кофейни",
      html: "<html>full content</html>",
      zones: '[{"id":"hero"}]',
      isPublic: true,
      votes: 5,
    });

    const req = makeReq("/api/public-templates/t1");
    const res = await idLoader({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof idLoader>[0]);
    const body = await (res as Response).json();

    expect(body.html).toBe("<html>full content</html>");
    expect(body.votes).toBe(5);
    expect(mockedGet).toHaveBeenCalledWith("t1");
  });

  it("404 если getPublicTemplate вернул null (не существует или isPublic=false)", async () => {
    mockedGet.mockResolvedValue(null);
    const req = makeReq("/api/public-templates/t-bad");
    const res = await idLoader({
      request: req,
      params: { id: "t-bad" },
      context: {},
    } as unknown as Parameters<typeof idLoader>[0]);
    expect((res as Response).status).toBe(404);
  });

  it("400 на отсутствующий id в params", async () => {
    const req = makeReq("/api/public-templates/");
    const res = await idLoader({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof idLoader>[0]);
    expect((res as Response).status).toBe(400);
  });
});

describe("POST /api/admin/templates/:id/approve", () => {
  it("approve: 200 + isPublic=true", async () => {
    mockedSetPublic.mockResolvedValue(true);
    const req = makeReq("/api/admin/templates/t1/approve", {
      method: "POST",
      body: { action: "approve" },
      adminToken: ADMIN_TOKEN,
    });
    const res = await adminAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(200);
    expect(body.isPublic).toBe(true);
    expect(mockedSetPublic).toHaveBeenCalledWith("t1", true);
  });

  it("reject: 200 + isPublic=false", async () => {
    mockedSetPublic.mockResolvedValue(true);
    const req = makeReq("/api/admin/templates/t1/approve", {
      method: "POST",
      body: { action: "reject" },
      adminToken: ADMIN_TOKEN,
    });
    const res = await adminAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(200);
    expect(body.isPublic).toBe(false);
    expect(mockedSetPublic).toHaveBeenCalledWith("t1", false);
  });

  it("401 без admin token", async () => {
    const req = makeReq("/api/admin/templates/t1/approve", {
      method: "POST",
      body: { action: "approve" },
      // adminToken не задан
    });
    const res = await adminAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    expect((res as Response).status).toBe(401);
    expect(mockedSetPublic).not.toHaveBeenCalled();
  });

  it("401 на неверный admin token", async () => {
    const req = makeReq("/api/admin/templates/t1/approve", {
      method: "POST",
      body: { action: "approve" },
      adminToken: "wrong-token-32-chars-padding-xxxx",
    });
    const res = await adminAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    expect((res as Response).status).toBe(401);
    expect(mockedSetPublic).not.toHaveBeenCalled();
  });

  it("503 если NIT_ADMIN_TOKEN не задан", async () => {
    delete process.env.NIT_ADMIN_TOKEN;
    const req = makeReq("/api/admin/templates/t1/approve", {
      method: "POST",
      body: { action: "approve" },
      adminToken: "anything",
    });
    const res = await adminAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    expect((res as Response).status).toBe(503);
  });

  it("400 на невалидный action в body", async () => {
    const req = makeReq("/api/admin/templates/t1/approve", {
      method: "POST",
      body: { action: "delete" }, // не из enum
      adminToken: ADMIN_TOKEN,
    });
    const res = await adminAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    expect((res as Response).status).toBe(400);
    expect(mockedSetPublic).not.toHaveBeenCalled();
  });

  it("400 на невалидный JSON body", async () => {
    const req = new Request("http://localhost/api/admin/templates/t1/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nit-admin-token": ADMIN_TOKEN,
      },
      body: "{not-json",
    });
    const res = await adminAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    expect((res as Response).status).toBe(400);
  });

  it("404 если setTemplatePublicState возвращает false (шаблона нет)", async () => {
    mockedSetPublic.mockResolvedValue(false);
    const req = makeReq("/api/admin/templates/t-bad/approve", {
      method: "POST",
      body: { action: "approve" },
      adminToken: ADMIN_TOKEN,
    });
    const res = await adminAction({
      request: req,
      params: { id: "t-bad" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    expect((res as Response).status).toBe(404);
  });

  it("405 на GET", async () => {
    const req = makeReq("/api/admin/templates/t1/approve", {
      method: "GET",
      adminToken: ADMIN_TOKEN,
    });
    const res = await adminAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof adminAction>[0]);
    expect((res as Response).status).toBe(405);
  });
});
