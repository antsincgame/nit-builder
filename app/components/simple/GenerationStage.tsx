/**
 * GenerationStage — экран в превью-области, пока сайт ещё не потёк в iframe
 * (фаза анализа/планирования). Раньше тут было пустое белое/чёрное поле —
 * казалось, что всё зависло. Теперь: анимированный скелетон каркаса сайта
 * (наглядно «строится») + поэтапный чеклист с галочками и живыми метриками
 * (токены/символы/секунды), приходящими из туннеля.
 */
import { Loader2, Check } from "lucide-react";

type Props = {
  /** plan | template | code | done — текущий шаг пайплайна. */
  currentStep: string;
  /** Накоплено токенов (из generate_progress). */
  tokens: number;
  /** Символов кода (streamingChars). */
  chars: number;
  /** Секунд с начала генерации (локальный таймер). */
  seconds: number;
  /** Выбранный шаблон/стиль (после фазы template). */
  templateName?: string;
};

const STEPS = [
  { key: "analyze", label: "Анализирую запрос" },
  { key: "structure", label: "Продумываю структуру" },
  { key: "style", label: "Подбираю стиль" },
  { key: "code", label: "Пишу код" },
] as const;

const fmt = (n: number) => n.toLocaleString("ru-RU");

export function GenerationStage({ currentStep, tokens, chars, seconds, templateName }: Props) {
  // currentStep → индекс активного шага чеклиста. Анализ мгновенный, поэтому
  // фаза plan показывает «продумываю структуру» (шаг 1) как активный.
  const activeIdx =
    currentStep === "code" || currentStep === "done"
      ? 3
      : currentStep === "template"
        ? 2
        : 1;

  const coding = currentStep === "code" || currentStep === "done";
  const metric = coding
    ? `${fmt(chars)} символов`
    : tokens > 0
      ? `${fmt(tokens)} токенов`
      : "запускаю модель…";

  return (
    <div className="flex-1 overflow-hidden relative bg-[#0f0f10]">
      {/* Мягкое фирменное свечение сверху. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, rgba(16,185,129,0.10), transparent 70%)",
        }}
      />
      <div className="relative h-full flex flex-col items-center justify-center gap-7 px-6 py-8 overflow-y-auto">
        {/* Скелетон каркаса сайта — «дышащие» плейсхолдеры. */}
        <div className="w-full max-w-[520px] rounded-2xl border border-white/[0.07] bg-[#141414] p-4 shadow-2xl">
          {/* Топбар сайта */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="h-2.5 w-24 rounded bg-white/10" />
            <div className="ml-auto flex gap-1.5">
              <div className="h-2.5 w-10 rounded bg-white/10" />
              <div className="h-2.5 w-10 rounded bg-emerald-500/30" />
            </div>
          </div>
          {/* Hero */}
          <div className="rounded-xl bg-gradient-to-br from-white/[0.05] to-transparent p-5 mb-3">
            <div className="h-5 w-3/4 rounded bg-white/[0.12] mb-2.5 animate-pulse" />
            <div
              className="h-3 w-1/2 rounded bg-white/[0.08] mb-4 animate-pulse"
              style={{ animationDelay: "0.15s" }}
            />
            <div
              className="h-8 w-32 rounded-lg bg-emerald-500/25 animate-pulse"
              style={{ animationDelay: "0.3s" }}
            />
          </div>
          {/* Секции-карточки */}
          <div className="grid grid-cols-3 gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg bg-white/[0.04] p-3">
                <div
                  className="h-8 w-8 rounded-lg bg-emerald-500/15 mb-2 animate-pulse"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
                <div
                  className="h-2 w-full rounded bg-white/[0.08] mb-1.5 animate-pulse"
                  style={{ animationDelay: `${i * 0.12 + 0.1}s` }}
                />
                <div
                  className="h-2 w-2/3 rounded bg-white/[0.08] animate-pulse"
                  style={{ animationDelay: `${i * 0.12 + 0.2}s` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Поэтапный чеклист с живой метрикой на активном шаге. */}
        <div className="w-full max-w-[520px] space-y-2">
          {STEPS.map((s, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            const label =
              active && s.key === "style" && templateName ? `${s.label}: ${templateName}` : s.label;
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 text-[13px] ${
                  active ? "text-white" : done ? "text-emerald-400/80" : "text-[#71717A]/60"
                }`}
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center border ${
                    done
                      ? "border-emerald-500/40 bg-emerald-500/15"
                      : active
                        ? "border-emerald-400/60 bg-emerald-500/10"
                        : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {done ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : active ? (
                    <Loader2 size={12} className="text-emerald-400 animate-spin" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]/40" />
                  )}
                </span>
                <span className="flex-1 truncate">{label}</span>
                {active && (
                  <span className="text-[12px] text-emerald-300 tabular-nums shrink-0">
                    {metric}
                    {seconds > 0 ? ` · ${seconds}с` : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-[#71717A]/50 max-w-[420px] text-center leading-relaxed">
          Сайт собирает ИИ на вашем компьютере. Большие модели думают несколько
          минут — это нормально, прогресс идёт.
        </p>
      </div>
    </div>
  );
}
