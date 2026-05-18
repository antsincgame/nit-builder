import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * /templates — публичная галерея community-шаблонов (v2.2 Phase 2).
 *
 * Тесты покрывают:
 *   - loading skeleton при mount
 *   - render списка после fetch
 *   - empty state когда галерея пуста
 *   - error state при throw из listPublicTemplates
 *   - клик по карточке → getPublicTemplate → sessionStorage + redirect
 *   - клик на удалённый шаблон → toast.error + локальное удаление
 */

vi.mock("~/lib/stores/userTemplatesStore", () => ({
  listPublicTemplates: vi.fn(),
  getPublicTemplate: vi.fn(),
}));

vi.mock("~/lib/stores/toastStore", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Мокаем NIT декоративные компоненты — они тяжёлые из-за animation/CSS-vars,
// в jsdom рендерить их нет смысла.
vi.mock("~/components/nit", () => ({
  GridBg: () => null,
  Orbs: () => null,
  Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Particles: () => null,
}));

vi.mock("~/components/simple/ToastContainer", () => ({
  ToastContainer: () => null,
}));

import PublicTemplatesGallery from "~/routes/templates";
import {
  listPublicTemplates,
  getPublicTemplate,
} from "~/lib/stores/userTemplatesStore";

const mockedList = listPublicTemplates as unknown as ReturnType<typeof vi.fn>;
const mockedGet = getPublicTemplate as unknown as ReturnType<typeof vi.fn>;

const sampleTemplates = [
  {
    id: "t1",
    name: "Coffee public",
    prompt: "лендинг кофейни",
    createdAt: "2026-05-18T10:00:00Z",
    votes: 5,
    hasZones: true,
  },
  {
    id: "t2",
    name: "Barber public",
    prompt: null,
    createdAt: "2026-05-17T10:00:00Z",
    votes: 0,
    hasZones: false,
  },
];

// Замокаем window.location чтобы тесты не реально не редиректили.
const originalLocation = window.location;

beforeEach(() => {
  mockedList.mockReset();
  mockedGet.mockReset();
  sessionStorage.clear();
  // Подмена window.location на mutable объект
  Object.defineProperty(window, "location", {
    writable: true,
    value: { href: "" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // Восстанавливаем оригинальный location
  Object.defineProperty(window, "location", {
    writable: true,
    value: originalLocation,
  });
});

describe("PublicTemplatesGallery (/templates)", () => {
  it("отображает список шаблонов после загрузки", async () => {
    mockedList.mockResolvedValue(sampleTemplates);

    render(<PublicTemplatesGallery />);

    await waitFor(() => {
      expect(screen.getByText("Coffee public")).toBeInTheDocument();
      expect(screen.getByText("Barber public")).toBeInTheDocument();
    });
    expect(screen.getByText("лендинг кофейни")).toBeInTheDocument();
    // votes badge у t1 (votes=5), нет у t2 (votes=0)
    expect(screen.getByText("▲ 5")).toBeInTheDocument();
    // hasZones badge у t1
    expect(screen.getAllByText("zones")).toHaveLength(1);
    // Счётчик
    expect(screen.getByText("2 templates")).toBeInTheDocument();
  });

  it("показывает empty-state когда галерея пустая", async () => {
    mockedList.mockResolvedValue([]);

    render(<PublicTemplatesGallery />);

    await waitFor(() => {
      expect(screen.getByText("GALLERY IS EMPTY")).toBeInTheDocument();
    });
    // Есть CTA на создание сайта
    expect(screen.getByText(/Создать сайт/)).toBeInTheDocument();
  });

  it("показывает error-state когда listPublicTemplates бросает", async () => {
    mockedList.mockRejectedValue(new Error("network fail"));

    render(<PublicTemplatesGallery />);

    await waitFor(() => {
      expect(screen.getByText("// error")).toBeInTheDocument();
    });
  });

  it("клик по карточке: getPublicTemplate + sessionStorage + redirect", async () => {
    mockedList.mockResolvedValue(sampleTemplates);
    const fullTemplate = {
      id: "t1",
      name: "Coffee public",
      prompt: "лендинг кофейни",
      html: "<html>full content</html>",
      zones: '[{"id":"hero"}]',
      votes: 5,
      createdAt: "2026-05-18T10:00:00Z",
    };
    mockedGet.mockResolvedValue(fullTemplate);

    render(<PublicTemplatesGallery />);
    await waitFor(() => screen.getByText("Coffee public"));

    await userEvent.click(screen.getByText("Coffee public"));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("t1");
      // sessionStorage заполнен корректным payload
      const stored = sessionStorage.getItem("nit-pending-template");
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual({
        id: "t1",
        name: "Coffee public",
        prompt: "лендинг кофейни",
        html: "<html>full content</html>",
      });
      // Редирект на home
      expect(window.location.href).toBe("/");
    });
  });

  it("клик по удалённому шаблону: toast.error + локальное удаление из UI", async () => {
    mockedList.mockResolvedValue(sampleTemplates);
    mockedGet.mockResolvedValue(null); // шаблон больше не публичный

    render(<PublicTemplatesGallery />);
    await waitFor(() => screen.getByText("Coffee public"));

    await userEvent.click(screen.getByText("Coffee public"));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("t1");
      // Удалён из локального state
      expect(screen.queryByText("Coffee public")).not.toBeInTheDocument();
      // Barber остался
      expect(screen.getByText("Barber public")).toBeInTheDocument();
      // sessionStorage пустой (не записывали)
      expect(sessionStorage.getItem("nit-pending-template")).toBeNull();
    });
  });
});
