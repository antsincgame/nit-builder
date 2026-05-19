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
import { GridBg, Orbs, Chip, Particles } from "~/components/nit";

export function meta() {
  return [
    { title: "NITGEN — Community templates" },
    {
      name: "description",
      content:
        "Публичная галерея шаблонов от других юзеров NITGEN. Возьми любой как стартовую точку.",
    },
  ];
}

/**
 * /templates — публичная галерея community-шаблонов (v2.2 Phase 2/3).
 *
 * Загрузка через fetch /api/public-templates на клиенте (не SSR loader)
 * для согласованности с остальным flow (home.tsx тоже client-fetch).
 * Клик по карточке → fetch full → sessionStorage с pending-template
 * payload → переход на /. home.tsx при mount подберёт это и загрузит
 * шаблон как стартовую точку через handleUseTemplate.
 *
 * Phase 3: vote-кнопка ▲ на каждой карточке. localStorage дедуп через
 * "nit-voted-templates" ключ — если юзер уже голосовал за шаблон в этой
 * браузер-сессии, кнопка disabled. Server-side persistent vote registry
 * — backlog для v2.3+ (см. doc в voteForTemplate в appwrite.server.ts).
 *
 * Без auth — открыт guest'ам. Использовать шаблон могут только authed
 * юзеры (после редиректа на / увидят форму регистрации если не залогинены).
 */
