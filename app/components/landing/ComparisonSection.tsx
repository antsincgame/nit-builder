/**
 * ComparisonSection — NITGEN vs Bolt vs v0 vs Tilda.
 * Минималистичная таблица. На мобиле — скролл вправо.
 */

const FEATURES = [
  { f: "Работает офлайн", nitgen: true, bolt: false, v0: false, tilda: false },
  { f: "Бесплатно навсегда", nitgen: true, bolt: false, v0: false, tilda: false },
  { f: "Промпты не попадают в облако", nitgen: true, bolt: false, v0: false, tilda: "n/a" },
  { f: "Open source (MIT)", nitgen: true, bolt: false, v0: false, tilda: false },
  { f: "Никаких лимитов на день", nitgen: true, bolt: false, v0: false, tilda: "n/a" },
  { f: "Готовый HTML одним файлом", nitgen: true, bolt: false, v0: false, tilda: false },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{ background: "var(--ink)", color: "var(--bg)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{ border: "1px solid var(--line-strong)", color: "var(--muted-2)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </span>
    );
  }
  return <span className="text-[12px]" style={{ color: "var(--muted-2)" }}>{value}</span>;
}

export function ComparisonSection() {
  return (
    <section className="px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-8 sm:mb-12">
          <div className="text-[12px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--muted-2)" }}>
            Чем отличается
          </div>
          <h2
            className="nit-display mb-3"
            style={{ fontSize: "clamp(28px, 4.5vw, 44px)", color: "var(--ink)" }}
          >
            NITGEN вс. остальные
          </h2>
          <p className="text-[14px] sm:text-[16px] max-w-[560px]" style={{ color: "var(--muted)" }}>
            Облачные AI-конструкторы львиной долей продают подписки и читают твои промпты.
            NITGEN крутится на твоём GPU.
          </p>
        </div>

        <div className="-mx-5 sm:mx-0 overflow-x-auto">
          <div
            className="min-w-[640px] mx-5 sm:mx-0 rounded-xl overflow-hidden"
            style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
          >
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th className="text-left p-4 text-[13px] font-medium" style={{ color: "var(--muted-2)" }}></th>
                  <th className="p-4 text-[14px] font-semibold" style={{ color: "var(--ink)" }}>NITGEN</th>
                  <th className="p-4 text-[14px] font-medium" style={{ color: "var(--muted)" }}>Bolt</th>
                  <th className="p-4 text-[14px] font-medium" style={{ color: "var(--muted)" }}>v0</th>
                  <th className="p-4 text-[14px] font-medium" style={{ color: "var(--muted)" }}>Tilda</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((row, i) => (
                  <tr
                    key={row.f}
                    style={{
                      borderBottom: i < FEATURES.length - 1 ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <td className="p-4 text-[14px]" style={{ color: "var(--ink-dim)" }}>{row.f}</td>
                    <td className="p-4 text-center"><Cell value={row.nitgen} /></td>
                    <td className="p-4 text-center"><Cell value={row.bolt} /></td>
                    <td className="p-4 text-center"><Cell value={row.v0} /></td>
                    <td className="p-4 text-center"><Cell value={row.tilda} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
