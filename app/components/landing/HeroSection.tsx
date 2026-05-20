/**
 * HeroSection — v3 bolt.new-style.
 *
 * Центрированный лейаут. Огромный заголовок, подзаголовок, prompt-input.
 * При submit — редирект на /register?prompt=... или на /app если authed.
 * Ниже — quick-start чипы с готовыми промптами.
 * Мобильный-first: padding и размеры шрифта адаптивны.
 */

import { useState } from "react";

type Props = { isAuthed: boolean };

const QUICK_STARTS = [
  { emoji: "☕", label: "Кофейня", prompt: "Лендинг для кофейни в Минске с меню и адресом" },
  { emoji: "💈", label: "Барбершоп", prompt: "Брутальный сайт барбершопа с услугами и записью" },
  { emoji: "💻", label: "Портфолио", prompt: "Портфолио fullstack-разработчика с проектами и контактами" },
  { emoji: "💪", label: "Фитнес", prompt: "Сайт персонального фитнес-тренера с программами и ценами" },
  { emoji: "💒", label: "Свадьба", prompt: "Сайт-приглашение на свадьбу с историей пары и программой" },
];

export function HeroSection({ isAuthed }: Props) {
  const [prompt, setPrompt] = useState("");

  const submitPrompt = (text: string) => {
    const value = text.trim();
    if (!value) {
      // пустой submit — просто ведём на /app или /register
      window.location.href = isAuthed ? "/app" : "/register";
      return;
    }
    const target = isAuthed ? "/app" : "/register";
    window.location.href = `${target}?prompt=${encodeURIComponent(value)}`;
  };

  return (
    <section className="relative px-5 sm:px-8 pt-16 sm:pt-24 pb-16 sm:pb-24">
      <div className="max-w-[820px] mx-auto text-center">
        {/* Метка над заголовком */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 sm:mb-8 rounded-full text-[12px]"
          style={{
            border: "1px solid var(--line-strong)",
            background: "var(--bg-2)",
            color: "var(--muted)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
          Open source · работает на твоём GPU
        </div>

        {/* Главный заголовок */}
        <h1
          className="nit-display mb-5 sm:mb-7"
          style={{
            fontSize: "clamp(40px, 8vw, 80px)",
            color: "var(--ink)",
          }}
        >
          Что построим
          <br />
          сегодня?
        </h1>

        {/* Подзаголовок */}
        <p
          className="mb-8 sm:mb-10 max-w-[560px] mx-auto"
          style={{
            fontSize: "clamp(15px, 2.4vw, 18px)",
            color: "var(--muted)",
            lineHeight: 1.55,
          }}
        >
          Опиши сайт словами — получи готовый HTML за 30 секунд.
          Без облака, без подписок, без лимитов.
        </p>

        {/* Prompt input — большой белый бокс в стиле bolt */}
        <div className="nit-prompt-box p-3 sm:p-4 mb-6">
          <textarea
            className="nit-prompt-input min-h-[80px] sm:min-h-[100px] px-2 py-1"
            placeholder="Например: лендинг для кофейни в Минске с меню, фото и адресом"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submitPrompt(prompt);
              }
            }}
            rows={3}
          />
          <div className="flex items-center justify-between gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="text-[11px] text-[color:var(--muted-2)] hidden sm:block">
              ⌘ + Enter для отправки
            </div>
            <div className="text-[11px] text-[color:var(--muted-2)] sm:hidden">
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

        {/* Quick-starts */}
        <div className="mb-8 sm:mb-10">
          <div className="text-[12px] text-[color:var(--muted-2)] mb-3">
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

        {/* Stats line */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] sm:text-[13px]"
          style={{ color: "var(--muted-2)" }}
        >
          <span className="flex items-center gap-2">
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>23</span> шаблона
          </span>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span className="flex items-center gap-2">
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>~30с</span> на сайт
          </span>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span className="flex items-center gap-2">
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>0$</span> навсегда
          </span>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>MIT</span>
        </div>
      </div>
    </section>
  );
}
