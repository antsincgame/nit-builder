/**
 * AboutSection v2 — без uppercase, мягче.
 */

import { NIT_SERVER_VERSION } from "@nit/shared";

export function AboutSection() {
  return (
    <div className="pt-4" style={{ borderTop: "1px solid var(--line)" }}>
      <div
        className="flex items-center justify-between text-[12px]"
        style={{ color: "var(--muted-2)" }}
      >
        <span>NITGEN · v{NIT_SERVER_VERSION}</span>
        <div className="flex gap-4">
          <a
            href="https://github.com/igor1000rr/nit-builder"
            target="_blank"
            rel="noopener"
            className="no-underline transition"
            style={{ color: "var(--muted)" }}
          >
            GitHub
          </a>
          <a
            href="mailto:hello@nitgen.org"
            className="no-underline transition"
            style={{ color: "var(--muted)" }}
          >
            Поддержка
          </a>
        </div>
      </div>
    </div>
  );
}
