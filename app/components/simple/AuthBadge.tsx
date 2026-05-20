/**
 * AuthBadge v2 — русский, без // префиксов, без "Download CLI".
 * Ссылка "Скачать" в dropdown ведёт на /download (человекоориентированную версию).
 */

import { useState, useRef, useEffect } from "react";
import type { AuthState } from "~/lib/contexts/AuthContext";
import { useAuthRefetch } from "~/lib/contexts/AuthContext";

type Props = {
  auth: AuthState;
  onOpenSettings: () => void;
};

export function AuthBadge({ auth, onOpenSettings }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const refetchAuth = useAuthRefetch();

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      await refetchAuth();
      setMenuOpen(false);
    } catch {
      await refetchAuth();
    } finally {
      setLoggingOut(false);
    }
  }

  if (auth.status === "loading") {
    return (
      <div
        className="hidden sm:flex items-center px-3 py-2 rounded-md"
        style={{ border: "1px solid var(--line)" }}
      >
        <div
          className="w-16 h-3 animate-pulse rounded"
          style={{ background: "var(--line-strong)" }}
        />
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <div className="flex gap-1.5 items-center">
        <a
          href="/login"
          className="hidden sm:inline-block px-3 py-2 text-[13px] no-underline transition-colors"
          style={{ color: "var(--muted)" }}
        >
          Войти
        </a>
        <a
          href="/register"
          className="btn-primary"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          Регистрация
        </a>
      </div>
    );
  }

  const initial = auth.email[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-md transition"
        style={{
          border: "1px solid var(--line-strong)",
          background: "rgba(19, 20, 27, 0.6)",
        }}
        title={`Вы вошли как ${auth.email}`}
      >
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-bold"
          style={{ background: "var(--ink)", color: "var(--bg)" }}
        >
          {initial}
        </span>
        <span
          className="hidden md:inline text-[13px] max-w-[140px] truncate"
          style={{ color: "var(--ink-dim)" }}
        >
          {auth.email}
        </span>
        <svg
          className={`w-3 h-3 transition-transform ${menuOpen ? "rotate-180" : ""}`}
          style={{ color: "var(--muted)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 mt-2 w-64 z-50 rounded-xl overflow-hidden"
          style={{
            background: "rgba(19, 20, 27, 0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--line-strong)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          }}
        >
          <div className="p-4" style={{ borderBottom: "1px solid var(--line)" }}>
            <div className="text-[12px] mb-1" style={{ color: "var(--muted-2)" }}>
              Вы вошли как
            </div>
            <div className="text-[14px] truncate" style={{ color: "var(--ink)" }}>
              {auth.email}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onOpenSettings();
            }}
            className="w-full text-left px-4 py-3 text-[14px] transition flex items-center gap-3"
            style={{ color: "var(--ink-dim)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
              e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-dim)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Настройки</span>
          </button>
          <a
            href="/download"
            className="w-full text-left px-4 py-3 text-[14px] no-underline transition flex items-center gap-3"
            style={{ color: "var(--ink-dim)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
              e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-dim)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Скачать на компьютер</span>
          </a>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-left px-4 py-3 text-[14px] transition flex items-center gap-3 disabled:opacity-50"
            style={{
              borderTop: "1px solid var(--line)",
              color: "var(--pink)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(244, 114, 182, 0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{loggingOut ? "Выходим…" : "Выйти"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
