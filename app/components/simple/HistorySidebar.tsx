/**
 * HistorySidebar — постоянный левый сайдбар с историей сайтов
 * (как в Claude/ChatGPT). Заменяет выезжавший справа HistoryPanel.
 *
 * Данные: авторизованным — облако (nit_sites) с миграцией localStorage,
 * гостям — localStorage. Логика local/remote/migration перенесена из
 * HistoryPanel без изменений.
 *
 * Режимы:
 *  - inlineOnDesktop=true (welcome): на lg+ — статичная колонка, на мобиле —
 *    off-canvas по open
 *  - inlineOnDesktop=false (редактор): всегда off-canvas overlay по open
 */
import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import Logo from "~/components/landing/Logo";
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

type Source = "local" | "remote" | "loading";

type DisplayEntry = {
  id: string;
  prompt: string;
  createdAt: number;
  source: "local" | "remote";
};

type Props = {
  onOpenEntry: (entry: HistoryEntry) => void;
  onNewSite: () => void;
  activeSiteId?: string | null;
  /** Меняется когда появился/сохранился новый сайт — перезагружает список */
  refreshKey?: string | null;
  /** Мобильный/overlay-режим: открыт ли сайдбар */
  open: boolean;
  onClose: () => void;
  /** true — на lg+ сайдбар всегда виден как колонка */
  inlineOnDesktop: boolean;
};

export function HistorySidebar({
  onOpenEntry,
  onNewSite,
  activeSiteId,
  refreshKey,
  open,
  onClose,
  inlineOnDesktop,
}: Props) {
  const auth = useAuth();
  const [source, setSource] = useState<Source>("loading");
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [loadingEntry, setLoadingEntry] = useState<string | null>(null);

  useEffect(() => {
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
              createdAt: new Date(s.createdAt).getTime(),
              source: "remote" as const,
            })),
          );
        } catch {
          toast.error("Не удалось загрузить историю");
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
          createdAt: e.createdAt,
          source: "local" as const,
        })),
      );
    }
  }, [auth.status, refreshKey]);

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
        onOpenEntry(entry);
      } else {
        toast.error("Сайт не найден");
      }
    } finally {
      setLoadingEntry(null);
    }
  }

  const asideClasses = [
    "fixed inset-y-0 left-0 z-[95] w-[280px] flex flex-col",
    "bg-[#0D0D0D] border-r border-white/[0.06]",
    "transition-transform duration-200",
    open ? "translate-x-0" : "-translate-x-full",
    inlineOnDesktop ? "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-auto lg:shrink-0" : "",
  ].join(" ");

  return (
    <>
      {open && (
        <div
          className={`fixed inset-0 z-[94] bg-black/60 backdrop-blur-sm ${
            inlineOnDesktop ? "lg:hidden" : ""
          }`}
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside className={asideClasses}>
        {/* Шапка */}
        <div className="px-4 h-14 sm:h-16 flex items-center justify-between shrink-0 border-b border-white/[0.06]">
          <a href="/" className="flex items-center gap-2.5 no-underline">
            <Logo size={26} />
            <span className="text-[14px] font-semibold text-white tracking-tight">nitgen</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-white hover:bg-white/[0.04] transition ${
              inlineOnDesktop ? "lg:hidden" : ""
            }`}
            aria-label="Закрыть"
          >
            <X size={15} />
          </button>
        </div>

        {/* Новый сайт */}
        <div className="p-3 shrink-0">
          <button
            type="button"
            onClick={onNewSite}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium border border-white/[0.08] text-white hover:border-emerald-500/40 hover:bg-emerald-500/[0.06] transition"
          >
            <Plus size={14} className="text-emerald-400" />
            Новый сайт
          </button>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {source === "loading" && (
            <div className="space-y-1.5 px-1 pt-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 rounded-lg animate-pulse bg-white/[0.03]" />
              ))}
            </div>
          )}

          {source !== "loading" && entries.length === 0 && (
            <p className="px-3 pt-6 text-[12px] text-[#71717A] leading-relaxed text-center">
              Пока пусто — созданные сайты появятся здесь
            </p>
          )}

          {entries.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-3 pt-2 pb-1.5 text-[10px] tracking-[0.16em] uppercase text-[#71717A]/70">
                История
              </div>
              {entries.map((entry) => {
                const active = activeSiteId != null && activeSiteId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`group relative rounded-lg transition ${
                      active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={loadingEntry === entry.id}
                      onClick={() => handleOpen(entry.id, entry.source)}
                      className="w-full text-left pl-3 pr-9 py-2 disabled:opacity-50"
                      title={entry.prompt}
                    >
                      <span
                        className={`block text-[13px] leading-snug truncate ${
                          active ? "text-white" : "text-[#A1A1AA] group-hover:text-white"
                        }`}
                      >
                        {entry.prompt || "Без описания"}
                      </span>
                      <span className="block text-[10px] mt-0.5 text-[#71717A]/60">
                        {formatDate(entry.createdAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(entry.id, entry.source, e)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition w-6 h-6 rounded-md flex items-center justify-center text-[#71717A] hover:text-rose-300"
                      aria-label="Удалить"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Футер для гостя */}
        {source === "local" && (
          <div className="px-4 py-3 shrink-0 border-t border-white/[0.06]">
            <p className="text-[11px] text-[#71717A]/80 leading-relaxed">
              История хранится только в этом браузере.{" "}
              <a
                href="/login"
                className="text-emerald-400 hover:text-emerald-300 transition-colors no-underline"
              >
                Войти
              </a>{" "}
              чтобы синхронизировать.
            </p>
          </div>
        )}
      </aside>
    </>
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
