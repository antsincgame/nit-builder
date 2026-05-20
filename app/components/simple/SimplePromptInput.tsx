/**
 * SimplePromptInput v2.1 — фикс дубля type="button" + .nit-quick-chip
 * (класс уже определён в app.css, использует pill-стиль).
 */

import { useState } from "react";

type Props = {
  onSubmit: (prompt: string) => void;
  loading: boolean;
  initialValue?: string;
};

const EXAMPLES = [
  "Сайт для кофейни в центре Минска",
  "Свадебный сайт в стиле минимализм",
  "Личная страница фотографа-путешественника",
  "Сайт репетитора по английскому для детей",
];

export function SimplePromptInput({ onSubmit, loading, initialValue = "" }: Props) {
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Опишите в 1-2 предложениях какой сайт вы хотите…"
          rows={4}
          disabled={loading}
          className="w-full px-5 py-4 pr-5 pb-16 text-[15px] sm:text-[16px] resize-none outline-none disabled:opacity-50 transition-all rounded-xl"
          style={{
            background: "rgba(19, 20, 27, 0.7)",
            border: focused ? "1px solid var(--cyan)" : "1px solid var(--line-strong)",
            color: "var(--ink)",
            boxShadow: focused ? "0 0 0 3px rgba(56, 189, 248, 0.12)" : "none",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !value.trim()}
          className="absolute bottom-4 right-4 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="btn-primary inline-flex" style={{ padding: "10px 18px", fontSize: 14 }}>
            {loading ? (
              <>
                <span
                  className="w-3 h-3 rounded-full animate-spin"
                  style={{
                    border: "2px solid rgba(0,0,0,0.3)",
                    borderTopColor: "#000",
                  }}
                />
                Создаём…
              </>
            ) : (
              <>
                Создать
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </>
            )}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setValue(ex)}
            className="nit-quick-chip"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
