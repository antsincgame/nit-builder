import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * MyTemplatesPanel — drawer со списком пользовательских шаблонов
 * (v2.1 Save as Template follow-up). Покрывает:
 *   - render списка из listMyTemplates
 *   - empty state
 *   - error state при throw
 *   - клик по карточке → getMyTemplate → onUse(full)
 *   - delete → deleteMyTemplate + удаление из UI
 *   - не рендерится при isOpen=false
 */

vi.mock("~/lib/stores/userTemplatesStore", () => ({
  listMyTemplates: vi.fn(),
  getMyTemplate: vi.fn(),
  deleteMyTemplate: vi.fn(),
}));

vi.mock("~/lib/stores/toastStore", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { MyTemplatesPanel } from "~/components/simple/MyTemplatesPanel";
import {
  listMyTemplates,
  getMyTemplate,
  deleteMyTemplate,
} from "~/lib/stores/userTemplatesStore";

const mockedList = listMyTemplates as unknown as ReturnType<typeof vi.fn>;
const mockedGet = getMyTemplate as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = deleteMyTemplate as unknown as ReturnType<typeof vi.fn>;

const sampleTemplates = [
  {
    id: "t1",
    name: "Coffee dark",
    prompt: "лендинг кофейни, dark mode",
    createdAt: "2026-05-18T10:00:00Z",
    isPublic: false,
    votes: 0,
    hasZones: true,
  },
  {
    id: "t2",
    name: "Barber neon",
    prompt: null,
    createdAt: "2026-05-17T10:00:00Z",
    isPublic: false,
    votes: 0,
    hasZones: false,
  },
];

beforeEach(() => {
  mockedList.mockReset();
  mockedGet.mockReset();
  mockedDelete.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MyTemplatesPanel", () => {
  it("не рендерится при isOpen=false (не вызывает list)", () => {
    mockedList.mockResolvedValue([]);
    const { container } = render(
      <MyTemplatesPanel isOpen={false} onClose={() => {}} onUse={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("отображает список шаблонов после загрузки", async () => {
    mockedList.mockResolvedValue(sampleTemplates);

    render(
      <MyTemplatesPanel isOpen={true} onClose={() => {}} onUse={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Coffee dark")).toBeInTheDocument();
      expect(screen.getByText("Barber neon")).toBeInTheDocument();
    });
    // prompt отображается у t1, нет у t2 (null)
    expect(screen.getByText("лендинг кофейни, dark mode")).toBeInTheDocument();
    // zones badge у t1 (hasZones=true), нет у t2
    expect(screen.getAllByText("zones")).toHaveLength(1);
    // Footer показывает счётчик
    expect(screen.getByText(/2 \/ 50/)).toBeInTheDocument();
  });

  it("показывает empty-state когда шаблонов нет", async () => {
    mockedList.mockResolvedValue([]);

    render(
      <MyTemplatesPanel isOpen={true} onClose={() => {}} onUse={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByText("NO TEMPLATES")).toBeInTheDocument();
    });
  });

  it("error-state когда listMyTemplates бросает", async () => {
    mockedList.mockRejectedValue(new Error("network fail"));

    render(
      <MyTemplatesPanel isOpen={true} onClose={() => {}} onUse={() => {}} />,
    );

    await waitFor(() => {
      // Header показывает "error" в счётчике
      expect(screen.getByText("error")).toBeInTheDocument();
    });
  });

  it("клик по карточке вызывает getMyTemplate и onUse с full template", async () => {
    mockedList.mockResolvedValue(sampleTemplates);
    const fullTemplate = {
      id: "t1",
      name: "Coffee dark",
      prompt: "лендинг кофейни, dark mode",
      html: "<html>full content</html>",
      zones: '[{"id":"hero"}]',
      isPublic: false,
      votes: 0,
      createdAt: "2026-05-18T10:00:00Z",
    };
    mockedGet.mockResolvedValue(fullTemplate);

    const onUse = vi.fn();
    const onClose = vi.fn();
    render(
      <MyTemplatesPanel isOpen={true} onClose={onClose} onUse={onUse} />,
    );

    await waitFor(() => screen.getByText("Coffee dark"));
    await userEvent.click(screen.getByText("Coffee dark"));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith("t1");
      expect(onUse).toHaveBeenCalledWith(fullTemplate);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("delete-кнопка вызывает deleteMyTemplate и убирает карточку из UI", async () => {
    mockedList.mockResolvedValue(sampleTemplates);
    mockedDelete.mockResolvedValue(true);

    render(
      <MyTemplatesPanel isOpen={true} onClose={() => {}} onUse={() => {}} />,
    );

    await waitFor(() => screen.getByText("Coffee dark"));
    // Delete-кнопки рендерятся с aria-label, ищем по нему
    const deleteButtons = screen.getAllByLabelText("Удалить шаблон");
    expect(deleteButtons).toHaveLength(2);

    // stopPropagation нужен — мокаем event через fireEvent
    fireEvent.click(deleteButtons[0]!);

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith("t1");
      expect(screen.queryByText("Coffee dark")).not.toBeInTheDocument();
      expect(screen.getByText("Barber neon")).toBeInTheDocument();
    });
  });

  it("backdrop click закрывает drawer", async () => {
    mockedList.mockResolvedValue([]);
    const onClose = vi.fn();

    const { container } = render(
      <MyTemplatesPanel isOpen={true} onClose={onClose} onUse={() => {}} />,
    );

    await waitFor(() => screen.getByText("NO TEMPLATES"));
    // Outer fixed-inset div — backdrop
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
