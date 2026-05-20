import { useState, useCallback } from "react";
import { saveMyTemplate } from "~/lib/stores/userTemplatesStore";
import { toast } from "~/lib/stores/toastStore";

type SaveAsTemplateDialogProps = {
  isOpen: boolean;
  html: string;
  prompt: string;
  onClose: () => void;
};

type DialogState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; id: string }
  | { kind: "error"; message: string; isLimit: boolean };

/**
 * SaveAsTemplateDialog v2 — русский, на «вы», без техно-префиксов.
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
      toast.error("Введите название");
      return;
    }
    if (trimmed.length > 128) {
      toast.error("Название слишком длинное");
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
    setName("");
    setState({ kind: "idle" });
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md p-6 relative rounded-2xl"
        style={{ background: "var(--bg-2)", border: "1px solid var(--line-strong)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition"
          style={{ color: "var(--muted)" }}
          aria-label="Закрыть"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        <h3 className="nit-display mb-2" style={{ fontSize: 20, color: "var(--ink)" }}>
          Сохранить как шаблон
        </h3>
        <p className="text-[14px] mb-5" style={{ color: "var(--muted)", lineHeight: 1.55 }}>
          Сохраните этот сайт в свою библиотеку — потом сможете использовать
          его как основу для новых проектов. Видите только вы.
        </p>

        {state.kind === "saved" ? (
          <div className="space-y-3">
            <div
              className="p-3 text-[14px] rounded-lg flex items-center gap-3"
              style={{
                border: "1px solid var(--green)",
                background: "rgba(34, 197, 94, 0.06)",
                color: "var(--ink)",
              }}
            >
              <span style={{ color: "var(--green)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              «{name.trim()}» добавлен в вашу библиотеку.
            </div>
            <button type="button" onClick={handleClose} className="btn-ghost w-full" style={{ padding: "12px 22px" }}>
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <label className="block mb-4">
              <span className="block text-[13px] mb-2" style={{ color: "var(--ink-dim)" }}>
                Название
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={128}
                disabled={state.kind === "saving"}
                placeholder="Например: лендинг кофейни"
                className="w-full px-3 py-2.5 text-[14px] outline-none rounded-lg"
                style={{
                  background: "var(--bg)",
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
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--cyan)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--line-strong)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <span className="block text-[12px] mt-1" style={{ color: "var(--muted-2)" }}>
                {name.length} / 128
              </span>
            </label>

            {state.kind === "error" && (
              <div
                className="p-3 mb-4 text-[13px] rounded-lg"
                style={{
                  border: "1px solid var(--pink)",
                  background: "rgba(244, 114, 182, 0.06)",
                  color: "var(--pink)",
                }}
              >
                {state.isLimit
                  ? "Достигнут лимит 50 шаблонов. Удалите неиспользуемые."
                  : `Ошибка: ${state.message}`}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={state.kind === "saving" || name.trim().length === 0}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: "12px 22px" }}
            >
              {state.kind === "saving" ? "Сохраняем…" : "Сохранить"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
