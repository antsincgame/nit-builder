import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import {
  loadHistory,
  deleteFromHistory,
  type HistoryEntry,
} from "~/lib/stores/historyStore";
import {
  listRemoteSites,
  getRemoteSite,
  deleteRemoteSite,
  migrateLocalHistoryIfNeeded,
} from "~/lib/stores/remoteHistoryStore";
import { useAuth } from "~/lib/hooks/useAuth";
import { toast } from "~/lib/stores/toastStore";

type Props = {
  onOpen: (entry: HistoryEntry) => void;
  onClose: () => void;
  isOpen: boolean;
};

type Source = "local" | "remote" | "loading";

type DisplayEntry = {
  id: string;
  prompt: string;
  templateName: string;
  createdAt: number;
  source: "local" | "remote";
};

/**
 * HistoryPanel v3 — эстетика лендинга: чёрный drawer, lucide иконки,
 * emerald-акценты. Логика local/remote/migration не тронута.
 */
export function HistoryPanel({ onOpen, onClose, isOpen }: Props) {
  const auth = useAuth();
  const [source, setSource] = useState<Source>("loading");
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [loadingEntry, setLoadingEntry] = useState<string | null>(null);

  useEffect(() => {
    setEntries([]);
    setSource("loading");
  }, [auth.status]);

  useEffect(() => {
    if (!isOpen) return;

    if (auth.status === "loading") {
      setSource("loading");
      return;
    }

    if (auth.status === "authenticated") {
      setSource("remote");
      void (async () => {
        try {
          const migrated = await migrateLocalHistoryIfNeeded();
          if (migrated > 0) {
            toast.info(`Перенесено ${migrated} сайтов в облако`);
          }
          const remote = await listRemoteSites();
          setEntries(
            remote.map((s) => ({
              id: s.id,
              prompt: s.prompt,
              templateName: s.templateName,
              createdAt: new Date(s.createdAt).getTime(),
              source: "remote" as const,
            })),
          );
        } catch {
          toast.error("Не удалось загрузить сайты");
          setEntries([]);
        }
      })();
    } else {
      setSource("local");
      const local = loadHistory();
      setEntries(
        local.map((e) => ({
          id: e.id,
          prompt: e.prompt,
          templateName: e.templateName,
          createdAt: e.createdAt,
          source: "local" as const,
        })),
      );
    }
  }, [isOpen, auth.status]);

  async function handleDelete(
    id: string,
    entrySource: "local" | "remote",
    e: React.MouseEvent,
  ) {
    e.stopPropagation();
    if (entrySource === "local") {
      deleteFromHistory(id);
      setEntries((prev) => prev.filter((x) => x.id !== id));
    } else {
      const ok = await deleteRemoteSite(id);
      if (ok) {
        setEntries((prev) => prev.filter((x) => x.id !== id));
        toast.success("Сайт удалён");
      } else {
        toast.error("Не удалось удалить");
      }
    }
  }

  async function handleOpen(id: string, entrySource: "local" | "remote") {
    setLoadingEntry(id);
    try {
      let entry: HistoryEntry | null = null;
      if (entrySource === "local") {
        const local = loadHistory();
        entry = local.find((e) => e.id === id) ?? null;
      } else {
        entry = await getRemoteSite(id);
      }
      if (entry) {
        onOpen(entry);
      } else {
        toast.error("Сайт не найден");
      }
    } finally {
      setLoadingEntry(null);
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
            <h3 className="text-lg font-semibold tracking-tight text-white">История</h3>
            <p className="text-xs mt-1 text-[#71717A]">
              {source === "loading"
                ? "Загружаем…"
                : entries.length === 0
                  ? "Пока пусто"
                  : entries.length === 1
                    ? "1 сайт"
                    : entries.length < 5
                      ? `${entries.length} сайта`
                      : `${entries.length} сайтов`}
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
          {source === "loading" && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl animate-pulse bg-white/[0.02] border border-white/[0.06]"
                >
                  <div className="h-3 w-3/4 mb-3 rounded bg-white/[0.08]" />
                  <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          )}

          {source !== "loading" && entries.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 opacity-40">📋</div>
              <h4 className="text-base font-semibold mb-2 text-white">Пока пусто</h4>
              <p className="text-xs max-w-[260px] mx-auto text-[#71717A] leading-relaxed">
                {source === "remote"
                  ? "Созданные сайты автоматически появятся здесь"
                  : "Войдите в аккаунт, чтобы ваши сайты сохранялись"}
              </p>
            </div>
          )}

          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={loadingEntry === entry.id}
              onClick={() => handleOpen(entry.id, entry.source)}
              className="w-full text-left p-4 rounded-xl transition group disabled:opacity-50 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] line-clamp-2 leading-snug text-white">{entry.prompt}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {entry.templateName && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-[#A1A1AA]">
                        {entry.templateName}
                      </span>
                    )}
                    <span className="text-xs text-[#71717A]/70">{formatDate(entry.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(entry.id, entry.source, e)}
                  className="opacity-0 group-hover:opacity-100 transition w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[#71717A] hover:text-rose-300"
                  aria-label="Удалить"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </button>
          ))}
        </div>

        {entries.length > 0 && source === "local" && (
          <div className="px-5 py-3 shrink-0 border-t border-white/[0.06]">
            <p className="text-xs text-center text-[#71717A]/70">
              Сохранено только в этом браузере ·{" "}
              <a href="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors no-underline">
                зарегистрироваться
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  const day = 24 * 60 * 60 * 1000;

  if (diff < 60 * 1000) return "только что";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} мин назад`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))} ч назад`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} дн назад`;

  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
