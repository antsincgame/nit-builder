import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * /templates — публичная галерея community-шаблонов.
 *
 * Тесты обновлены под PublicTemplatesGallery v3 (лендинг-эстетика):
 *   "▲ N" → lucide ChevronUp + text N внутри button[aria-label="Проголосовать…"]
 */

vi.mock("~/lib/stores/userTemplatesStore", () => ({
  listPublicTemplates: vi.fn(),
  getPublicTemplate: vi.fn(),
  voteTemplate: vi.fn(),
  hasVotedFor: vi.fn(() => false),
  markVotedFor: vi.fn(),
}));

vi.mock("~/lib/stores/toastStore", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
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

const originalLocation = window.location;

beforeEach(() => {
  mockedList.mockReset();
  mockedGet.mockReset();
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    writable: true,
    value: { href: "" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
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
    // votes-кнопки: lucide ChevronUp + текст votes внутри button[aria-label]
    const voteButtons = screen.getAllByLabelText("Проголосовать за шаблон");
    expect(voteButtons).toHaveLength(2);
    expect(voteButtons[0]!.textContent).toContain("5");
    expect(voteButtons[1]!.textContent).toContain("0");
    // Счётчик плюраль: 2 → "шаблона" (templates.length < 5)
    expect(screen.getByText(/2 шаблона/)).toBeInTheDocument();
  });

  it("показывает empty-state когда галерея пустая", async () => {
    mockedList.mockResolvedValue([]);

    render(<PublicTemplatesGallery />);

    await waitFor(() => {
      expect(screen.getByText("Пока пусто")).toBeInTheDocument();
    });
    expect(screen.getByText(/Создать сайт/)).toBeInTheDocument();
  });

  it("показывает error-state когда listPublicTemplates бросает", async () => {
    mockedList.mockRejectedValue(new Error("network fail"));

    render(<PublicTemplatesGallery />);

    await waitFor(() => {
      expect(screen.getByText(/Не удалось загрузить шаблоны/)).toBeInTheDocument();
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
      const stored = sessionStorage.getItem("nit-pending-template");
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual({
        id: "t1",
        name: "Coffee public",
        prompt: "лендинг кофейни",
        html: "<html>full content</html>",
      });
      expect(window.location.href).toBe("/");
    });
  });

  it("клик по удалённому шаблону: toast.error + локальное удаление из UI", async () => {
    mockedList.mockResolvedValue(sampleTemplates);
    mockedGet.mockResolvedValue(null);

    render(<PublicTemplatesGallery />);
    await waitFor(() => screen.getByText("Coffee public"));

    await userEvent.click(screen.getByText("Coffee public"));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("t1");
      expect(screen.queryByText("Coffee public")).not.toBeInTheDocument();
      expect(screen.getByText("Barber public")).toBeInTheDocument();
      expect(sessionStorage.getItem("nit-pending-template")).toBeNull();
    });
  });
});
