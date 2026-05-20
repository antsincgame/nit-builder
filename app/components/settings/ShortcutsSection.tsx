/**
 * ShortcutsSection v2 — русский, без "// shortcuts" префикса.
 */

const SHORTCUTS = [
  { keys: "⌘ + Enter", desc: "Создать сайт" },
  { keys: "⌘ + H", desc: "История сайтов" },
  { keys: "⌘ + D", desc: "Скачать сайт" },
  { keys: "⌘ + ,", desc: "Настройки" },
  { keys: "⌘ + Z", desc: "Отменить изменение" },
  { keys: "Esc", desc: "Закрыть / отменить" },
];

export function ShortcutsSection() {
  return (
    <div>
      <div className="text-[12px] font-semibold mb-3" style={{ color: "var(--ink-dim)" }}>
        Горячие клавиши
      </div>
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--line)", background: "rgba(255, 255, 255, 0.02)" }}
      >
        {SHORTCUTS.map((sc, i) => (
          <div
            key={sc.keys}
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              borderTop: i === 0 ? undefined : "1px solid var(--line)",
            }}
          >
            <span className="text-[13px]" style={{ color: "var(--ink-dim)" }}>
              {sc.desc}
            </span>
            <kbd
              className="px-2 py-1 text-[12px] font-mono rounded-md"
              style={{
                border: "1px solid var(--line-strong)",
                color: "var(--ink-dim)",
                background: "var(--bg)",
              }}
            >
              {sc.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
