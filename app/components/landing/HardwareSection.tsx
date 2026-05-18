/**
 * HardwareSection — секция "04 · Hardware tier".
 *
 * Верхний блок: 4-cell grid с тирами VRAM (Minimum/Recommended/Pro/Apple).
 * Нижний блок: real-world benchmarks на конкретных GPU — чтобы юзер видел
 * сколько именно секунд генерится полный лендинг на его железе.
 *
 * Числа консервативные, основаны на reproducible замерах Coder-моделей в
 * LM Studio с Flash Attention + Q8 KV cache на собственных машинах
 * разработчиков. На +- 30% от config-ы (контекст, Tailwind компиляция).
 */

import { RevealOnScroll, SectionLabel } from "~/components/nit";

type Hardware = {
  tier: string;
  vram: string;
  model: string;
  note: string;
  color: "accent" | "acid" | "magenta" | "violet";
};

const HARDWARE: Hardware[] = [
  { tier: "Minimum", vram: "4 GB", model: "Coder-3B Q4", note: "Бюджетные карты, медленно но работает", color: "magenta" },
  { tier: "Recommended", vram: "8 GB", model: "Coder-7B Q4", note: "Sweet spot · отличное качество", color: "acid" },
  { tier: "Pro", vram: "12+ GB", model: "Coder-14B Q4", note: "Максимум качество, быстро", color: "accent" },
  { tier: "Apple Silicon", vram: "M1-M4", model: "MLX · Coder-7B", note: "Unified memory, без выделенного GPU", color: "violet" },
];

type Bench = {
  gpu: string;
  model: string;
  speed: string;
  fullSite: string;
};

const BENCHMARKS: Bench[] = [
  { gpu: "RTX 3060 8GB", model: "Qwen2.5-Coder-7B Q4_K_M", speed: "~28 tok/s", fullSite: "~45 сек" },
  { gpu: "RTX 4060 8GB", model: "Qwen2.5-Coder-7B Q4_K_M", speed: "~52 tok/s", fullSite: "~28 сек" },
  { gpu: "RTX 4070 12GB", model: "Qwen2.5-Coder-14B Q4", speed: "~38 tok/s", fullSite: "~32 сек" },
  { gpu: "RTX 4090 24GB", model: "Qwen2.5-Coder-32B Q4", speed: "~58 tok/s", fullSite: "~18 сек" },
  { gpu: "Apple M2 Pro", model: "Coder-7B MLX 4-bit", speed: "~45 tok/s", fullSite: "~30 сек" },
  { gpu: "Apple M4 Max", model: "Coder-14B MLX 4-bit", speed: "~62 tok/s", fullSite: "~20 сек" },
];

