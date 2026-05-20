/**
 * LandingNav v4 — упрощённый язык, с кнопкой "Скачать" вместо GitHub на мобиле.
 */

import { useState } from "react";
import { DownloadModal } from "~/components/landing/DownloadModal";

type Props = { isAuthed: boolean };

export function LandingNav({ isAuthed }: Props) {
  const [showDownload, setShowDownload] = useState(false);

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full backdrop-blur-md"
        style={{
          background: "rgba(10, 11, 16, 0.7)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 no-underline">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[14px]"
              style={{ background: "var(--ink)", color: "var(--bg)" }}
            >
              N
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[color:var(--ink)]">
              nitgen
            </span>
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthed ? (
              <a href="/app" className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
                Открыть приложение →
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  className="text-[13px] hidden sm:inline-block px-3 py-2 transition-colors"
                  style={{ color: "var(--muted)" }}
                >
                  Войти
                </a>
                <button
                  type="button"
                  onClick={() => setShowDownload(true)}
                  className="btn-primary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Скачать
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <DownloadModal open={showDownload} onClose={() => setShowDownload(false)} />
    </>
  );
}
