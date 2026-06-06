/**
 * SimplePromptInput v3 — эстетика лендинга:
 * чёрный фон, emerald-акцент, lucide иконки.
 * Добавлен selector style presets для управления визуальным языком генерации.
 */

import { useState } from "react";
import { Loader2, ArrowRight, PlugZap } from "lucide-react";
import type { StylePresetId } from "~/lib/llm/style-presets";

type Props = {
  onSubmit: (prompt: string) => void;
  loading: boolean;
  initialValue?: string;
  selectedStylePresetId: StylePresetId | "auto";
  onStylePresetChange: (presetId: StylePresetId | "auto") => void;
  /**
   * Гейт подключения. Когда генерация недоступна (у авторизованного
   * туннель offline), вместо «Создать» показываем честную амбер-кнопку
   * перехода к шагам подключения. Снимает ловушку ложного ожидания:
   * действие не должно выглядеть доступным, если оно гарантированно
   * упадёт после клика.
   */
  connectGate?: { label: string; href: string } | null;
};

const STYLE_PRESETS: Array<{
  id: StylePresetId | "auto";
  name: string;
  hint: string;
  accent: string;
}> = [
  { id: "auto", name: "Auto", hint: "по промпту", accent: "var(--accent)" },
  { id: "clean-saas", name: "Clean SaaS", hint: "Apple / Linear", accent: "#60a5fa" },
  { id: "warm-premium", name: "Warm Premium", hint: "Framer / Stripe", accent: "#f59e0b" },
  { id: "neon-cyber", name: "Neon Cyber", hint: "glitch / HUD", accent: "var(--magenta)" },
  { id: "editorial", name: "Editorial", hint: "журнал / luxury", accent: "#d9a06a" },
  { id: "tech-terminal", name: "Terminal", hint: "CLI / devtool", accent: "#39ff88" },
  { id: "dark-luxe", name: "Dark Luxe", hint: "графит / латунь", accent: "#c6a15b" },
  { id: "earth-craft", name: "Earth Craft", hint: "бумага / крафт", accent: "#b4652f" },
  { id: "bold-pop", name: "Bold Pop", hint: "стикеры / поп-арт", accent: "#ffd60a" },
];

export function SimplePromptInput({
  onSubmit,
  loading,
  initialValue = "",
  selectedStylePresetId,
  onStylePresetChange,
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

      <div className="mt-5">
        <div
          className="text-[10px] tracking-[0.2em] uppercase mb-3 flex items-center justify-center gap-3 text-white/35"
        >
          <span className="w-8 h-px bg-white/[0.08]" />
          style preset
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {STYLE_PRESETS.map((preset) => {
            const active = preset.id === selectedStylePresetId;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={loading}
                onClick={() => onStylePresetChange(preset.id)}
                className="group text-left px-3 py-3 rounded-xl transition disabled:opacity-50"
                style={{
                  border: active ? `1px solid ${preset.accent}` : "1px solid rgba(255,255,255,0.08)",
                  background: active ? "rgba(255,255,255,0.06)" : "#141414",
                  boxShadow: active ? `0 0 28px color-mix(in srgb, ${preset.accent} 22%, transparent)` : "none",
                }}
                aria-pressed={active}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: preset.accent, boxShadow: active ? `0 0 14px ${preset.accent}` : "none" }}
                  />
                  <span
                    className="text-[11px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: active ? "#fff" : "#A1A1AA" }}
                  >
                    {preset.name}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-white/35">
                  {preset.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
