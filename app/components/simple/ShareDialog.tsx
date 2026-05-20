import { useState, useCallback } from "react";
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
 * ShareDialog v2 — русский, без "// generating link..." / "⏵ Ready" / Copy / Open.
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
          Поделиться сайтом
        </h3>
        <p className="text-[14px] mb-5" style={{ color: "var(--muted)", lineHeight: 1.55 }}>
          Создайте публичную ссылку — её можно отправить кому угодно, входить
          в аккаунт не нужно. Ссылка работает 30 дней.
        </p>

        {!siteId && (
          <div
            className="p-3 mb-4 text-[13px] rounded-lg"
            style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
          >
            Сайт ещё сохраняется. Подождите пару секунд и попробуйте снова.
          </div>
        )}

        {state.kind === "idle" && siteId && (
          <button
            type="button"
            onClick={createShare}
            className="btn-primary w-full"
            style={{ padding: "12px 22px" }}
          >
            Создать ссылку
          </button>
        )}

        {state.kind === "loading" && (
          <div className="flex items-center justify-center gap-3 py-4" style={{ color: "var(--muted)" }}>
            <div
              className="w-4 h-4 rounded-full animate-spin"
              style={{ border: "2px solid var(--line)", borderTopColor: "var(--cyan)" }}
            />
            <span className="text-[13px]">Создаём ссылку…</span>
          </div>
        )}

        {state.kind === "error" && (
          <div
            className="p-3 text-[13px] rounded-lg"
            style={{ border: "1px solid var(--pink)", color: "var(--pink)", background: "rgba(244, 114, 182, 0.06)" }}
          >
            Ошибка: {state.message}
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-3">
            <div
              className="p-3 text-[13px] break-all select-all rounded-lg"
              style={{
                border: "1px solid var(--line-strong)",
                background: "var(--bg)",
                color: "var(--ink)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {state.url}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyUrl(state.url)}
                className="btn-primary flex-1"
                style={{ padding: "10px 16px", fontSize: 13 }}
              >
                Скопировать
              </button>
              <a
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost flex-1 text-center"
                style={{ padding: "10px 16px", fontSize: 13 }}
              >
                Открыть
              </a>
            </div>
            <div className="text-[12px] text-center" style={{ color: "var(--muted-2)" }}>
              Работает до {new Date(state.expiresAt).toLocaleDateString("ru")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
