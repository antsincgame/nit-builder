/**
 * PolishChat v3 — эстетика лендинга:
 * чёрный фон, emerald-акценты, lucide иконки.
 * Логика не тронута.
 */

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

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
    <div className="flex flex-col h-full bg-[#0A0A0A]">
      <div className="px-5 py-4 shrink-0 border-b border-white/[0.06]">
        <div className="text-sm font-semibold mb-1 text-white">Правки</div>
        <p className="text-xs text-[#71717A]">Опишите что изменить — результат увидите справа.</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <div className="text-xs mb-3 text-[#71717A]/70">Попробуйте:</div>
            {SUGGESTIONS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setValue(ex)}
                className="block w-full text-left px-3.5 py-2.5 text-[13px] rounded-lg border border-white/[0.06] bg-transparent text-[#A1A1AA] hover:text-white hover:border-white/[0.12] hover:bg-white/[0.03] transition"
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
                className={`max-w-[88%] px-3.5 py-2.5 text-[13px] whitespace-pre-wrap rounded-2xl border ${
                  isUser
                    ? "bg-emerald-500/[0.08] border-emerald-500/25 text-white"
                    : "bg-white/[0.03] border-white/[0.06] text-[#A1A1AA]"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04]">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
              {loadingLabel && (
                <span className="text-xs text-emerald-300">{loadingLabel}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 shrink-0 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={loading ? "Работаем…" : "Что изменить?"}
            disabled={loading}
            className="flex-1 h-10 px-3.5 text-[14px] outline-none disabled:opacity-50 transition rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !value.trim()}
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white transition-all shadow-[0_0_16px_rgba(16,185,129,0.3)] disabled:shadow-none"
            title="Отправить (Enter)"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
