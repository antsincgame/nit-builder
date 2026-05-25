import { useState, useCallback } from "react";
import { X, Check } from "lucide-react";
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
 * SaveAsTemplateDialog v3 — эстетика лендинга: чёрный модал, emerald-CTA.
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
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md p-6 relative rounded-2xl bg-[#0A0A0A] border border-white/[0.08] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-white hover:bg-white/[0.04] transition"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>

        <h3 className="text-xl font-semibold tracking-tight text-white mb-2">
          Сохранить как шаблон
        </h3>
        <p className="text-sm mb-5 text-[#A1A1AA] leading-relaxed">
          Сохраните этот сайт в свою библиотеку — потом сможете использовать
          его как основу для новых проектов. Видите только вы.
        </p>

        {state.kind === "saved" ? (
          <div className="space-y-3">
            <div className="p-3 text-sm rounded-lg flex items-center gap-3 border border-emerald-500/30 bg-emerald-500/[0.06] text-white">
              <Check size={18} className="text-emerald-400 shrink-0" strokeWidth={2.5} />
              «{name.trim()}» добавлен в вашу библиотеку.
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full h-12 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] text-sm transition"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <label className="block mb-4">
              <span className="block text-[13px] mb-2 text-[#A1A1AA]">Название</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={128}
                disabled={state.kind === "saving"}
                placeholder="Например: лендинг кофейни"
                className="w-full h-11 px-3 text-sm outline-none rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              <span className="block text-[12px] mt-1 text-[#71717A]/70">
                {name.length} / 128
              </span>
            </label>

            {state.kind === "error" && (
              <div className="p-3 mb-4 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
                {state.isLimit
                  ? "Достигнут лимит 50 шаблонов. Удалите неиспользуемые."
                  : `Ошибка: ${state.message}`}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={state.kind === "saving" || name.trim().length === 0}
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white font-semibold text-sm transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:shadow-none"
            >
              {state.kind === "saving" ? "Сохраняем…" : "Сохранить"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