export default function PublicTemplatesGallery() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [templates, setTemplates] = useState<PublicTemplateSummary[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  // Reactive snapshot localStorage'а — обновляем после каждого vote чтобы UI
  // мгновенно показывал disabled-состояние ▲ кнопки.
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
    // Подтягиваем locally-voted set из localStorage один раз при mount.
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
        // ignore — пустой set ок
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
        // Локально remove чтобы не висел в UI
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        return;
      }
      // sessionStorage: home.tsx при mount проверяет ключ и загружает
      // template через handleUseTemplate. Ключ затрётся после consume.
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
        toast.error("Не удалось передать шаблон — попробуй ещё раз");
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
      toast.info("Ты уже голосовал за этот шаблон");
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
      // Обновляем счётчик в локальном state без рефетча
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, votes: newVotes } : t)),
      );
      toast.success("Голос засчитан");
    } finally {
      setVotingId(null);
    }
  }

  return (
    <div className="relative min-h-screen text-[color:var(--ink)] nit-grain overflow-x-hidden">
      <GridBg />
      <Orbs />
      <Particles count={20} />
      <ToastContainer />

      <nav
        className="relative z-10 px-8 py-5 flex justify-between items-center max-w-[1400px] mx-auto"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <a href="/" className="flex items-center gap-3 no-underline">
          <span
            className="block w-7 h-7 relative"
            style={{
              background:
                "conic-gradient(from 0deg, var(--accent), var(--magenta), var(--acid), var(--accent))",
              animation: "nit-spin 8s linear infinite",
            }}
          >
            <span
              className="absolute inset-[3px]"
              style={{ background: "var(--bg)" }}
            />
          </span>
          <span className="nit-display text-lg text-[color:var(--ink)]">
            NITGEN
          </span>
        </a>

        <a
          href="/"
          className="px-4 py-2 text-[11px] tracking-[0.15em] uppercase no-underline transition text-[color:var(--muted)] hover:text-[color:var(--ink)]"
          style={{ border: "1px solid var(--line)" }}
        >
          ← Home
        </a>
      </nav>

      <main className="relative z-10 max-w-[1400px] mx-auto px-8 pt-12 md:pt-16 pb-20">
        <div className="mb-10">
          <Chip color="acid">⏵ Community gallery · public</Chip>
          <h1
            className="nit-display mt-6 mb-4"
            style={{ fontSize: "clamp(40px, 6vw, 72px)" }}
          >
            COMMUNITY TEMPLATES
          </h1>
          <p
            className="text-[14px] max-w-[640px] leading-[1.7]"
            style={{ color: "var(--muted)" }}
          >
            Шаблоны от других юзеров NITGEN, одобренные модерацией. Возьми
            любой как стартовую точку — система загрузит его в редактор,
            и ты сможешь полировать дальше через AI.
          </p>
        </div>

        {state === "loading" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-5 animate-pulse"
                style={{
                  background: "rgba(10,13,24,0.6)",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  className="h-4 w-3/4 mb-3"
                  style={{ background: "var(--line-strong)" }}
                />
                <div
                  className="h-3 w-1/2 mb-6"
                  style={{ background: "var(--line)" }}
                />
                <div
                  className="h-2 w-1/3"
                  style={{ background: "var(--line)" }}
                />
              </div>
            ))}
          </div>
        )}

        {state === "error" && (
          <div
            className="p-6 text-center"
            style={{
              border: "1px solid var(--magenta)",
              background: "rgba(255,46,147,0.05)",
            }}
          >
            <p
              className="text-[12px] tracking-[0.2em] uppercase mb-2"
              style={{ color: "var(--magenta)" }}
            >
              // error
            </p>
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              Не удалось загрузить шаблоны. Попробуй обновить страницу.
            </p>
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
              className="nit-display text-[32px] mb-3"
              style={{ color: "var(--muted)" }}
            >
              GALLERY IS EMPTY
            </p>
            <p
              className="text-[12px] tracking-[0.05em] max-w-[400px] mx-auto"
              style={{ color: "var(--muted-2)" }}
            >
              Юзеры ещё не опубликовали шаблоны. Создай свой первый сайт и
              сохрани его как шаблон — модерация рассмотрит и добавит в
              галерею.
            </p>
            <a
              href="/"
              className="inline-block mt-6 px-5 py-3 text-[11px] font-bold tracking-[0.15em] uppercase text-black no-underline transition"
              style={{ background: "var(--accent)" }}
            >
              Создать сайт →
            </a>
          </div>
        )}

        {state === "ready" && templates.length > 0 && (
          <>
            <div className="mb-6 flex items-center gap-3 text-[10px] tracking-[0.2em] uppercase">
              <span
                className="w-10 h-px"
                style={{ background: "var(--accent-glow)" }}
              />
              <span style={{ color: "var(--accent-glow)" }}>
                {templates.length} templates
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => {
                const isVoted = votedSet.has(t.id);
                const isVoting = votingId === t.id;
                const isLoading = loadingId === t.id;
                return (
                  <div
                    key={t.id}
                    className="p-5 transition group"
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
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleUse(t.id)}
                      className="w-full text-left disabled:opacity-50"
                    >
                      <h3
                        className="nit-display text-[16px] mb-2 truncate"
                        style={{ color: "var(--ink)" }}
                      >
                        {t.name}
                      </h3>
                      {t.prompt && (
                        <p
                          className="text-[11px] font-mono line-clamp-3 leading-snug mb-4"
                          style={{ color: "var(--muted)" }}
                        >
                          {t.prompt}
                        </p>
                      )}
                    </button>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isVoting || isVoted}
                          onClick={(e) => handleVote(t.id, e)}
                          className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            color: isVoted ? "var(--acid)" : "var(--accent-glow)",
                            border: "1px solid var(--line-strong)",
                          }}
                          onMouseEnter={(e) => {
                            if (!isVoted && !isVoting) {
                              e.currentTarget.style.borderColor = "var(--accent-glow)";
                              e.currentTarget.style.background = "rgba(0,212,255,0.08)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "var(--line-strong)";
                            e.currentTarget.style.background = "transparent";
                          }}
                          title={isVoted ? "Ты уже голосовал" : "Проголосовать"}
                          aria-label="Vote for template"
                        >
                          {isVoting ? "…" : `▲ ${t.votes}`}
                        </button>
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
                      </div>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleUse(t.id)}
                        className="text-[10px] tracking-[0.15em] uppercase opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                        style={{ color: "var(--accent-glow)" }}
                      >
                        {isLoading ? "loading..." : "use →"}
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
        className="relative z-10 py-10 text-center text-[10px] tracking-[0.15em] uppercase"
        style={{
          borderTop: "1px solid var(--line)",
          color: "var(--muted-2)",
        }}
      >
        <div className="max-w-6xl mx-auto px-8 flex flex-wrap justify-center items-center gap-6">
          <span>NITGEN · COMMUNITY GALLERY</span>
          <span className="hidden md:inline">·</span>
          <a
            href="/"
            className="no-underline transition hover:text-[color:var(--accent-glow)]"
            style={{ color: "inherit" }}
          >
            ← BACK TO HOME
          </a>
        </div>
      </footer>
    </div>
  );
}
