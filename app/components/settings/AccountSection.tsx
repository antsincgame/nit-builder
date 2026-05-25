/**
 * AccountSection v3 — эстетика лендинга: Tailwind вместо var(--*),
 * emerald-акценты, rose для опасных действий.
 */

import { useState } from "react";
import { useAuth, useAuthRefetch } from "~/lib/contexts/AuthContext";

type Props = {
  onClose: () => void;
};

export function AccountSection({ onClose }: Props) {
  const auth = useAuth();
  const refetchAuth = useAuthRefetch();
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await refetchAuth();
    onClose();
  }

  async function handleLogoutAll() {
    // eslint-disable-next-line no-alert -- intentional destructive confirmation
    if (!confirm("Выйти со всех устройств? Все активные сессии будут закрыты.")) {
      return;
    }
    setLoggingOutAll(true);
    try {
      await fetch("/api/auth/logout-all", {
        method: "POST",
        credentials: "include",
      });
      await refetchAuth();
      onClose();
    } finally {
      setLoggingOutAll(false);
    }
  }

  if (auth.status === "unauthenticated") {
    return (
      <div>
        <SectionHeader>Аккаунт</SectionHeader>
        <div className="flex gap-2">
          <a
            href="/login"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-[13px] border border-white/[0.08] bg-white/[0.02] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] transition"
          >
            Войти
          </a>
          <a
            href="/register"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-[13px] bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold transition-all shadow-[0_0_18px_rgba(16,185,129,0.3)]"
          >
            Регистрация
          </a>
        </div>
      </div>
    );
  }

  if (auth.status !== "authenticated") return null;

  return (
    <div>
      <SectionHeader>Аккаунт</SectionHeader>
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] mb-1 text-[#71717A]/70">Email</div>
            <div className="text-sm truncate text-white">{auth.email}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2 text-[13px] rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/[0.08] transition shrink-0"
          >
            Выйти
          </button>
        </div>
        <div className="mt-4 pt-3 flex items-center justify-between gap-3 border-t border-white/[0.06]">
          <span className="text-[12px] text-[#71717A]">
            Если вы потеряли устройство или подозреваете утечку
          </span>
          <button
            type="button"
            onClick={handleLogoutAll}
            disabled={loggingOutAll}
            className="text-[12px] text-rose-300 hover:text-rose-200 transition disabled:opacity-40 shrink-0"
          >
            {loggingOutAll ? "…" : "Выйти везде →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-3 text-[#71717A]/80">
      {children}
    </div>
  );
}
