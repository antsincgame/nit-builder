import { useEffect, useState } from "react";
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

export function meta() {
  return [
    { title: "Шаблоны сообщества · NITGEN" },
    {
      name: "description",
      content:
        "Публичная галерея шаблонов от других пользователей. Возьмите любой как стартовую точку.",
    },
  ];
}

/**
 * /templates v2 — галерея сообщества, полностью переписана на русском и приведена
 * к дизайн-токенам v3.2. Была мешанина: "COMMUNITY TEMPLATES", "GALLERY IS
 * EMPTY", "use →", "zones", "loading...", "// error", "← Home", старые
 * GridBg/Orbs/Particles/Chip.
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
    <div className="relative min-h-screen text-[color:var(--ink)] overflow-x-hidden">
      <div className="nit-bg-mesh" aria-hidden>
        <div className="nit-bg-mesh-orb nit-bg-mesh-1" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-2" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-3" />
      </div>
      <div className="nit-bg-grid" aria-hidden />
      <ToastContainer />

      <header
        className="relative z-10 sticky top-0 backdrop-blur-md"
        style={{
          background: "rgba(10, 11, 16, 0.7)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 no-underline">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[14px]"
              style={{ background: "var(--ink)", color: "var(--bg)" }}
            >
              N
            </div>
            <span className="text-[15px] font-semibold text-[color:var(--ink)]">nitgen</span>
          </a>
          <a
            href="/"
            className="text-[13px] transition-colors"
            style={{ color: "var(--muted)" }}
          >
            ← На главную
          </a>
        </div>
      </header>

      <main className="relative z-10 max-w-[1200px] mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-20">
        <div className="section-tint section-tint-violet" aria-hidden />
        <div className="relative mb-10 sm:mb-14 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full text-[12px]"
            style={{
              border: "1px solid var(--line-strong)",
              background: "rgba(19, 20, 27, 0.6)",
              color: "var(--muted)",
            }}
          >
            Галерея сообщества
          </div>
          <h1
            className="nit-display mb-4"
            style={{ fontSize: "clamp(32px, 5.5vw, 48px)", color: "var(--ink)" }}
          >
            Шаблоны
            <br />
            <span className="nit-text-gradient-cyan">от пользователей</span>
          </h1>
          <p
            className="max-w-[560px] mx-auto"
            style={{ fontSize: "clamp(14px, 2vw, 16px)", color: "var(--muted)", lineHeight: 1.6 }}
          >
            Готовые сайты, которые сделали другие люди в NITGEN. Возьмите любой за основу и
            доработайте под свой бизнес.
          </p>
        </div>

        {state === "loading" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-5 rounded-xl animate-pulse"
                style={{
                  background: "rgba(19, 20, 27, 0.6)",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  className="h-4 w-3/4 mb-3 rounded"
                  style={{ background: "var(--line-strong)" }}
                />
                <div
                  className="h-3 w-1/2 mb-6 rounded"
                  style={{ background: "var(--line)" }}
                />
                <div
                  className="h-2 w-1/3 rounded"
                  style={{ background: "var(--line)" }}
                />
              </div>
            ))}
          </div>
        )}

        {state === "error" && (
          <div
            className="p-6 rounded-xl text-center"
            style={{
              border: "1px solid var(--pink)",
              background: "rgba(244, 114, 182, 0.06)",
            }}
          >
            <p className="text-[14px]" style={{ color: "var(--ink-dim)" }}>
              Не удалось загрузить шаблоны. Попробуйте обновить страницу.
            </p>
          </div>
        )}

        {state === "ready" && templates.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-5 opacity-40">💭</div>
            <h2
              className="nit-display mb-3"
              style={{ fontSize: 24, color: "var(--ink)" }}
            >
              Пока пусто
            </h2>
            <p
              className="max-w-[420px] mx-auto mb-7 text-[14px]"
              style={{ color: "var(--muted)", lineHeight: 1.55 }}
            >
              Ребята ещё не поделились своими сайтами. Создайте свой первый
              и сохраните как шаблон — будет виден в этой галерее.
            </p>
            <a href="/" className="btn-primary" style={{ padding: "12px 24px" }}>
              Создать сайт
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
          </div>
        )}

        {state === "ready" && templates.length > 0 && (
          <>
            <div className="mb-6 text-[13px]" style={{ color: "var(--muted)" }}>
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
                    className="nit-card-glow p-5 rounded-xl group"
                    style={{
                      background: "rgba(19, 20, 27, 0.7)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleUse(t.id)}
                      className="w-full text-left disabled:opacity-50"
                    >
                      <h3
                        className="font-semibold text-[16px] sm:text-[17px] mb-2 truncate"
                        style={{ color: "var(--ink)" }}
                      >
                        {t.name}
                      </h3>
                      {t.prompt && (
                        <p
                          className="text-[13px] line-clamp-3 leading-snug mb-4"
                          style={{ color: "var(--muted)" }}
                        >
                          {t.prompt}
                        </p>
                      )}
                    </button>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={isVoting || isVoted}
                        onClick={(e) => handleVote(t.id, e)}
                        className="text-[12px] px-2.5 py-1 rounded-md transition disabled:cursor-not-allowed"
                        style={{
                          color: isVoted ? "var(--green)" : "var(--muted)",
                          border: "1px solid var(--line-strong)",
                          background: isVoted ? "rgba(34, 197, 94, 0.08)" : "transparent",
                        }}
                        title={isVoted ? "Вы уже голосовали" : "Проголосовать"}
                        aria-label="Проголосовать за шаблон"
                      >
                        {isVoting ? "…" : `▲ ${t.votes}`}
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleUse(t.id)}
                        className="text-[12px] font-medium transition disabled:opacity-50"
                        style={{ color: "var(--cyan)" }}
                      >
                        {isLoading ? "Грузим…" : "Использовать →"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      <footer
        className="relative z-10 px-5 sm:px-8 py-8 text-center text-[13px]"
        style={{
          borderTop: "1px solid var(--line)",
          color: "var(--muted-2)",
        }}
      >
        <a
          href="/"
          className="transition-colors"
          style={{ color: "var(--muted)" }}
        >
          ← На главную
        </a>
      </footer>
    </div>
  );
}
