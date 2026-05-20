/**
 * PolishChat v2 — полностью на русском, без "// chat · ai polish" префиксов.
 */

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; text: string };

type Props = {
  onPolish: (request: string) => void;
  messages: Message[];
  loading: boolean;
  loadingLabel?: string;
};

const SUGGESTIONS = [
  "Сделай кнопки ярче",
  "Добавь секцию с отзывами",
  "Поменяй цвет на фиолетовый",
  "Сделай заголовок больше",
  "Убери секцию с ценами",
];

export function PolishChat({ onPolish, messages, loading, loadingLabel }: Props) {
  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onPolish(trimmed);
    setValue("");
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "var(--bg)",
        borderRight: "1px solid var(--line)",
      }}
    >
      <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="text-[14px] font-semibold mb-1" style={{ color: "var(--ink)" }}>
          Правки
        </div>
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Опишите что изменить — результат увидите справа.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <div className="text-[12px] mb-3" style={{ color: "var(--muted-2)" }}>
              Попробуйте:
            </div>
            {SUGGESTIONS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setValue(ex)}
                className="block w-full text-left px-3.5 py-2.5 text-[13px] rounded-lg transition"
                style={{
                  background: "transparent",
                  border: "1px solid var(--line)",
                  color: "var(--muted)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--line-hover)";
                  e.currentTarget.style.color = "var(--ink)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--line)";
                  e.currentTarget.style.color = "var(--muted)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[88%] px-3.5 py-2.5 text-[13px] whitespace-pre-wrap rounded-xl"
                style={{
                  background: isUser
                    ? "rgba(56, 189, 248, 0.08)"
                    : "rgba(167, 139, 250, 0.06)",
                  border: isUser
                    ? "1px solid rgba(56, 189, 248, 0.25)"
                    : "1px solid rgba(167, 139, 250, 0.2)",
                  color: isUser ? "var(--ink)" : "var(--ink-dim)",
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div
              className="px-3.5 py-2.5 flex items-center gap-3 rounded-xl"
              style={{
                background: "rgba(167, 139, 250, 0.06)",
                border: "1px solid rgba(167, 139, 250, 0.2)",
              }}
            >
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--violet)", animation: "nit-pulse 1.4s infinite" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "var(--violet)",
                    animation: "nit-pulse 1.4s infinite",
                    animationDelay: "0.2s",
                  }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "var(--violet)",
                    animation: "nit-pulse 1.4s infinite",
                    animationDelay: "0.4s",
                  }}
                />
              </div>
              {loadingLabel && (
                <span className="text-[12px]" style={{ color: "var(--violet)" }}>
                  {loadingLabel}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 shrink-0" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={loading ? "Работаем…" : "Что изменить?"}
            disabled={loading}
            className="flex-1 px-3.5 py-2.5 text-[14px] outline-none disabled:opacity-50 transition rounded-lg"
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--line-strong)",
              color: "var(--ink)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--cyan)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--line-strong)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !value.trim()}
            className="px-3 py-2.5 rounded-lg disabled:opacity-30"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
            title="Отправить (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
