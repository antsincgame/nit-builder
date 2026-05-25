import { useEffect, useState } from "react";
import { X, Trash2, ChevronUp } from "lucide-react";
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
 * MyTemplatesPanel v3 — эстетика лендинга: чёрный drawer, emerald-акценты,
 * lucide иконки (X, Trash2, ChevronUp). Логика list/get/delete/submit не тронута.
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
      className="fixed inset-0 z-[90] backdrop-blur-sm flex items-start justify-end bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full overflow-hidden flex flex-col bg-[#0A0A0A] border-l border-white/[0.08] shadow-[-20px_0_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-white/[0.06]">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">Мои шаблоны</h3>
            <p className="text-xs mt-1 text-[#71717A]">
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
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-white hover:bg-white/[0.04] transition"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {state === "loading" && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl animate-pulse bg-white/[0.02] border border-white/[0.06]"
                >
                  <div className="h-3 w-2/3 mb-3 rounded bg-white/[0.08]" />
                  <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          )}

          {state === "ready" && templates.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 opacity-40">⭐</div>
              <h4 className="text-base font-semibold mb-2 text-white">Шаблонов пока нет</h4>
              <p className="text-xs max-w-[280px] mx-auto text-[#71717A] leading-relaxed">
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
                  className="w-full text-left p-4 rounded-xl transition group disabled:opacity-50 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm mb-1 truncate text-white">{t.name}</p>
                      {t.prompt && (
                        <p className="text-xs line-clamp-2 leading-snug text-[#A1A1AA]">{t.prompt}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {t.isPublic && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
                            title="Опубликован в галерее сообщества"
                          >
                            <ChevronUp size={10} /> {t.votes} · в галерее
                          </span>
                        )}
                        {!t.isPublic && submittedSet.has(t.id) && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md text-[#A1A1AA] border border-dashed border-white/[0.12]">
                            На модерации
                          </span>
                        )}
                        <span className="text-xs text-[#71717A]/70">{formatDate(t.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(t.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition w-7 h-7 rounded-md flex items-center justify-center text-[#71717A] hover:text-rose-300"
                        aria-label="Удалить шаблон"
                      >
                        <Trash2 size={13} />
                      </button>
                      {!isSubmitted && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={(e) => handleSubmit(t.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition text-[11px] px-2 py-1 rounded-md text-emerald-400 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] disabled:opacity-30"
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
