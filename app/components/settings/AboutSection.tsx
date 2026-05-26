/**
 * AboutSection v3 — эстетика лендинга.
 */

import { NIT_SERVER_VERSION } from "@nit/shared";

export function AboutSection() {
  return (
    <div className="pt-4 border-t border-white/[0.06]">
      <div className="flex items-center justify-between text-[12px] text-[#71717A]">
        <span>nitgen · v{NIT_SERVER_VERSION}</span>
        <div className="flex gap-4">
          <a
            href="https://github.com/antsincgame/nit-builder"
            target="_blank"
            rel="noopener"
            className="no-underline text-[#A1A1AA] hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="mailto:hello@nitgen.org"
            className="no-underline text-[#A1A1AA] hover:text-white transition-colors"
          >
            Поддержка
          </a>
        </div>
      </div>
    </div>
  );
}