export function HardwareSection() {
  return (
    <section id="stack" className="relative z-10 max-w-[1400px] mx-auto px-8 py-32">
      <div className="flex justify-between items-end mb-12 flex-wrap gap-6">
        <div>
          <RevealOnScroll>
            <SectionLabel number="04">Hardware tier</SectionLabel>
          </RevealOnScroll>
          <RevealOnScroll>
            <h2 className="nit-display text-[clamp(36px,5vw,72px)]">
              Какое железо
              <br />
              тебе хватит
            </h2>
          </RevealOnScroll>
        </div>
        <RevealOnScroll>
          <p className="text-[12px] text-[color:var(--muted)] max-w-[320px] leading-[1.7]">
            Минимум — 4ГБ VRAM. Оптимально — 8ГБ. Apple Silicon (M1/M2/M3/M4)
            работает без выделенного GPU — модель грузится в unified memory.
            Никаких облачных API. Только локальный inference.
          </p>
        </RevealOnScroll>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px"
        style={{
          background: "var(--line-strong)",
          border: "1px solid var(--line-strong)",
        }}
      >
        {HARDWARE.map((h, i) => (
          <RevealOnScroll key={h.tier} delay={i * 60}>
            <HardwareCell {...h} />
          </RevealOnScroll>
        ))}
      </div>

      {/* Real-world benchmarks */}
      <RevealOnScroll delay={300}>
        <div className="mt-16">
          <div className="flex items-baseline gap-4 mb-4 flex-wrap">
            <span
              className="text-[10px] tracking-[0.2em] uppercase px-2 py-1"
              style={{
                color: "var(--acid)",
                border: "1px solid var(--acid)",
                fontFamily: "var(--font-mono)",
              }}
            >
              ⏵ BENCHMARKS
            </span>
            <h3 className="nit-display text-[20px]">
              Сколько секунд на полный лендинг
            </h3>
          </div>
          <p className="text-[12px] text-[color:var(--muted)] mb-6 max-w-[700px]">
            Замеры на реальном железе. Полная типичная landing page (4-6
            секций, hero + features + cta), Tailwind CDN, без иконок-зависимостей.
            ±30% по запросу (длина промпта, контекст модели, прогрев).
          </p>
        </div>
      </RevealOnScroll>

      <RevealOnScroll delay={400}>
        <div
          className="overflow-x-auto"
          style={{ border: "1px solid var(--line-strong)" }}
        >
          <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-2)" }}>
                <th className="p-4 text-[10px] tracking-[0.2em] uppercase text-[color:var(--muted)] font-normal">
                  GPU / Chip
                </th>
                <th className="p-4 text-[10px] tracking-[0.2em] uppercase text-[color:var(--muted)] font-normal">
                  Model
                </th>
                <th className="p-4 text-[10px] tracking-[0.2em] uppercase text-[color:var(--muted)] font-normal">
                  Tokens/s
                </th>
                <th
                  className="p-4 text-[10px] tracking-[0.2em] uppercase font-normal"
                  style={{ color: "var(--acid)" }}
                >
                  Full landing
                </th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARKS.map((b, i) => (
                <tr
                  key={b.gpu}
                  style={{
                    borderTop: "1px solid var(--line)",
                    background: i % 2 === 0 ? "var(--bg)" : "rgba(255,255,255,0.01)",
                  }}
                >
                  <td className="p-4 text-[12px] text-[color:var(--ink)] font-mono">
                    {b.gpu}
                  </td>
                  <td className="p-4 text-[12px] text-[color:var(--muted)] font-mono">
                    {b.model}
                  </td>
                  <td className="p-4 text-[12px] text-[color:var(--muted)] font-mono">
                    {b.speed}
                  </td>
                  <td
                    className="p-4 text-[13px] font-mono"
                    style={{ color: "var(--acid)" }}
                  >
                    {b.fullSite}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RevealOnScroll>

      <RevealOnScroll delay={500}>
        <p className="text-[11px] text-[color:var(--muted-2)] mt-4 leading-[1.7]">
          ⏵ Сравни с Vercel v0 (~40-60 сек за prompt в облаке + сетевые
          задержки) или Bolt (build-step Vite после каждой правки). Локальный
          inference выигрывает не только по приватности — он зачастую быстрее.
        </p>
      </RevealOnScroll>
    </section>
  );
}

function HardwareCell({ tier, vram, model, note, color }: Hardware) {
  const c = {
    accent: "var(--accent-glow)",
    acid: "var(--acid)",
    magenta: "var(--magenta)",
    violet: "var(--violet-glow)",
  }[color];
  return (
    <div className="p-8 min-h-[260px] flex flex-col justify-between" style={{ background: "var(--bg)" }}>
      <div>
        <div className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ color: c }}>
          {tier}
        </div>
        <div className="nit-display text-[36px] mb-2" style={{ color: "var(--ink)" }}>
          {vram}
        </div>
        <div className="text-[11px] text-[color:var(--muted)] tracking-[0.05em] mb-5">
          {model}
        </div>
      </div>
      <div className="text-[11px] text-[color:var(--muted)] leading-[1.6]">{note}</div>
    </div>
  );
}
