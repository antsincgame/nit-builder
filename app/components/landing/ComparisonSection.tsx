/**
 * ComparisonSection — секция "02 · NITGEN vs cloud builders".
 *
 * Брутальная сравнительная таблица: NITGEN vs v0 vs Bolt vs Lovable.
 * 9 строк по конкретным критериям (GPU/cost/limits/privacy/lock-in/
 * export/open-source/php-baked CMS/censorship).
 *
 * На мобильном превращается в стек карточек (по продукту), на десктопе —
 * классическая table-grid. Цветовой акцент: NITGEN-колонка подсвечена
 * acid-зелёным, чтобы взгляд сразу шёл туда.
 */

import { RevealOnScroll, SectionLabel } from "~/components/nit";

type Cell = { v: string; ok?: boolean; bad?: boolean };

type Row = {
  label: string;
  nit: Cell;
  v0: Cell;
  bolt: Cell;
  lovable: Cell;
};

const ROWS: Row[] = [
  {
    label: "Где крутится LLM",
    nit: { v: "Твой GPU", ok: true },
    v0: { v: "OpenAI cloud", bad: true },
    bolt: { v: "Anthropic", bad: true },
    lovable: { v: "OpenAI cloud", bad: true },
  },
  {
    label: "Цена / мес",
    nit: { v: "0$", ok: true },
    v0: { v: "$20", bad: true },
    bolt: { v: "$20", bad: true },
    lovable: { v: "$25", bad: true },
  },
  {
    label: "Лимит генераций",
    nit: { v: "∞", ok: true },
    v0: { v: "100 msgs", bad: true },
    bolt: { v: "10M токенов", bad: true },
    lovable: { v: "100 prompts", bad: true },
  },
  {
    label: "Приватность промптов",
    nit: { v: "100% local", ok: true },
    v0: { v: "Логи OpenAI", bad: true },
    bolt: { v: "Логи Anthropic", bad: true },
    lovable: { v: "Логи OpenAI", bad: true },
  },
  {
    label: "Export сайта",
    nit: { v: "1 .html файл", ok: true },
    v0: { v: "GitHub лок", bad: true },
    bolt: { v: "Vendor runtime", bad: true },
    lovable: { v: "Supabase + UI", bad: true },
  },
  {
    label: "PHP-baked CMS",
    nit: { v: "ZIP с админкой", ok: true },
    v0: { v: "—" },
    bolt: { v: "—" },
    lovable: { v: "—" },
  },
  {
    label: "Open source",
    nit: { v: "MIT · GitHub", ok: true },
    v0: { v: "Closed", bad: true },
    bolt: { v: "Partial", bad: true },
    lovable: { v: "Closed", bad: true },
  },
  {
    label: "Цензура / content rules",
    nit: { v: "Локальная модель — никаких", ok: true },
    v0: { v: "OpenAI moderation", bad: true },
    bolt: { v: "Anthropic", bad: true },
    lovable: { v: "OpenAI", bad: true },
  },
  {
    label: "Undo / redo полировок",
    nit: { v: "⌘Z история", ok: true },
    v0: { v: "—" },
    bolt: { v: "✓" },
    lovable: { v: "—" },
  },
];

