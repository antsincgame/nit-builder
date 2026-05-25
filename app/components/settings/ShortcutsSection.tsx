/**
 * ShortcutsSection v3 — эстетика лендинга.
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
      <div className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-3 text-[#71717A]/80">
        Горячие клавиши
      </div>
      <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]">
        {SHORTCUTS.map((sc, i) => (
          <div
            key={sc.keys}
            className={`flex items-center justify-between px-4 py-2.5 ${i === 0 ? "" : "border-t border-white/[0.04]"}`}
          >
            <span className="text-[13px] text-[#A1A1AA]">{sc.desc}</span>
            <kbd className="px-2 py-1 text-[11px] font-mono rounded-md border border-white/[0.08] bg-black/40 text-[#A1A1AA]">
              {sc.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
