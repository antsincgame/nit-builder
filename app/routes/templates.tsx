import { useEffect, useState } from "react";
import { ArrowRight, ChevronUp } from "lucide-react";
import {
  listPublicTemplates,
  getPublicTemplate,
  voteTemplate,
  hasVotedFor,
  markVotedFor,
  type PublicTemplateSummary,
} from "~/lib/stores/userTemplatesStore";
import { toast } from "~/lib/stores/toastStore";
import { ToastContainer } from "~/components/simple/ToastContainer";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";

export function meta() {
  return [
    { title: "Шаблоны сообщества · nitgen" },
    {
      name: "description",
      content:
        "Публичная галерея шаблонов от других пользователей. Возьмите любой как стартовую точку.",
    },
  ];
}

/**
 * PublicTemplatesGallery v3 — выровнян под эстетику лендинга:
 * чёрный #0A0A0A, NeuralBackground, emerald-акценты, lucide-react.
 * Логика listPublicTemplates/getPublicTemplate/voteTemplate не тронута.
 */
export default function PublicTemplatesGallery() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [templates, setTemplates] = useState<PublicTemplateSummary[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [votedSet, setVotedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      try {
        const list = await listPublicTemplates();
        setTemplates(list);
        setState("ready");
      } catch (err) {
        console.error("[/templates] list failed:", err);
        setState("error");
      }
    })();
    if (typeof window !== "undefined") {
      const initial = new Set<string>();
      try {
        const raw = localStorage.getItem("nit-voted-templates");
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
      setVotedSet(initial);
    }
  }, []);

  async function handleUse(id: string) {
    if (loadingId) return;
    setLoadingId(id);
    try {
      const full = await getPublicTemplate(id);
      if (!full) {
        toast.error("Шаблон больше недоступен");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        return;
      }
      try {
        sessionStorage.setItem(
          "nit-pending-template",
          JSON.stringify({
            id: full.id,
            name: full.name,
            prompt: full.prompt,
            html: full.html,
          }),
        );
      } catch (storageErr) {
        console.error("[/templates] sessionStorage failed:", storageErr);
        toast.error("Не удалось загрузить шаблон. Попробуйте ещё раз.");
        return;
      }
      window.location.href = "/";
    } finally {
      setLoadingId(null);
    }
  }

  async function handleVote(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (votingId) return;
    if (hasVotedFor(id)) {
      toast.info("Вы уже голосовали за этот шаблон");
      return;
    }
    setVotingId(id);
    try {
      const newVotes = await voteTemplate(id, "up");
      if (newVotes === null) {
        toast.error("Не удалось проголосовать");
        return;
      }
      markVotedFor(id);
      setVotedSet((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, votes: newVotes } : t)),
      );
      toast.success("Голос засчитан");
    } finally {
      setVotingId(null);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
      <NeuralBackground />
      <ToastContainer />

      <header className="relative z-10 sticky top-0 backdrop-blur-md bg-[#0A0A0A]/80 border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 no-underline">
            <Logo size={32} />
            <span className="text-[15px] font-semibold text-white tracking-tight">nitgen</span>
          </a>
          <a
            href="/"
            className="text-[13px] text-[#71717A] hover:text-white transition-colors"
          >
            ← На главную
          </a>
        </div>
      </header>

      <main className="relative z-10 max-w-[1200px] mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-20">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 mb-6 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] shadow-[0_0_20px_rgba(16,185,129,0.12)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-[13px] text-emerald-300 font-medium">Галерея сообщества</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-white mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.06)]">
            Шаблоны
            <br />
            <span className="bg-gradient-to-r from-white via-white/90 to-emerald-200/80 bg-clip-text text-transparent">
              от пользователей
            </span>
          </h1>
          <p className="max-w-[560px] mx-auto text-base sm:text-lg text-[#A1A1AA] leading-relaxed">
            Готовые сайты, которые сделали другие люди в nitgen. Возьмите любой за
            основу и доработайте под свой бизнес.
          </p>
        </div>

        {state === "loading" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl border border-white/[0.06] bg-[#141414] animate-pulse"
              >
                <div className="h-4 w-3/4 mb-3 rounded bg-white/[0.06]" />
                <div className="h-3 w-1/2 mb-6 rounded bg-white/[0.04]" />
                <div className="h-2 w-1/3 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        )}

        {state === "error" && (
          <div className="max-w-md mx-auto p-6 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] text-center">
            <p className="text-sm text-[#A1A1AA] leading-relaxed">
              Не удалось загрузить шаблоны. Попробуйте обновить страницу.
            </p>
          </div>
        )}

        {state === "ready" && templates.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-5 opacity-40">💭</div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-3">Пока пусто</h2>
            <p className="max-w-[420px] mx-auto mb-8 text-sm text-[#71717A] leading-relaxed">
              Ребята ещё не поделились своими сайтами. Создайте свой первый
              и сохраните как шаблон — будет виден в этой галерее.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold text-sm transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)]"
            >
              Создать сайт
              <ArrowRight size={14} />
            </a>
          </div>
        )}

        {state === "ready" && templates.length > 0 && (
          <>
            <div className="mb-6 text-[13px] text-[#71717A]">
              {templates.length === 1
                ? "1 шаблон"
                : templates.length < 5
                  ? `${templates.length} шаблона`
                  : `${templates.length} шаблонов`}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => {
                const isVoted = votedSet.has(t.id);
                const isVoting = votingId === t.id;
                const isLoading = loadingId === t.id;
                return (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-white/[0.06] bg-[#141414] hover:border-white/[0.12] p-5 transition-colors group"
                  >
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleUse(t.id)}
                      className="w-full text-left disabled:opacity-50"
                    >
                      <h3 className="font-semibold text-[15px] sm:text-[16px] mb-2 truncate text-white">
                        {t.name}
                      </h3>
                      {t.prompt && (
                        <p className="text-[13px] line-clamp-3 leading-snug mb-4 text-[#71717A]">
                          {t.prompt}
                        </p>
                      )}
                    </button>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.05]">
                      <button
                        type="button"
                        disabled={isVoting || isVoted}
                        onClick={(e) => handleVote(t.id, e)}
                        className={`inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-md border transition disabled:cursor-not-allowed ${
                          isVoted
                            ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.08]"
                            : "text-[#71717A] border-white/[0.08] hover:text-white hover:border-white/[0.15]"
                        }`}
                        title={isVoted ? "Вы уже голосовали" : "Проголосовать"}
                        aria-label="Проголосовать за шаблон"
                      >
                        {isVoting ? "…" : (
                          <>
                            <ChevronUp size={12} />
                            {t.votes}
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleUse(t.id)}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? "Грузим…" : (
                          <>
                            Использовать
                            <ArrowRight size={12} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      <footer className="relative z-10 px-5 sm:px-8 py-8 text-center text-[13px] border-t border-white/[0.06] text-[#71717A]/60">
        <a href="/" className="hover:text-white transition-colors">
          ← На главную
        </a>
      </footer>
    </div>
  );
}
