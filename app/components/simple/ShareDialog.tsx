import { useState, useCallback } from "react";
import { toast } from "~/lib/stores/toastStore";

type ShareDialogProps = {
  isOpen: boolean;
  /** ID сайта в Appwrite — обязателен; если null, диалог покажет hint что сайт не сохранён. */
  siteId: string | null;
  onClose: () => void;
};

type ShareState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; token: string; url: string; expiresAt: string }
  | { kind: "error"; message: string };

/**
 * Модалка для создания публичной ссылки на сгенерированный сайт.
 *
 * Flow: открывается → кнопка "Создать ссылку" → POST /api/share → отображает
 * полный URL с кнопкой copy. Не показывает истории share'ов (для этого
 * отдельный экран в Settings когда-нибудь, сейчас YAGNI).
 *
 * Поведение при отсутствии siteId (юзер только что сгенерировал сайт,
 * но сохранение в Appwrite ещё не успело): объясняем что нужно зайти
 * чуть позже. Это нормальный edge-case — saveRemoteSite в
 * useGenerationFlow fire-and-forget, между моментом готовности UI и
 * фактической записью в Appwrite может пройти секунда.
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
      const msg = err instanceof Error ? err.message : "unknown";
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
    // Reset state при закрытии — следующее открытие начнёт с idle
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
          Поделиться сайтом
        </h3>
        <p className="text-[12px] text-[color:var(--muted)] mb-5 leading-[1.6]">
          Создай публичную read-only ссылку. Получатель увидит сайт без
          необходимости логиниться. По умолчанию работает 30 дней.
        </p>

        {!siteId && (
          <div
            className="p-3 mb-4 text-[12px]"
            style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
          >
            Сайт ещё не сохранён в облако. Подожди пару секунд и попробуй
            снова — сохранение идёт в фоне после генерации.
          </div>
        )}

        {state.kind === "idle" && siteId && (
          <button
            type="button"
            onClick={createShare}
            className="w-full px-4 py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-black transition"
            style={{ background: "var(--accent)" }}
          >
            ⏵ Создать ссылку
          </button>
        )}

        {state.kind === "loading" && (
          <div className="text-[12px] tracking-[0.15em] uppercase text-[color:var(--muted)] py-3 text-center">
            // generating link...
          </div>
        )}

        {state.kind === "error" && (
          <div className="p-3 text-[12px]" style={{ border: "1px solid var(--magenta)", color: "var(--magenta)" }}>
            Ошибка: {state.message}
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-3">
            <div className="text-[10px] tracking-[0.2em] uppercase text-[color:var(--accent-glow)]">
              ⏵ Ready
            </div>
            <div
              className="p-3 font-mono text-[12px] break-all select-all"
              style={{
                border: "1px solid var(--line-strong)",
                background: "var(--bg-glass)",
                color: "var(--ink)",
              }}
            >
              {state.url}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyUrl(state.url)}
                className="flex-1 px-3 py-2 text-[10px] tracking-[0.15em] uppercase transition"
                style={{ border: "1px solid var(--accent)", color: "var(--accent-glow)" }}
              >
                ⏷ Copy
              </button>
              <a
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 text-[10px] tracking-[0.15em] uppercase no-underline text-center transition text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                style={{ border: "1px solid var(--line)" }}
              >
                ↗ Open
              </a>
            </div>
            <div className="text-[10px] text-[color:var(--muted-2)] tracking-[0.1em]">
              Истекает: {new Date(state.expiresAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
