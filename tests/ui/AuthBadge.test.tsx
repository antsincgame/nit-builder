import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthBadge } from "~/components/simple/AuthBadge";
import { AuthProvider } from "~/lib/contexts/AuthContext";
import type { AuthState } from "~/lib/contexts/AuthContext";

/**
 * AuthBadge — три состояния (loading / unauthenticated / authenticated).
 *
 * Тесты обновлены под AuthBadge v4 (passwordless era):
 *   unauthenticated state теперь одна кнопка «Войти» → /login (раньше
 *   было «Войти» + «Регистрация» → /register).
 */

const authedState: AuthState = {
  status: "authenticated",
  userId: "user-123",
  email: "alice@example.com",
  tunnelTokenCreatedAt: null,
  tunnel: { status: "online", activeTunnels: 1 },
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("AuthBadge", () => {
  it("в состоянии loading показывает skeleton placeholder", () => {
    render(
      <AuthProvider>
        <AuthBadge auth={{ status: "loading" }} onOpenSettings={() => {}} />
      </AuthProvider>,
    );
    expect(screen.queryByText(/Войти/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("в unauthenticated показывает одну кнопку Войти → /login", () => {
    render(
      <AuthProvider>
        <AuthBadge
          auth={{ status: "unauthenticated" }}
          onOpenSettings={() => {}}
        />
      </AuthProvider>,
    );

    const login = screen.getByText("Войти");
    expect(login).toBeInTheDocument();
    expect(login.closest("a")).toHaveAttribute("href", "/login");
    // Регистрация больше не отображается отдельно — magic-link era
    expect(screen.queryByText(/Регистрация/)).not.toBeInTheDocument();
  });

  it("в authenticated показывает первую букву email и сам email", () => {
    render(
      <AuthProvider>
        <AuthBadge auth={authedState} onOpenSettings={() => {}} />
      </AuthProvider>,
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("dropdown menu открывается по клику и закрывается клик-вне", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <div>
          <AuthBadge auth={authedState} onOpenSettings={() => {}} />
          <div data-testid="outside">outside</div>
        </div>
      </AuthProvider>,
    );

    expect(screen.queryByText(/Выйти/i)).not.toBeInTheDocument();

    const trigger = screen.getByTitle(/Вы вошли как alice@example.com/);
    await user.click(trigger);

    expect(screen.getByText(/Вы вошли как/i)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    await waitFor(() => {
      expect(screen.queryByText(/Вы вошли как/i)).not.toBeInTheDocument();
    });
  });

  it("Settings кнопка зовёт onOpenSettings и закрывает меню", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <AuthProvider>
        <AuthBadge auth={authedState} onOpenSettings={onOpenSettings} />
      </AuthProvider>,
    );

    await user.click(screen.getByTitle(/Вы вошли как/));
    const settingsBtn = await screen.findByText(/^Настройки$/i);
    await user.click(settingsBtn);

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Вы вошли как/i)).not.toBeInTheDocument();
  });

  it("logout шлёт POST /api/auth/logout с credentials и refetch'ит auth", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: true, userId: "u", email: "alice@example.com" })),
    );
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false })),
    );
    globalThis.fetch = fetchMock;

    render(
      <AuthProvider>
        <AuthBadge auth={authedState} onOpenSettings={() => {}} />
      </AuthProvider>,
    );

    await user.click(screen.getByTitle(/Вы вошли как/));
    const logoutBtn = await screen.findByText(/^Выйти$/i);
    await user.click(logoutBtn);

    await waitFor(() => {
      const logoutCall = fetchMock.mock.calls.find(
        (c) => c[0] === "/api/auth/logout",
      );
      expect(logoutCall).toBeDefined();
      expect(logoutCall![1]).toMatchObject({
        method: "POST",
        credentials: "include",
      });
    });
  });
});
