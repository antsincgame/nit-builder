import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Тесты на v2.2 Phase 3 endpoints:
 *   - POST /api/public-templates/:id/vote — без auth
 *   - POST /api/user-templates/:id/submit — с auth, ownership check
 */

vi.mock("~/lib/server/appwrite.server", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/server/appwrite.server")
  >("~/lib/server/appwrite.server");
  return {
    ...actual,
    voteForTemplate: vi.fn(),
    getUserTemplate: vi.fn(),
    logGeneration: vi.fn(),
  };
});

vi.mock("~/lib/server/requireAuth.server", () => ({
  getAuth: vi.fn(),
}));

import { action as voteAction } from "~/routes/api.public-templates.$id.vote";
import { action as submitAction } from "~/routes/api.user-templates.$id.submit";
import {
  voteForTemplate,
  getUserTemplate,
  logGeneration,
} from "~/lib/server/appwrite.server";
import { getAuth } from "~/lib/server/requireAuth.server";

const mockedVote = voteForTemplate as unknown as ReturnType<typeof vi.fn>;
const mockedGetUserTemplate = getUserTemplate as unknown as ReturnType<typeof vi.fn>;
const mockedLogGeneration = logGeneration as unknown as ReturnType<typeof vi.fn>;
const mockedGetAuth = getAuth as unknown as ReturnType<typeof vi.fn>;

function makeReq(
  url: string,
  opts?: { method?: string; body?: unknown },
): Request {
  return new Request(`http://localhost${url}`, {
    method: opts?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

beforeEach(() => {
  mockedVote.mockReset();
  mockedGetUserTemplate.mockReset();
  mockedLogGeneration.mockReset();
  mockedGetAuth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/public-templates/:id/vote", () => {
  it("up vote: 200 + новое значение votes", async () => {
    mockedVote.mockResolvedValue(6);
    const req = makeReq("/api/public-templates/t1/vote", {
      method: "POST",
      body: { direction: "up" },
    });
    const res = await voteAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof voteAction>[0]);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(200);
    expect(body.votes).toBe(6);
    expect(mockedVote).toHaveBeenCalledWith("t1", 1);
  });

  it("down vote: передаёт delta=-1", async () => {
    mockedVote.mockResolvedValue(4);
    const req = makeReq("/api/public-templates/t1/vote", {
      method: "POST",
      body: { direction: "down" },
    });
    await voteAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof voteAction>[0]);
    expect(mockedVote).toHaveBeenCalledWith("t1", -1);
  });

  it("404 если voteForTemplate вернул null (шаблон не публичный)", async () => {
    mockedVote.mockResolvedValue(null);
    const req = makeReq("/api/public-templates/t-bad/vote", {
      method: "POST",
      body: { direction: "up" },
    });
    const res = await voteAction({
      request: req,
      params: { id: "t-bad" },
      context: {},
    } as unknown as Parameters<typeof voteAction>[0]);
    expect((res as Response).status).toBe(404);
  });

  it("400 на невалидный direction", async () => {
    const req = makeReq("/api/public-templates/t1/vote", {
      method: "POST",
      body: { direction: "sideways" },
    });
    const res = await voteAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof voteAction>[0]);
    expect((res as Response).status).toBe(400);
    expect(mockedVote).not.toHaveBeenCalled();
  });

  it("400 на отсутствующий id", async () => {
    const req = makeReq("/api/public-templates//vote", {
      method: "POST",
      body: { direction: "up" },
    });
    const res = await voteAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof voteAction>[0]);
    expect((res as Response).status).toBe(400);
  });

  it("405 на GET", async () => {
    const req = makeReq("/api/public-templates/t1/vote", { method: "GET" });
    const res = await voteAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof voteAction>[0]);
    expect((res as Response).status).toBe(405);
  });
});

describe("POST /api/user-templates/:id/submit", () => {
  const authedUser = { userId: "u1", email: "u1@test.com" };

  it("успех: 200 + logGeneration с submit-префиксом", async () => {
    mockedGetAuth.mockResolvedValue(authedUser);
    mockedGetUserTemplate.mockResolvedValue({
      $id: "t1",
      userId: "u1",
      name: "Test",
      html: "<html/>",
      isPublic: false,
      votes: 0,
    });
    mockedLogGeneration.mockResolvedValue(undefined);

    const req = makeReq("/api/user-templates/t1/submit", { method: "POST" });
    const res = await submitAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof submitAction>[0]);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(200);
    expect(body.submitted).toBe(true);
    expect(mockedLogGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        templateId: "submit:t1",
      }),
    );
  });

  it("401 без auth", async () => {
    mockedGetAuth.mockResolvedValue(null);
    const req = makeReq("/api/user-templates/t1/submit", { method: "POST" });
    const res = await submitAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof submitAction>[0]);
    expect((res as Response).status).toBe(401);
    expect(mockedLogGeneration).not.toHaveBeenCalled();
  });

  it("404 если шаблон чужой / не существует", async () => {
    mockedGetAuth.mockResolvedValue(authedUser);
    mockedGetUserTemplate.mockResolvedValue(null);

    const req = makeReq("/api/user-templates/t-bad/submit", { method: "POST" });
    const res = await submitAction({
      request: req,
      params: { id: "t-bad" },
      context: {},
    } as unknown as Parameters<typeof submitAction>[0]);
    expect((res as Response).status).toBe(404);
    expect(mockedLogGeneration).not.toHaveBeenCalled();
  });

  it("400 если шаблон уже public", async () => {
    mockedGetAuth.mockResolvedValue(authedUser);
    mockedGetUserTemplate.mockResolvedValue({
      $id: "t1",
      userId: "u1",
      name: "Test",
      html: "<html/>",
      isPublic: true,
      votes: 5,
    });

    const req = makeReq("/api/user-templates/t1/submit", { method: "POST" });
    const res = await submitAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof submitAction>[0]);
    expect((res as Response).status).toBe(400);
    expect(mockedLogGeneration).not.toHaveBeenCalled();
  });

  it("400 на missing id", async () => {
    mockedGetAuth.mockResolvedValue(authedUser);
    const req = makeReq("/api/user-templates//submit", { method: "POST" });
    const res = await submitAction({
      request: req,
      params: {},
      context: {},
    } as unknown as Parameters<typeof submitAction>[0]);
    expect((res as Response).status).toBe(400);
  });

  it("405 на GET", async () => {
    mockedGetAuth.mockResolvedValue(authedUser);
    const req = makeReq("/api/user-templates/t1/submit", { method: "GET" });
    const res = await submitAction({
      request: req,
      params: { id: "t1" },
      context: {},
    } as unknown as Parameters<typeof submitAction>[0]);
    expect((res as Response).status).toBe(405);
  });
});
