import { useEffect, useState } from "react";
import {
  listMyTemplates,
  getMyTemplate,
  deleteMyTemplate,
  type UserTemplateSummary,
  type UserTemplateFull,
} from "~/lib/stores/userTemplatesStore";
import { toast } from "~/lib/stores/toastStore";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when user clicks a template — receives full template (with html).
   * Caller should switch app to editing-mode using template.html + template.prompt.
   */
  onUse: (template: UserTemplateFull) => void;
};

type LoadState = "idle" | "loading" | "ready" | "error";

/**
 * Drawer со списком пользовательских шаблонов (v2.1 Save as Template
 * follow-up). Параллельный к HistoryPanel, но для `nit_user_templates`:
 *   - listMyTemplates() при открытии
 *   - клик по карточке → getMyTemplate(id) → onUse(template)
 *   - кнопка ✕ на hover → deleteMyTemplate(id)
 *
 * Доступен только authenticated юзерам (template — это Appwrite-only фича).
 * Кнопка в home.tsx рендерится только при auth.status === "authenticated".
 */
export function MyTemplatesPanel({ isOpen, onClose, onUse }: Props) {
  const [state, setState] = useState<LoadState>("idle");
  const [templates, setTemplates] = useState<UserTemplateSummary[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setState("loading");
    void (async () => {
      try {
        const list = await listMyTemplates();
        setTemplates(list);
        setState("ready");
      } catch (err) {
        console.error("[MyTemplatesPanel] list failed:", err);
        setState("error");
        toast.error("Не удалось загрузить шаблоны");
      }
    })();
  }, [isOpen]);

  async function handleUse(id: string) {
    if (loadingId) return; // уже идёт загрузка другого
    setLoadingId(id);
    try {
      const full = await getMyTemplate(id);
      if (!full) {
        toast.error("Шаблон не найден");
        return;
      }
      onUse(full);
      onClose();
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const ok = await deleteMyTemplate(id);
    if (ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Шаблон удалён");
    } else {
      toast.error("Не удалось удалить");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] backdrop-blur-sm flex items-start justify-end p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full overflow-hidden flex flex-col"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <div
              className="text-[10px] tracking-[0.2em] uppercase mb-1"
              style={{ color: "var(--accent-glow)" }}
            >
              // templates
            </div>
            <h3 className="nit-display text-[20px]" style={{ color: "var(--ink)" }}>
              MY TEMPLATES
            </h3>
            <p
              className="text-[10px] tracking-[0.1em] uppercase mt-1"
              style={{ color: "var(--muted-2)" }}
            >
              {state === "loading"
                ? "loading..."
                : state === "error"
                  ? "error"
                  : templates.length === 0
                    ? "empty"
                    : `${templates.length} · saved`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 transition flex items-center justify-center"
            style={{
              border: "1px solid var(--line-strong)",
              color: "var(--muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--magenta)";
              e.currentTarget.style.color = "var(--magenta)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--line-strong)";
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {state === "loading" && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 animate-pulse"
                  style={{
                    background: "rgba(10,13,24,0.6)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div
                    className="h-3 w-2/3 mb-3"
                    style={{ background: "var(--line-strong)" }}
                  />
                  <div
                    className="h-2 w-1/2"
                    style={{ background: "var(--line)" }}
                  />
                </div>
              ))}
            </div>
          )}

          {state === "ready" && templates.length === 0 && (
            <div className="text-center py-20">
              <div
                className="text-[10px] tracking-[0.2em] uppercase mb-3"
                style={{ color: "var(--muted-2)" }}
              >
                // null
              </div>
              <p
                className="nit-display text-[24px] mb-3"
                style={{ color: "var(--muted)" }}
              >
                NO TEMPLATES
              </p>
              <p
                className="text-[11px] tracking-[0.05em] max-w-[280px] mx-auto"
                style={{ color: "var(--muted-2)" }}
              >
                Сохрани удачный сайт как шаблон через ★ Save —
                сможешь использовать его как стартовую точку
              </p>
            </div>
          )}

          {state === "ready" &&
            templates.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={loadingId === t.id}
                onClick={() => handleUse(t.id)}
                className="w-full text-left p-4 transition group disabled:opacity-50"
                style={{
                  background: "rgba(10,13,24,0.6)",
                  border: "1px solid var(--line)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.background = "rgba(0,212,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--line)";
                  e.currentTarget.style.background = "rgba(10,13,24,0.6)";
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p
                      className="nit-display text-[14px] mb-1 truncate"
                      style={{ color: "var(--ink)" }}
                    >
                      {t.name}
                    </p>
                    {t.prompt && (
                      <p
                        className="text-[11px] font-mono line-clamp-2 leading-snug"
                        style={{ color: "var(--muted)" }}
                      >
                        {t.prompt}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {t.hasZones && (
                        <span
                          className="text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5"
                          style={{
                            color: "var(--acid)",
                            border: "1px solid var(--line-strong)",
                          }}
                        >
                          zones
                        </span>
                      )}
                      <span
                        className="text-[10px] tracking-[0.05em]"
                        style={{ color: "var(--muted-2)" }}
                      >
                        {formatDate(t.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(t.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition text-[14px]"
                    style={{ color: "var(--muted)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--magenta)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--muted)";
                    }}
                    aria-label="Удалить шаблон"
                  >
                    ✕
                  </button>
                </div>
              </button>
            ))}
        </div>

        {state === "ready" && templates.length > 0 && (
          <div
            className="px-5 py-4"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <p
              className="text-[10px] tracking-[0.1em] uppercase text-center"
              style={{ color: "var(--muted-2)" }}
            >
              ✓ private library · {templates.length} / 50
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const now = Date.now();
  const diff = now - ts;
  const day = 24 * 60 * 60 * 1000;

  if (diff < 60 * 1000) return "только что";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} мин назад`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))} ч назад`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} дн назад`;
  return new Date(ts).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}
