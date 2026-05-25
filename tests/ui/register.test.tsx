import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Register from "~/routes/register";
import { AuthProvider } from "~/lib/contexts/AuthContext";

/**
 * Register page — одношаговый flow (v2):
 *   email + password + confirmPassword → POST /api/auth/register →
 *   sessionStorage.setItem('tunnelToken', …) + redirect на /app.
 *
 * Изменения vs v1:
 *  - Убрано поле «Name» (не рендерится)
 *  - Добавлено "Повторите пароль"
 *  - Нет больше экрана token-reveal — токен пишется в sessionStorage
 *  - Кнопка "Зарегистрироваться" / loading "Создаём аккаунт…"
 */

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
  window.sessionStorage.clear();
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

describe("Register page", () => {
  it("рендерит email/password/confirmPassword поля", async () => {
    render(
      <AuthProvider>
        <Register />
      </AuthProvider>,
    );

    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Пароль$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Повторите пароль/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зарегистрироваться/i })).toBeInTheDocument();
  });

  it("client-side: пароль < 8 символов даёт ошибку без fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false })),
    );
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Register />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email/i), "alice@example.com");
    const pw = screen.getByLabelText(/^Пароль$/i) as HTMLInputElement;
    const pw2 = screen.getByLabelText(/Повторите пароль/i) as HTMLInputElement;
    pw.removeAttribute("minLength");
    pw2.removeAttribute("minLength");
    await user.type(pw, "short");
    await user.type(pw2, "short");
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    expect(await screen.findByText(/не меньше 8 символов/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.find((c) => c[0] === "/api/auth/register"),
    ).toBeUndefined();
  });

  it("даёт ошибку когда пароли не совпадают", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false })),
    );
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Register />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^Пароль$/i), "secret-1234");
    await user.type(screen.getByLabelText(/Повторите пароль/i), "secret-4321");
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    expect(await screen.findByText(/Пароли не совпадают/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.find((c) => c[0] === "/api/auth/register"),
    ).toBeUndefined();
  });

  it("успешная регистрация: пишет tunnelToken в sessionStorage и редирект /app", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false })),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          userId: "u-1",
          email: "alice@example.com",
          tunnelToken: "nit_aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
        }),
        { status: 201 },
      ),
    );
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Register />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^Пароль$/i), "secret-1234");
    await user.type(screen.getByLabelText(/Повторите пароль/i), "secret-1234");
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    // Проверяем POST был отправлен с правильным body (email + password, без confirmPassword)
    await vi.waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => c[0] === "/api/auth/register");
      expect(call).toBeDefined();
      const body = JSON.parse(call![1].body as string);
      expect(body).toEqual({ email: "alice@example.com", password: "secret-1234" });
    });

    // tunnelToken сохранён в sessionStorage
    await vi.waitFor(() => {
      expect(sessionStorage.getItem("tunnelToken")).toBe(
        "nit_aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
      );
    });

    // Редирект на /app
    await vi.waitFor(() => {
      expect(mockHref).toBe("/app");
    });
  });

  it("показывает server-side validation ошибку (issues)", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false })),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Validation failed",
          issues: { email: ["Неверный формат email"] },
        }),
        { status: 400 },
      ),
    );
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Register />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^Пароль$/i), "secret-1234");
    await user.type(screen.getByLabelText(/Повторите пароль/i), "secret-1234");
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    expect(await screen.findByText(/Неверный формат email/i)).toBeInTheDocument();
  });

  it("показывает 'уже зарегистрирован' при 409", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false })),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Пользователь с таким email уже зарегистрирован" }),
        { status: 409 },
      ),
    );
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <Register />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^Пароль$/i), "secret-1234");
    await user.type(screen.getByLabelText(/Повторите пароль/i), "secret-1234");
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    expect(
      await screen.findByText(/уже зарегистрирован/i),
    ).toBeInTheDocument();
  });
});
