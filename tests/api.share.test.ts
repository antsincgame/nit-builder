import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Тесты на shareable preview links (v2.1).
 *
 * Покрывают:
 *   - POST /api/share — создать share (ownership-check, валидация ttlDays)
 *   - DELETE /api/share/:id — отозвать (ownership-check)
 *   - GET /p/:token — публичный просмотр (404 на плохой формат токена,
 *     404 на не найден / истёк, успешный путь с инкрементом views).
 *
 * Стратегия: mock appwrite.server (вся работа с Appwrite через
 * createSharedPreview/getSharedPreviewByToken/incrementSharedPreviewViews/
 * revokeSharedPreview + getAdminDatabases для siteId ownership check).
 */

vi.mock("~/lib/server/appwrite.server", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/appwrite.server")
  >("~/lib/server/appwrite.server");
  return {
    ...actual,
    getAdminDatabases: vi.fn(),
    createSharedPreview: vi.fn(),
    getSharedPreviewByToken: vi.fn(),
    incrementSharedPreviewViews: vi.fn().mockResolvedValue(undefined),
    listUserSharedPreviews: vi.fn(),
    revokeSharedPreview: vi.fn(),
  };
});

vi.mock("~/lib/server/requireAuth.server", () => ({
  requireAuth: vi.fn(),
}));

import { action as shareAction, loader as shareLoader } from "~/routes/api.share";
import { action as shareIdAction } from "~/routes/api.share.$id";
import { loader as publicLoader } from "~/routes/p.$token";
import {
  createSharedPreview,
  getAdminDatabases,
  getSharedPreviewByToken,
  incrementSharedPreviewViews,
  listUserSharedPreviews,
  revokeSharedPreview,
} from "~/lib/server/appwrite.server";
import { requireAuth } from "~/lib/server/requireAuth.server";

const mockedRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;
const mockedGetDb = getAdminDatabases as unknown as ReturnType<typeof vi.fn>;
const mockedCreate = createSharedPreview as unknown as ReturnType<typeof vi.fn>;
const mockedGet = getSharedPreviewByToken as unknown as ReturnType<typeof vi.fn>;
const mockedIncr = incrementSharedPreviewViews as unknown as ReturnType<typeof vi.fn>;
const mockedList = listUserSharedPreviews as unknown as ReturnType<typeof vi.fn>;
const mockedRevoke = revokeSharedPreview as unknown as ReturnType<typeof vi.fn>;

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
  mockedCreate.mockReset();
  mockedGet.mockReset();
  mockedIncr.mockReset().mockResolvedValue(undefined);
  mockedList.mockReset();
  mockedRevoke.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── POST /api/share ─────────────────────────────────────────────────

describe("POST /api/share", () => {
  it("создаёт share для своего сайта → 201 с token+url+expiresAt", async () => {
    mockedRequireAuth.mockResolvedValueOnce({ userId: "u-1", email: "a@b.c" });
    mockedGetDb.mockReturnValueOnce({
      getDocument: vi.fn().mockResolvedValueOnce({
        $id: "site-1",
        userId: "u-1",
        html: "<html>my site</html>",
      }),
    });
    mockedCreate.mockResolvedValueOnce({
      $id: "share-1",
      token: "AbCdEf123456",
      siteId: "site-1",
      userId: "u-1",
      html: "<html>my site</html>",
      expiresAt: "2026-06-16T12:00:00.000Z",
      views: 0,
    });

    const req = makeReq("/api/share", {
      method: "POST",
      body: { siteId: "site-1" },
    });
    const res = await shareAction({ request: req } as Parameters<typeof shareAction>[0]);
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      token: string;
      url: string;
      expiresAt: string;
    };
    expect(json.token).toBe("AbCdEf123456");
    expect(json.url).toBe("/p/AbCdEf123456");
    expect(json.expiresAt).toBe("2026-06-16T12:00:00.000Z");

    // Snapshot HTML должен взяться из site.html
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "site-1",
        userId: "u-1",
        html: "<html>my site</html>",
      }),
    );
  });

  it("404 при попытке расшарить чужой сайт", async () => {
    mockedRequireAuth.mockResolvedValueOnce({ userId: "u-1", email: "a@b.c" });
    mockedGetDb.mockReturnValueOnce({
      getDocument: vi.fn().mockResolvedValueOnce({
        $id: "site-1",
        userId: "u-OTHER",
        html: "<html>not yours</html>",
      }),
    });

    const req = makeReq("/api/share", {
      method: "POST",
      body: { siteId: "site-1" },
    });
    const res = await shareAction({ request: req } as Parameters<typeof shareAction>[0]);
    expect(res.status).toBe(404);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("404 если site не существует (getDocument throws not found)", async () => {
    mockedRequireAuth.mockResolvedValueOnce({ userId: "u-1", email: "a@b.c" });
    mockedGetDb.mockReturnValueOnce({
      getDocument: vi.fn().mockRejectedValueOnce(new Error("Document not found (404)")),
    });

    const req = makeReq("/api/share", {
      method: "POST",
      body: { siteId: "no-such-site" },
    });
    const res = await shareAction({ request: req } as Parameters<typeof shareAction>[0]);
    expect(res.status).toBe(404);
  });

  it("400 на невалидный body (missing siteId)", async () => {
    mockedRequireAuth.mockResolvedValueOnce({ userId: "u-1", email: "a@b.c" });
    const req = makeReq("/api/share", { method: "POST", body: {} });
    const res = await shareAction({ request: req } as Parameters<typeof shareAction>[0]);
    expect(res.status).toBe(400);
  });

  it("400 на ttlDays вне диапазона", async () => {
    mockedRequireAuth.mockResolvedValueOnce({ userId: "u-1", email: "a@b.c" });
    const req = makeReq("/api/share", {
      method: "POST",
      body: { siteId: "site-1", ttlDays: 999 },
    });
    const res = await shareAction({ request: req } as Parameters<typeof shareAction>[0]);
    expect(res.status).toBe(400);
  });

  it("405 на не-POST метод", async () => {
    const req = makeReq("/api/share", { method: "PUT" });
    const res = await shareAction({ request: req } as Parameters<typeof shareAction>[0]);
    expect(res.status).toBe(405);
  });
});

