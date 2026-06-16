/**
 * SettingsDrawer v3 — эстетика лендинга: чёрный модал, без var(--*),
 * lucide X. Секции внутри свои (Account/Devices/TunnelToken/Shortcuts/About).
 */

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { AccountSection } from "~/components/settings/AccountSection";
import { DevicesSection } from "~/components/settings/DevicesSection";
import { TunnelTokenSection } from "~/components/settings/TunnelTokenSection";
import { ShortcutsSection } from "~/components/settings/ShortcutsSection";
import { AboutSection } from "~/components/settings/AboutSection";
import { ExperimentsSection } from "~/components/settings/ExperimentsSection";

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
      className="fixed inset-0 z-[90] backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-[#0A0A0A] border border-white/[0.08] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.06]">
          <h2 className="text-xl font-semibold tracking-tight text-white">Настройки</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg transition flex items-center justify-center text-[#71717A] hover:text-white hover:bg-white/[0.04]"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-7 max-h-[70vh] overflow-y-auto">
          <AccountSection onClose={onClose} />
          <DevicesSection resetSignal={resetSignal} />
          <TunnelTokenSection resetSignal={resetSignal} />
          <ExperimentsSection />
          <ShortcutsSection />
          <AboutSection />
        </div>
      </div>
    </div>
  );
}
