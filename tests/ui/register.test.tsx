import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import Register from "~/routes/register";

/**
 * Register page (v5 — magic-link era).
 *
 * Регистрация теперь автоматическая через magic-link: при первом успешном
 * входе с новым email создаётся аккаунт. Отдельной страницы регистрации
 * больше нет — /register просто редиректит на /login.
 */

let originalLocation: Location;
let mockReplaced = "";

beforeEach(() => {
  originalLocation = window.location;
  mockReplaced = "";
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      ...originalLocation,
      replace: (url: string) => {
        mockReplaced = url;
      },
    },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

describe("Register page (magic-link era)", () => {
  it("редиректит на /login через window.location.replace", () => {
    render(<Register />);
    expect(mockReplaced).toBe("/login");
  });

  it("не рендерит контента", () => {
    const { container } = render(<Register />);
    // Компонент возвращает null
    expect(container.firstChild).toBeNull();
  });
});
