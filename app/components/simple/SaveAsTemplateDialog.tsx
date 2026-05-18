import { useState, useCallback } from "react";
import { saveMyTemplate } from "~/lib/stores/userTemplatesStore";
import { toast } from "~/lib/stores/toastStore";

type SaveAsTemplateDialogProps = {
  isOpen: boolean;
  /** HTML текущего сайта (полный документ). */
  html: string;
  /** Prompt из которого сайт был сгенерирован — пробрасывается в шаблон для контекста. */
  prompt: string;
  onClose: () => void;
};

type DialogState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; id: string }
  | { kind: "error"; message: string; isLimit: boolean };

/**
 * Модалка "Save as Template" (v2.1).
 *
 * Юзер вводит имя, жмёт submit → POST /api/user-templates → шаблон сохраняется
 * в его приватную коллекцию nit_user_templates в Appwrite. Дальше шаблон
 * можно будет использовать как стартовую точку для новых сайтов (v2.2 —
 * promote в public gallery).
 *
 * Сейчас zones не extract'им (оставляем поле пустым) — это полезный
 * follow-up для v2.2 smart re-use, но не блокирует MVP-флоу сохранения.
 *
 * Имя обязательное (min 1, max 128) — Zod на сервере дублирует валидацию,
 * клиент даёт мгновенный feedback. Лимит 50 шаблонов/юзер — при превышении
 * сервер вернёт 403 с code=LIMIT_EXCEEDED, UI показывает понятный текст.
 */
export function SaveAsTemplateDialog({
  isOpen,
  html,
  prompt,
  onClose,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState("");
  const [state, setState] = useState<DialogState>({ kind: "idle" });

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("Введите название шаблона");
      return;
    }
    if (trimmed.length > 128) {
      toast.error("Название не должно быть длиннее 128 символов");
      return;
    }
    setState({ kind: "saving" });
    const result = await saveMyTemplate({
      name: trimmed,
      html,
      prompt: prompt || undefined,
    });
    if (result.ok) {
      setState({ kind: "saved", id: result.id });
      toast.success("Шаблон сохранён");
    } else {
      setState({
        kind: "error",
        message: result.error,
        isLimit: result.code === "LIMIT_EXCEEDED",
      });
    }
  }, [name, html, prompt]);

  const handleClose = useCallback(() => {
    // Reset state — следующее открытие начнёт с idle
    setName("");
    setState({ kind: "idle" });
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md p-6 relative"
        style={{ background: "var(--bg)", border: "1px solid var(--line-strong)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 text-[14px] text-[color:var(--muted)] hover:text-[color:var(--ink)]"
          aria-label="Закрыть"
        >
          ✕
        </button>

        <h3 className="nit-display text-[18px] mb-2 text-[color:var(--ink)]">
          Сохранить как шаблон
        </h3>
        <p className="text-[12px] text-[color:var(--muted)] mb-5 leading-[1.6]">
          Сохрани этот сайт в свою библиотеку шаблонов. Позже сможешь
          использовать его как стартовую точку для новых проектов.
          Видишь только ты — пока без публичной галереи.
        </p>

        {state.kind === "saved" ? (
          <div className="space-y-3">
            <div className="text-[10px] tracking-[0.2em] uppercase text-[color:var(--accent-glow)]">
              ⏵ Saved
            </div>
            <div
              className="p-3 text-[12px]"
              style={{
                border: "1px solid var(--line-strong)",
                background: "var(--bg-glass)",
                color: "var(--ink)",
              }}
            >
              «{name.trim()}» добавлен в твою библиотеку шаблонов.
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full px-4 py-3 text-[11px] font-bold tracking-[0.2em] uppercase transition"
              style={{ border: "1px solid var(--line-strong)", color: "var(--ink)" }}
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <label className="block mb-4">
              <span className="block text-[10px] tracking-[0.15em] uppercase text-[color:var(--muted)] mb-2">
                Название
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={128}
                disabled={state.kind === "saving"}
                placeholder="Лендинг кофейни, dark mode"
                className="w-full px-3 py-2 text-[13px] bg-transparent outline-none"
                style={{
                  border: "1px solid var(--line-strong)",
                  color: "var(--ink)",
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              <span className="block text-[10px] text-[color:var(--muted-2)] mt-1">
                {name.length} / 128
              </span>
            </label>

            {state.kind === "error" && (
              <div
                className="p-3 mb-4 text-[12px]"
                style={{
                  border: `1px solid var(--magenta)`,
                  color: "var(--magenta)",
                }}
              >
                {state.isLimit ? (
                  <>
                    Достигнут лимит 50 шаблонов. Удали неиспользуемые из
                    библиотеки.
                  </>
                ) : (
                  <>Ошибка: {state.message}</>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={state.kind === "saving" || name.trim().length === 0}
              className="w-full px-4 py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--accent)" }}
            >
              {state.kind === "saving" ? "// saving..." : "⏵ Сохранить"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
