/**
 * DownloadModal v2 — упрощённые формулировки без "настольное приложение».
 */

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function DownloadModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSubmitted(false);
        setEmail("");
        setError(null);
      }, 200);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = email.trim();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError("Проверьте правильность email");
      return;
    }
    try {
      const subs = JSON.parse(localStorage.getItem("desktop-waitlist") || "[]");
      if (!subs.includes(v)) subs.push(v);
      localStorage.setItem("desktop-waitlist", JSON.stringify(subs));
    } catch {
      /* ignore */
    }
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
      style={{ background: "rgba(5, 6, 10, 0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[440px] rounded-2xl p-6 sm:p-8"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition"
          style={{ color: "var(--muted)" }}
          aria-label="Закрыть"
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elev)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        {!submitted ? (
          <>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full text-[11px] font-semibold"
              style={{
                background: "rgba(251, 191, 36, 0.1)",
                border: "1px solid rgba(251, 191, 36, 0.35)",
                color: "var(--amber)",
              }}
            >
              Скоро
            </div>
            <h3 className="nit-display mb-3" style={{ fontSize: 26, color: "var(--ink)" }}>
              Приложение для компьютера
            </h3>
            <p className="mb-6 text-[14px] sm:text-[15px]" style={{ color: "var(--muted)" }}>
              Готовим версии для Windows, Mac и Linux. Оставьте email — пришлём ссылку, когда будет готово.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vasha@pochta.ru"
                autoComplete="email"
                required
                autoFocus
                className="w-full px-4 py-3 text-[15px] outline-none rounded-lg"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--line-strong)",
                  color: "var(--ink)",
                }}
              />
              {error && (
                <div className="text-[13px]" style={{ color: "var(--pink)" }}>
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary w-full" style={{ padding: "12px 22px" }}>
                Прислать ссылку
              </button>
              <a
                href="/register"
                className="block text-center text-[13px] py-2"
                style={{ color: "var(--muted-2)" }}
              >
                Попробовать сейчас в браузере →
              </a>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
              style={{
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid var(--green)",
                color: "var(--green)",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 className="nit-display mb-3" style={{ fontSize: 24, color: "var(--ink)" }}>
              Готово
            </h3>
            <p className="text-[14px] sm:text-[15px]" style={{ color: "var(--muted)", lineHeight: 1.55 }}>
              Пришлём ссылку на <span style={{ color: "var(--ink)" }}>{email}</span>, как только приложение будет готово.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost w-full mt-6"
              style={{ padding: "12px 22px" }}
            >
              Хорошо
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
