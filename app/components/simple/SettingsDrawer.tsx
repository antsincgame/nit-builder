/**
 * SettingsDrawer v2 — русский, без "// settings" / "CONFIGURATION".
 */

import { useState, useEffect } from "react";
import { AccountSection } from "~/components/settings/AccountSection";
import { TunnelTokenSection } from "~/components/settings/TunnelTokenSection";
import { ShortcutsSection } from "~/components/settings/ShortcutsSection";
import { AboutSection } from "~/components/settings/AboutSection";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsDrawer({ isOpen, onClose }: Props) {
  const [resetSignal, setResetSignal] = useState(false);
  useEffect(() => {
    if (!isOpen) {
      setResetSignal((s) => !s);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <h2 className="nit-display" style={{ fontSize: 20, color: "var(--ink)" }}>
            Настройки
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg transition flex items-center justify-center"
            style={{ color: "var(--muted)" }}
            aria-label="Закрыть"
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elev)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-7 max-h-[70vh] overflow-y-auto">
          <AccountSection onClose={onClose} />
          <TunnelTokenSection resetSignal={resetSignal} />
          <ShortcutsSection />
          <AboutSection />
        </div>
      </div>
    </div>
  );
}
