/**
 * HeroSection v4 — без чата. Простой заголовок и 2 кнопки.
 *
 * Главная цель — сразу объяснить что это и дать выбор: скачать приложение
 * или открыть в браузере. Десктопный клиент ещё не сборкан — кнопка открывает
 * DownloadModal с подпиской на уведомление.
 */

import { useState } from "react";
import { RevealOnScroll } from "~/components/landing/RevealOnScroll";
import { DownloadModal } from "~/components/landing/DownloadModal";

type Props = { isAuthed: boolean };

export function HeroSection({ isAuthed }: Props) {
  const [showDownload, setShowDownload] = useState(false);

  return (
    <section className="relative px-5 sm:px-8 pt-16 sm:pt-24 pb-12 sm:pb-20">
      <div className="section-tint section-tint-cyan" aria-hidden />
      <div className="relative max-w-[760px] mx-auto text-center">
        <RevealOnScroll>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 sm:mb-8 rounded-full text-[12px]"
            style={{
              border: "1px solid var(--line-strong)",
              background: "rgba(19, 20, 27, 0.6)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: "var(--muted)",
            }}
          >
            <span className="nit-dot-live" />
            Бесплатно и без подписок
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={80}>
          <h1
            className="nit-display mb-5 sm:mb-7"
            style={{ fontSize: "clamp(34px, 6vw, 56px)", color: "var(--ink)" }}
          >
            Сайты без
            <br />
            <span className="nit-text-gradient-cyan">программирования</span>
          </h1>
        </RevealOnScroll>

        <RevealOnScroll delay={160}>
          <p
            className="mb-8 sm:mb-10 max-w-[520px] mx-auto"
            style={{
              fontSize: "clamp(15px, 2vw, 17px)",
              color: "var(--muted)",
              lineHeight: 1.6,
            }}
          >
            Опиши свой бизнес — приложение сделает сайт за минуту.
            Никакого кода, никаких подписок, всё работает на вашем компьютере.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={240}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
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
              Скачать приложение
            </button>
            <a
              href={isAuthed ? "/app" : "/register"}
              className="btn-ghost w-full sm:w-auto"
              style={{ padding: "14px 28px", fontSize: 15 }}
            >
              Попробовать в браузере
            </a>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={320}>
          <div className="text-[12px] sm:text-[13px]" style={{ color: "var(--muted-2)" }}>
            Windows · macOS · Linux
          </div>
        </RevealOnScroll>
      </div>

      <DownloadModal open={showDownload} onClose={() => setShowDownload(false)} />
    </section>
  );
}
