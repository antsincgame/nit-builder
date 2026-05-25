import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { useToasts, type Toast } from "~/lib/stores/toastStore";

const STYLES: Record<Toast["type"], { bg: string; border: string; text: string }> = {
  success: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-300",
  },
  error: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-300",
  },
  info: {
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    text: "text-sky-300",
  },
  warning: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-300",
  },
};

function ToastIcon({ type }: { type: Toast["type"] }) {
  switch (type) {
    case "success":
      return <CheckCircle2 size={16} className="shrink-0" />;
    case "error":
      return <XCircle size={16} className="shrink-0" />;
    case "info":
      return <Info size={16} className="shrink-0" />;
    case "warning":
      return <AlertTriangle size={16} className="shrink-0" />;
  }
}

export function ToastContainer() {
  const { toasts, dismiss } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-md">
      {toasts.map((t) => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md ${s.bg} ${s.border} ${s.text} shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-[slide-in_0.2s_ease-out]`}
          >
            <ToastIcon type={t.type} />
            <p className="text-sm flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100 transition shrink-0"
              aria-label="Закрыть"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
