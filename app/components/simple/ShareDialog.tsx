import { useState, useCallback } from "react";
import { X, Loader2, Copy, ExternalLink } from "lucide-react";
import { toast } from "~/lib/stores/toastStore";

type ShareDialogProps = {
  isOpen: boolean;
  siteId: string | null;
  onClose: () => void;
};

type ShareState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; token: string; url: string; expiresAt: string }
  | { kind: "error"; message: string };

/**
 * ShareDialog v3 — эстетика лендинга: чёрный модал, emerald-CTA,
 * lucide иконки (X, Loader2, Copy, ExternalLink).
 */
export function ShareDialog({ isOpen, siteId, onClose }: ShareDialogProps) {
  const [state, setState] = useState<ShareState>({ kind: "idle" });

  const createShare = useCallback(async () => {
    if (!siteId) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ siteId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        token: string;
        url: string;
        expiresAt: string;
      };
      const fullUrl = `${window.location.origin}${data.url}`;
      setState({ kind: "ready", token: data.token, url: fullUrl, expiresAt: data.expiresAt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "неизвестная ошибка";
      setState({ kind: "error", message: msg });
    }
  }, [siteId]);

  const copyUrl = useCallback((url: string) => {
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Ссылка скопирована"),
      () => toast.error("Не удалось скопировать"),
    );
  }, []);

  const handleClose = useCallback(() => {
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
          Поделиться сайтом
        </h3>
        <p className="text-sm mb-5 text-[#A1A1AA] leading-relaxed">
          Создайте публичную ссылку — её можно отправить кому угодно, входить
          в аккаунт не нужно. Ссылка работает 30 дней.
        </p>

        {!siteId && (
          <div className="p-3 mb-4 text-[13px] rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#A1A1AA]">
            Сайт ещё сохраняется. Подождите пару секунд и попробуйте снова.
          </div>
        )}

        {state.kind === "idle" && siteId && (
          <button
            type="button"
            onClick={createShare}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold text-sm transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)]"
          >
            Создать ссылку
          </button>
        )}

        {state.kind === "loading" && (
          <div className="flex items-center justify-center gap-3 py-4 text-[#A1A1AA]">
            <Loader2 size={16} className="text-emerald-400 animate-spin" />
            <span className="text-sm">Создаём ссылку…</span>
          </div>
        )}

        {state.kind === "error" && (
          <div className="p-3 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
            Ошибка: {state.message}
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-3">
            <div className="p-3 text-[13px] break-all select-all rounded-lg bg-white/[0.04] border border-white/[0.08] text-white font-mono">
              {state.url}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyUrl(state.url)}
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold text-sm transition-all shadow-[0_0_18px_rgba(16,185,129,0.3)]"
              >
                <Copy size={13} />
                Скопировать
              </button>
              <a
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] text-sm transition"
              >
                <ExternalLink size={13} />
                Открыть
              </a>
            </div>
            <div className="text-[12px] text-center text-[#71717A]/80">
              Работает до {new Date(state.expiresAt).toLocaleDateString("ru")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
