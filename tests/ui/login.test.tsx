import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "~/routes/login";
import { AuthProvider } from "~/lib/contexts/AuthContext";

/**
 * Login page (v5 — passwordless magic-link).
 *
 * Тесты переписаны под magic-link flow: email → POST /api/auth/request-magic-link
 * → экран «проверьте почту». Пароли больше не запрашиваются.
 */

const originalFetch = globalThis.fetch;
let originalLocation: Location;
let mockHref = "";

beforeEach(() => {
  originalLocation = window.location;
  mockHref = "";
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      ...originalLocation,
      get href() {
        return mockHref || originalLocation.href;
      },
      set href(v: string) {
        mockHref = v;
      },
    },
  });

  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ authenticated: false }), { status: 200 }),
  );
  window.localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

describe("Login page (magic-link)", () => {
  it("рендерит email поле и кнопку отправки ссылки", async () => {
    render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Отправить ссылку/i }),
    ).toBeInTheDocument();
  });

  it("успешный запрос ссылки шлёт правильный POST и показывает экран «проверьте почту»", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false })),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/email/i),
      "alice@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: /Отправить ссылку/i }),
    );

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => c[0] === "/api/auth/request-magic-link",
      );
      expect(call).toBeDefined();
      expect(call![1]).toMatchObject({
        method: "POST",
        credentials: "include",
      });
      const body = JSON.parse(call![1].body as string);
      expect(body).toEqual({ email: "alice@example.com" });
    });

    expect(
      await screen.findByText(/Проверьте почту/i),
    ).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("показывает ошибку от сервера при невалидном email", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false })),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Проверьте правильность email" }),
        { status: 400 },
      ),
    );
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    // Браузерная HTML5-валидация пропустит формат — вводим валидный email
    // но мокаем 400 от сервера (например домен в блек-листе).
    await user.type(await screen.findByLabelText(/email/i), "bad@blocked.com");
    await user.click(
      screen.getByRole("button", { name: /Отправить ссылку/i }),
    );

    expect(
      await screen.findByText(/Проверьте правильность email/i),
    ).toBeInTheDocument();
  });

  it("показывает дружелюбную ошибку при network failure", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false })),
    );
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email/i), "x@y.z");
    await user.click(
      screen.getByRole("button", { name: /Отправить ссылку/i }),
    );

    expect(await screen.findByText(/Ошибка сети/i)).toBeInTheDocument();
  });

  it("редиректит на /app если юзер уже authenticated", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          authenticated: true,
          userId: "u-1",
          email: "alice@example.com",
        }),
      ),
    );

    render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockHref).toBe("/app");
    });
  });

  it("кнопка disabled пока поле email пустое", async () => {
    render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    const btn = await screen.findByRole("button", {
      name: /Отправить ссылку/i,
    });
    expect(btn).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "x@y.z");
    expect(btn).not.toBeDisabled();
  });

  it("disabled state кнопки во время loading", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false })),
    );
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email/i), "x@y.z");
    const btn = screen.getByRole("button", { name: /Отправить ссылку/i });
    await user.click(btn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Отправляем/i }),
      ).toBeDisabled();
    });
  });
});