export function ComparisonSection() {
  return (
    <section id="compare" className="relative z-10 max-w-[1400px] mx-auto px-8 py-32">
      <RevealOnScroll>
        <SectionLabel number="02">NITGEN vs cloud builders</SectionLabel>
      </RevealOnScroll>
      <RevealOnScroll>
        <h2 className="nit-display text-[clamp(36px,5vw,72px)] mb-6 max-w-[900px]">
          Сравни{" "}
          <em
            className="not-italic"
            style={{ color: "transparent", WebkitTextStroke: "1.5px var(--acid)" }}
          >
            честно
          </em>
          .<br />
          И сам реши.
        </h2>
      </RevealOnScroll>
      <RevealOnScroll delay={100}>
        <p className="text-[14px] text-[color:var(--muted)] max-w-[700px] leading-[1.7] mb-12">
          Публичные цены и лимиты конкурентов на момент мая 2026. Если что-то
          поменялось — открой issue, обновим.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delay={150}>
        {/* Desktop table */}
        <div
          className="hidden md:block overflow-x-auto"
          style={{ border: "1px solid var(--line-strong)" }}
        >
          <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-2)" }}>
                <th className="p-4 text-[10px] tracking-[0.2em] uppercase text-[color:var(--muted)] font-normal">
                  Criterion
                </th>
                <th
                  className="p-4 text-[12px] tracking-[0.15em] uppercase font-normal"
                  style={{
                    color: "var(--acid)",
                    borderLeft: "2px solid var(--acid)",
                    background: "rgba(212,255,0,0.05)",
                  }}
                >
                  NITGEN
                </th>
                <th className="p-4 text-[12px] tracking-[0.15em] uppercase text-[color:var(--ink)] font-normal">
                  v0 Premium
                </th>
                <th className="p-4 text-[12px] tracking-[0.15em] uppercase text-[color:var(--ink)] font-normal">
                  Bolt Pro
                </th>
                <th className="p-4 text-[12px] tracking-[0.15em] uppercase text-[color:var(--ink)] font-normal">
                  Lovable Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  style={{
                    borderTop: "1px solid var(--line)",
                    background: i % 2 === 0 ? "var(--bg)" : "rgba(255,255,255,0.01)",
                  }}
                >
                  <td className="p-4 text-[12px] text-[color:var(--muted)]">
                    {row.label}
                  </td>
                  <TableCell
                    cell={row.nit}
                    highlight
                  />
                  <TableCell cell={row.v0} />
                  <TableCell cell={row.bolt} />
                  <TableCell cell={row.lovable} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stack по продуктам */}
        <div className="md:hidden flex flex-col gap-4">
          <ProductCard name="NITGEN" highlight rows={ROWS} pick={(r) => r.nit} />
          <ProductCard name="v0 Premium" rows={ROWS} pick={(r) => r.v0} />
          <ProductCard name="Bolt Pro" rows={ROWS} pick={(r) => r.bolt} />
          <ProductCard name="Lovable Pro" rows={ROWS} pick={(r) => r.lovable} />
        </div>
      </RevealOnScroll>

      <RevealOnScroll delay={250}>
        <p className="text-[12px] text-[color:var(--muted-2)] mt-6 max-w-[700px]">
          ⏵ Конкуренты не делают много того что есть у нас (PHP-baked CMS,
          peer-to-peer туннель, MIT). Мы не делаем некоторые их фичи (deploy
          в один клик на их облако). Это разные продукты для разных людей.
          Если ты ценишь контроль — мы.
        </p>
      </RevealOnScroll>
    </section>
  );
}

function TableCell({ cell, highlight }: { cell: Cell; highlight?: boolean }) {
  const color = cell.ok
    ? "var(--acid)"
    : cell.bad
    ? "var(--magenta)"
    : "var(--muted)";
  return (
    <td
      className="p-4 text-[12px] font-mono"
      style={{
        color,
        borderLeft: highlight ? "2px solid var(--acid)" : undefined,
        background: highlight ? "rgba(212,255,0,0.03)" : undefined,
      }}
    >
      {cell.v}
    </td>
  );
}

function ProductCard({
  name,
  highlight,
  rows,
  pick,
}: {
  name: string;
  highlight?: boolean;
  rows: Row[];
  pick: (r: Row) => Cell;
}) {
  return (
    <div
      style={{
        border: highlight ? "1px solid var(--acid)" : "1px solid var(--line)",
        background: highlight ? "rgba(212,255,0,0.04)" : "var(--bg)",
      }}
    >
      <div
        className="p-4 text-[12px] tracking-[0.2em] uppercase"
        style={{
          color: highlight ? "var(--acid)" : "var(--ink)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        {name}
      </div>
      <div className="p-4 grid grid-cols-1 gap-3">
        {rows.map((r) => {
          const c = pick(r);
          const color = c.ok ? "var(--acid)" : c.bad ? "var(--magenta)" : "var(--muted)";
          return (
            <div key={r.label} className="flex justify-between gap-4 text-[12px]">
              <span className="text-[color:var(--muted)]">{r.label}</span>
              <span className="font-mono text-right" style={{ color }}>
                {c.v}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
