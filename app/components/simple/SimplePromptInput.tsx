/**
 * SimplePromptInput v3 — эстетика лендинга:
 * чёрный фон, emerald-акцент, lucide иконки.
 * Логика (onSubmit, EXAMPLES, Ctrl+Enter, loading) не тронута.
 */

import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";

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
          className={`w-full px-5 py-4 pr-5 pb-16 text-[15px] sm:text-[16px] resize-none outline-none disabled:opacity-50 transition-all rounded-2xl bg-[#141414] text-white placeholder:text-white/30 ${
            focused
              ? "border-emerald-500/40 ring-2 ring-emerald-500/15"
              : "border-white/[0.08]"
          } border`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !value.trim()}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:border disabled:border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white font-semibold text-sm transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:shadow-none"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Создаём…
            </>
          ) : (
            <>
              Создать
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setValue(ex)}
            className="px-3 py-1.5 text-[12px] rounded-full border border-white/[0.08] bg-[#141414] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
