import { useEffect, useState } from "react";
import {
  listMyTemplates,
  getMyTemplate,
  deleteMyTemplate,
  submitTemplateForReview,
  hasSubmittedTemplate,
  markSubmittedTemplate,
  type UserTemplateSummary,
  type UserTemplateFull,
} from "~/lib/stores/userTemplatesStore";
import { toast } from "~/lib/stores/toastStore";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUse: (template: UserTemplateFull) => void;
};

type LoadState = "idle" | "loading" | "ready" | "error";

/**
 * MyTemplatesPanel v2 — русский, без "// templates" / "MY TEMPLATES" /
 * "NO TEMPLATES" / "zones" / "submit ▲".
 */
export function MyTemplatesPanel({ isOpen, onClose, onUse }: Props) {
  const [state, setState] = useState<LoadState>("idle");
  const [templates, setTemplates] = useState<UserTemplateSummary[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittedSet, setSubmittedSet] = useState<Set<string>>(new Set());

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

    if (typeof window !== "undefined") {
      const initial = new Set<string>();
      try {
        const raw = localStorage.getItem("nit-submitted-templates");
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            parsed.forEach((x) => {
              if (typeof x === "string") initial.add(x);
            });
          }
        }
      } catch {
        /* ignore */
      }
      setSubmittedSet(initial);
    }
  }, [isOpen]);

  async function handleUse(id: string) {
    if (loadingId) return;
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

  async function handleSubmit(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (submittingId) return;
    if (hasSubmittedTemplate(id)) {
      toast.info("Уже на модерации");
      return;
    }
    setSubmittingId(id);
    try {
      const ok = await submitTemplateForReview(id);
      if (!ok) {
        toast.error("Не удалось отправить");
        return;
      }
      markSubmittedTemplate(id);
      setSubmittedSet((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      toast.success("Шаблон отправлен на модерацию");
    } finally {
      setSubmittingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] backdrop-blur-sm flex items-start justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full overflow-hidden flex flex-col"
        style={{
          background: "var(--bg-2)",
          borderLeft: "1px solid var(--line-strong)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <h3 className="nit-display" style={{ fontSize: 18, color: "var(--ink)" }}>
              Мои шаблоны
            </h3>
            <p className="text-[12px] mt-1" style={{ color: "var(--muted-2)" }}>
              {state === "loading"
                ? "Загружаем…"
                : state === "error"
                  ? "Ошибка загрузки"
                  : templates.length === 0
                    ? "Пока пусто"
                    : `Сохранено: ${templates.length} / 50`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition"
            style={{ color: "var(--muted)" }}
            aria-label="Закрыть"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {state === "loading" && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl animate-pulse"
                  style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--line)" }}
                >
                  <div className="h-3 w-2/3 mb-3 rounded" style={{ background: "var(--line-strong)" }} />
                  <div className="h-2 w-1/2 rounded" style={{ background: "var(--line)" }} />
                </div>
              ))}
            </div>
          )}

          {state === "ready" && templates.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 opacity-40">⭐</div>
              <h4 className="nit-display mb-2" style={{ fontSize: 18, color: "var(--ink)" }}>
                Шаблонов пока нет
              </h4>
              <p className="text-[13px] max-w-[280px] mx-auto" style={{ color: "var(--muted)", lineHeight: 1.55 }}>
                Создайте сайт и нажмите «Сохранить» в редакторе — он появится здесь.
              </p>
            </div>
          )}

          {state === "ready" &&
            templates.map((t) => {
              const isSubmitted = t.isPublic || submittedSet.has(t.id);
              const isSubmitting = submittingId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={loadingId === t.id}
                  onClick={() => handleUse(t.id)}
                  className="w-full text-left p-4 rounded-xl transition group disabled:opacity-50"
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--line)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--line-hover)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--line)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] mb-1 truncate" style={{ color: "var(--ink)" }}>
                        {t.name}
                      </p>
                      {t.prompt && (
                        <p className="text-[12px] line-clamp-2 leading-snug" style={{ color: "var(--muted)" }}>
                          {t.prompt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {t.isPublic && (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-md"
                            style={{ color: "var(--green)", background: "rgba(34, 197, 94, 0.08)" }}
                            title="Опубликован в галерее сообщества"
                          >
                            В галерее · ▲ {t.votes}
                          </span>
                        )}
                        {!t.isPublic && submittedSet.has(t.id) && (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-md"
                            style={{ color: "var(--muted)", border: "1px dashed var(--line-strong)" }}
                          >
                            На модерации
                          </span>
                        )}
                        <span className="text-[12px]" style={{ color: "var(--muted-2)" }}>
                          {formatDate(t.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(t.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ color: "var(--muted)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--pink)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
                        aria-label="Удалить шаблон"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                      {!isSubmitted && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={(e) => handleSubmit(t.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition text-[11px] px-2 py-1 rounded-md disabled:opacity-30"
                          style={{
                            color: "var(--cyan)",
                            border: "1px solid var(--line-strong)",
                          }}
                          title="Отправить в общую галерею"
                        >
                          {isSubmitting ? "…" : "В галерею"}
                        </button>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
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
