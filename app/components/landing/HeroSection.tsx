/**
 * HeroSection v3.1 — + typewriter placeholder, glow за инпутом, live-индикатор.
 * Плейсхолдер циклически печатается через 5 вариантов. Пауза при фокусе.
 */

import { useEffect, useState } from "react";

type Props = { isAuthed: boolean };

const PLACEHOLDERS = [
  "Лендинг для кофейни в Минске с меню и адресом",
  "Брутальный сайт барбершопа с мастерами и записью",
  "Портфолио разработчика с проектами и контактами",
  "Свадебный сайт-приглашение с историей пары",
  "Сайт фитнес-тренера с программами и ценами",
];

const QUICK_STARTS = [
  { emoji: "☕", label: "Кофейня", prompt: "Лендинг для кофейни в Минске с меню и адресом" },
  { emoji: "💈", label: "Барбершоп", prompt: "Брутальный сайт барбершопа с услугами и записью" },
  { emoji: "💻", label: "Портфолио", prompt: "Портфолио fullstack-разработчика с проектами и контактами" },
  { emoji: "💪", label: "Фитнес", prompt: "Сайт персонального фитнес-тренера с программами и ценами" },
  { emoji: "💒", label: "Свадьба", prompt: "Сайт-приглашение на свадьбу с историей пары и программой" },
];

function useTypewriter(strings: string[], speed = 55, pause = 1600, paused = false) {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "deleting">("typing");

  useEffect(() => {
    if (paused) return;
    const current = strings[idx];
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (text.length < current.length) {
        timer = setTimeout(() => setText(current.slice(0, text.length + 1)), speed);
      } else {
        timer = setTimeout(() => setPhase("hold"), pause);
      }
    } else if (phase === "hold") {
      timer = setTimeout(() => setPhase("deleting"), pause);
    } else {
      if (text.length > 0) {
        timer = setTimeout(() => setText(current.slice(0, text.length - 1)), speed / 2);
      } else {
        setIdx((idx + 1) % strings.length);
        setPhase("typing");
      }
    }
    return () => clearTimeout(timer);
  }, [text, idx, phase, strings, speed, pause, paused]);

  return text;
}

export function HeroSection({ isAuthed }: Props) {
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const typewriterText = useTypewriter(PLACEHOLDERS, 55, 1600, focused || prompt.length > 0);

  const submitPrompt = (text: string) => {
    const value = text.trim();
    if (!value) {
      window.location.href = isAuthed ? "/app" : "/register";
      return;
    }
    const target = isAuthed ? "/app" : "/register";
    window.location.href = `${target}?prompt=${encodeURIComponent(value)}`;
  };

  return (
    <section className="relative px-5 sm:px-8 pt-12 sm:pt-20 pb-12 sm:pb-20">
      <div className="max-w-[820px] mx-auto text-center">
        {/* Live метка с зелёным пульсаром */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 sm:mb-8 rounded-full text-[12px]"
          style={{
            border: "1px solid var(--line-strong)",
            background: "var(--bg-2)",
            color: "var(--muted)",
          }}
        >
          <span className="nit-dot-live" />
          Open source · работает на твоём GPU
        </div>

        <h1
          className="nit-display mb-5 sm:mb-7"
          style={{ fontSize: "clamp(40px, 8vw, 80px)", color: "var(--ink)" }}
        >
          Что построим
          <br />
          сегодня?
        </h1>

        <p
          className="mb-8 sm:mb-10 max-w-[560px] mx-auto"
          style={{
            fontSize: "clamp(15px, 2.4vw, 18px)",
            color: "var(--muted)",
            lineHeight: 1.55,
          }}
        >
          Опиши сайт словами — код стримится из твоего GPU за 30 секунд.
          <br />
          <span style={{ color: "var(--ink-dim)" }}>Без облака, без подписок, без лимитов.</span>
        </p>

        {/* Prompt input с glow */}
        <div className="nit-prompt-wrap mb-6">
          <div className="nit-prompt-box p-3 sm:p-4">
            <div className="relative px-2 py-1">
              {/* Typewriter placeholder — виден только когда инпут пуст и не в фокусе */}
              {!prompt && !focused && (
                <div
                  className="absolute inset-0 px-2 py-1 pointer-events-none text-left"
                  style={{ color: "var(--muted-2)", fontSize: 16, lineHeight: "1.5" }}
                >
                  {typewriterText}
                  <span className="nit-typewriter-cursor" />
                </div>
              )}
              <textarea
                className="nit-prompt-input min-h-[80px] sm:min-h-[100px] text-left"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    submitPrompt(prompt);
                  }
                }}
                rows={3}
                aria-label="Опиши сайт"
              />
            </div>
            <div
              className="flex items-center justify-between gap-3 mt-2 pt-2"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <div className="text-[11px] hidden sm:flex items-center gap-3" style={{ color: "var(--muted-2)" }}>
                <span className="flex items-center gap-1.5">
                  <span className="nit-dot-live" style={{ width: 6, height: 6 }} />
                  туннель готов
                </span>
                <span>·</span>
                <span>⌘ + Enter</span>
              </div>
              <div className="text-[11px] sm:hidden" style={{ color: "var(--muted-2)" }}>
                {prompt.length} символов
              </div>
              <button
                onClick={() => submitPrompt(prompt)}
                className="btn-primary"
                style={{ padding: "10px 18px", fontSize: 13 }}
              >
                Создать
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8 sm:mb-10">
          <div className="text-[12px] mb-3" style={{ color: "var(--muted-2)" }}>
            или попробуй:
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_STARTS.map((q) => (
              <button
                key={q.label}
                onClick={() => submitPrompt(q.prompt)}
                className="nit-quick-chip"
                type="button"
              >
                <span>{q.emoji}</span>
                <span>{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] sm:text-[13px]"
          style={{ color: "var(--muted-2)" }}
        >
          <span><span style={{ color: "var(--ink)", fontWeight: 600 }}>23</span> шаблона</span>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span><span style={{ color: "var(--ink)", fontWeight: 600 }}>~30с</span> на сайт</span>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span><span style={{ color: "var(--green)", fontWeight: 600 }}>0€</span> навсегда</span>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>MIT</span>
        </div>
      </div>
    </section>
  );
}
