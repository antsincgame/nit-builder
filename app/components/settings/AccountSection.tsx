/**
 * AccountSection v2 — русский, без "// account" префикса. Tunnel-статус скрыт
 * (юзер не должен видеть техно-индикатор; он есть в TunnelTokenSection для
 * тех кому это важно).
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
            className="flex-1 btn-ghost"
            style={{ padding: "10px 16px", fontSize: 13 }}
          >
            Войти
          </a>
          <a
            href="/register"
            className="flex-1 btn-primary"
            style={{ padding: "10px 16px", fontSize: 13 }}
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
      <div
        className="p-4 rounded-xl"
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--line)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] mb-1" style={{ color: "var(--muted-2)" }}>
              Email
            </div>
            <div className="text-[14px] truncate" style={{ color: "var(--ink)" }}>
              {auth.email}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2 text-[13px] rounded-lg transition shrink-0"
            style={{ border: "1px solid var(--line-strong)", color: "var(--pink)" }}
          >
            Выйти
          </button>
        </div>
        <div
          className="mt-4 pt-3 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <span className="text-[12px]" style={{ color: "var(--muted-2)" }}>
            Если вы потеряли устройство или подозреваете утечку
          </span>
          <button
            type="button"
            onClick={handleLogoutAll}
            disabled={loggingOutAll}
            className="text-[12px] transition disabled:opacity-40 shrink-0"
            style={{ color: "var(--pink)" }}
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
    <div
      className="text-[12px] font-semibold mb-3"
      style={{ color: "var(--ink-dim)" }}
    >
      {children}
    </div>
  );
}
