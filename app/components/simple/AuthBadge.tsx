/**
 * AuthBadge v3 — эстетика лендинга: чёрный dropdown, emerald-акценты,
 * lucide иконки (Settings, Download, LogOut, ChevronDown).
 */

import { useState, useRef, useEffect } from "react";
import { Settings, Download, LogOut, ChevronDown } from "lucide-react";
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
      <div className="hidden sm:flex items-center px-3 py-2 rounded-md border border-white/[0.06]">
        <div className="w-16 h-3 animate-pulse rounded bg-white/[0.08]" />
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <div className="flex gap-1.5 items-center">
        <a
          href="/login"
          className="hidden sm:inline-block px-3 py-2 text-[13px] text-[#71717A] hover:text-white transition-colors"
        >
          Войти
        </a>
        <a
          href="/register"
          className="inline-flex items-center px-4 py-2 rounded-lg text-[13px] bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold transition-all shadow-[0_0_18px_rgba(16,185,129,0.3)]"
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
        className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-md border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.15] transition"
        title={`Вы вошли как ${auth.email}`}
      >
        <span className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
          {initial}
        </span>
        <span className="hidden md:inline text-[13px] max-w-[140px] truncate text-[#A1A1AA]">
          {auth.email}
        </span>
        <ChevronDown
          size={12}
          className={`text-[#71717A] transition-transform ${menuOpen ? "rotate-180" : ""}`}
        />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-64 z-50 rounded-xl overflow-hidden border border-white/[0.08] bg-[#141414] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="text-[11px] mb-1 text-[#71717A]/70">Вы вошли как</div>
            <div className="text-[14px] truncate text-white">{auth.email}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onOpenSettings();
            }}
            className="w-full text-left px-4 py-3 text-[14px] transition flex items-center gap-3 text-[#A1A1AA] hover:bg-white/[0.04] hover:text-white"
          >
            <Settings size={16} />
            <span>Настройки</span>
          </button>
          <a
            href="/download"
            className="w-full text-left px-4 py-3 text-[14px] no-underline transition flex items-center gap-3 text-[#A1A1AA] hover:bg-white/[0.04] hover:text-white"
          >
            <Download size={16} />
            <span>Скачать на компьютер</span>
          </a>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-left px-4 py-3 text-[14px] transition flex items-center gap-3 disabled:opacity-50 border-t border-white/[0.06] text-rose-300 hover:bg-rose-500/[0.06]"
          >
            <LogOut size={16} />
            <span>{loggingOut ? "Выходим…" : "Выйти"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
