/**
 * SimplePromptInput v4 — только поле + кнопка.
 *
 * Сетка style-пресетов убрана: стиль подбирает пайплайн сам из описания
 * (auto). Кто хочет конкретный стиль — пишет его словами в промпте,
 * Planner это понимает. Меньше выборов на экране — меньше страха.
 */

import { useState } from "react";
import { Loader2, ArrowRight, PlugZap } from "lucide-react";

type Props = {
  onSubmit: (prompt: string) => void;
  loading: boolean;
  initialValue?: string;
  /**
   * Гейт подключения. Когда генерация недоступна (у авторизованного
   * туннель offline), вместо «Создать» показываем честную амбер-кнопку
   * перехода к шагам подключения. Снимает ловушку ложного ожидания:
   * действие не должно выглядеть доступным, если оно гарантированно
   * упадёт после клика.
   */
  connectGate?: { label: string; href: string } | null;
};

export function SimplePromptInput({
  onSubmit,
  loading,
  initialValue = "",
  connectGate = null,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);

  const submit = () => {
    if (connectGate) return;
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
          rows={3}
          disabled={loading}
          className={`w-full px-4 py-3.5 pr-4 pb-14 text-[14px] sm:text-[15px] resize-none outline-none disabled:opacity-50 transition-all rounded-xl bg-[#141414] text-white placeholder:text-white/30 ${
            focused
              ? "border-emerald-500/40 ring-2 ring-emerald-500/15"
              : "border-white/[0.08]"
          } border`}
        />
        {connectGate ? (
          <a
            href={connectGate.href}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-300 hover:bg-amber-200 text-[#0A0A0A] font-semibold text-[13px] transition-all"
          >
            <PlugZap size={14} />
            {connectGate.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={loading || !value.trim()}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:border disabled:border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white font-semibold text-[13px] transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:shadow-none"
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
        )}
      </div>

    </div>
  );
}
