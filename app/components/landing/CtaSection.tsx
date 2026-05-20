/**
 * CtaSection v4.1 — человечный призыв.
 */

import { useState } from "react";
import { RevealOnScroll } from "~/components/landing/RevealOnScroll";
import { DownloadModal } from "~/components/landing/DownloadModal";

type Props = { isAuthed: boolean };

export function CtaSection({ isAuthed }: Props) {
  const [showDownload, setShowDownload] = useState(false);
  return (
    <section className="relative px-5 sm:px-8 py-20 sm:py-28 overflow-hidden" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="section-tint section-tint-pink" aria-hidden />
      <div className="relative max-w-[720px] mx-auto text-center">
        <RevealOnScroll>
          <h2
            className="nit-display mb-5 sm:mb-6"
            style={{ fontSize: "clamp(28px, 5vw, 44px)", color: "var(--ink)" }}
          >
            Сделайте свой
            <br />
            <span className="nit-text-gradient-cyan">первый сайт</span>
          </h2>
        </RevealOnScroll>
        <RevealOnScroll delay={100}>
          <p
            className="mb-8 sm:mb-10 max-w-[440px] mx-auto text-[15px] sm:text-[17px]"
            style={{ color: "var(--muted)", lineHeight: 1.55 }}
          >
            Бесплатно. Без карты. Без ограничений.
          </p>
        </RevealOnScroll>
        <RevealOnScroll delay={200}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowDownload(true)}
              className="btn-gradient w-full sm:w-auto"
              style={{ padding: "14px 28px", fontSize: 15 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Скачать на компьютер
            </button>
            <a
              href={isAuthed ? "/app" : "/register"}
              className="btn-ghost w-full sm:w-auto"
              style={{ padding: "14px 28px", fontSize: 15 }}
            >
              Попробовать сейчас
            </a>
          </div>
        </RevealOnScroll>
      </div>
      <DownloadModal open={showDownload} onClose={() => setShowDownload(false)} />
    </section>
  );
}