// ─── GET /api/share — мои share'ы ────────────────────────────────────

describe("GET /api/share", () => {
  it("возвращает список share'ов юзера с url", async () => {
    mockedRequireAuth.mockResolvedValueOnce({ userId: "u-1", email: "a@b.c" });
    mockedList.mockResolvedValueOnce([
      {
        $id: "share-1",
        $createdAt: "2026-05-10T00:00:00.000Z",
        token: "ABC123def456",
        siteId: "site-1",
        userId: "u-1",
        html: "long-html",
        expiresAt: "2026-06-10T00:00:00.000Z",
        views: 7,
      },
    ]);

    const req = makeReq("/api/share");
    const res = await shareLoader({ request: req } as Parameters<typeof shareLoader>[0]);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      shares: Array<{ token: string; url: string; views: number }>;
    };
    expect(json.shares).toHaveLength(1);
    expect(json.shares[0].token).toBe("ABC123def456");
    expect(json.shares[0].url).toBe("/p/ABC123def456");
    expect(json.shares[0].views).toBe(7);
  });
});

// ─── DELETE /api/share/:id ───────────────────────────────────────────

describe("DELETE /api/share/:id", () => {
  it("успешно отзывает свой share → 200", async () => {
    mockedRequireAuth.mockResolvedValueOnce({ userId: "u-1", email: "a@b.c" });
    mockedRevoke.mockResolvedValueOnce(true);
    const req = makeReq("/api/share/share-1", { method: "DELETE" });
    const res = await shareIdAction({
      request: req,
      params: { id: "share-1" },
    } as unknown as Parameters<typeof shareIdAction>[0]);
    expect(res.status).toBe(200);
    expect(mockedRevoke).toHaveBeenCalledWith("u-1", "share-1");
  });

  it("404 если revoke returns false (чужой share или не найден)", async () => {
    mockedRequireAuth.mockResolvedValueOnce({ userId: "u-1", email: "a@b.c" });
    mockedRevoke.mockResolvedValueOnce(false);
    const req = makeReq("/api/share/share-X", { method: "DELETE" });
    const res = await shareIdAction({
      request: req,
      params: { id: "share-X" },
    } as unknown as Parameters<typeof shareIdAction>[0]);
    expect(res.status).toBe(404);
  });

  it("405 на не-DELETE метод", async () => {
    const req = makeReq("/api/share/share-1", { method: "POST" });
    const res = await shareIdAction({
      request: req,
      params: { id: "share-1" },
    } as unknown as Parameters<typeof shareIdAction>[0]);
    expect(res.status).toBe(405);
  });
});

// ─── GET /p/:token (public) ──────────────────────────────────────────

describe("GET /p/:token", () => {
  it("отдаёт html и инкрементит views на валидном токене", async () => {
    mockedGet.mockResolvedValueOnce({
      $id: "share-1",
      token: "AbCdEf123456",
      html: "<html>shared</html>",
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      views: 4,
      userId: "u-1",
      siteId: "site-1",
    });

    const req = makeReq("/p/AbCdEf123456");
    const res = await publicLoader({
      request: req,
      params: { token: "AbCdEf123456" },
    } as unknown as Parameters<typeof publicLoader>[0]);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(await res.text()).toBe("<html>shared</html>");

    // Inсremement вызвался (fire-and-forget — может ещё не разрешиться, но
    // вызов должен произойти синхронно).
    expect(mockedIncr).toHaveBeenCalledWith("share-1", 4);
  });

  it("404 на невалидный формат токена (короче 12 chars)", async () => {
    mockedGet.mockResolvedValueOnce(null);
    const req = makeReq("/p/short");
    const res = await publicLoader({
      request: req,
      params: { token: "short" },
    } as unknown as Parameters<typeof publicLoader>[0]);
    expect(res.status).toBe(404);
  });

  it("404 если getSharedPreviewByToken вернул null (не найден / истёк)", async () => {
    mockedGet.mockResolvedValueOnce(null);
    const req = makeReq("/p/AAAAAAAAAAAA");
    const res = await publicLoader({
      request: req,
      params: { token: "AAAAAAAAAAAA" },
    } as unknown as Parameters<typeof publicLoader>[0]);
    expect(res.status).toBe(404);
    expect(mockedIncr).not.toHaveBeenCalled();
  });

  it("404 если token отсутствует в params", async () => {
    const req = makeReq("/p/");
    const res = await publicLoader({
      request: req,
      params: {},
    } as unknown as Parameters<typeof publicLoader>[0]);
    expect(res.status).toBe(404);
  });
});
