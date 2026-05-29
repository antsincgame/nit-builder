/**
 * DevicesSection — список привязанных устройств (Cursor-style).
 *
 * Тянет GET /api/auth/tunnel/devices, показывает активные устройства и даёт
 * отозвать любое (DELETE /api/auth/tunnel/devices/:id). Отзыв помечает
 * устройство revoked=true — оно отключится при следующем подключении.
 *
 * Стиль — как у TunnelTokenSection: header uppercase, панели white/[0.02],
 * акценты emerald/rose, иконки lucide.
 */

import { useCallback, useEffect, useState } from "react";
import { Monitor, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "~/lib/contexts/AuthContext";

type Device = {
  id: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string | null;
  revoked: boolean;
};

type Props = {
  resetSignal: boolean;
};

export function DevicesSection({ resetSignal }: Props) {
  const auth = useAuth();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/tunnel/devices", { credentials: "include" });
      const data = (await res.json()) as { devices?: Device[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось загрузить устройства");
        return;
      }
      setDevices(data.devices ?? []);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") void load();
  }, [auth.status, load]);

  // Перезагрузить список при повторном открытии настроек.
  useEffect(() => {
    if (resetSignal && auth.status === "authenticated") void load();
  }, [resetSignal, auth.status, load]);

  async function revoke(id: string) {
    // eslint-disable-next-line no-alert -- intentional destructive confirmation
    if (!confirm("Отозвать это устройство? Оно отключится при следующем подключении.")) {
      return;
    }
    setRevoking(id);
    setError(null);
    try {
      const res = await fetch(`/api/auth/tunnel/devices/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось отозвать устройство");
        return;
      }
      await load();
    } catch {
      setError("Ошибка сети");
    } finally {
      setRevoking(null);
    }
  }

  if (auth.status !== "authenticated") return null;

  const active = (devices ?? []).filter((d) => !d.revoked);

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-3 text-[#71717A]/80">
        Устройства
      </div>

      {loading && devices === null ? (
        <div className="flex items-center gap-2 text-[13px] text-[#71717A] p-4">
          <Loader2 size={14} className="animate-spin" /> Загружаем…
        </div>
      ) : error && devices === null ? (
        <div className="p-2.5 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
          {error}
        </div>
      ) : active.length === 0 ? (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[13px] text-[#A1A1AA] leading-relaxed">
          Пока нет привязанных устройств. Откройте приложение nitgen и нажмите «Войти через
          nitgen», чтобы подключить компьютер.
        </div>
      ) : (
        <div className="space-y-2">
          {error && (
            <div className="p-2.5 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
              {error}
            </div>
          )}
          {active.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/70">
                <Monitor size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white truncate">{d.deviceName}</div>
                <div className="text-[11px] text-[#71717A] truncate">
                  {d.lastSeenAt
                    ? `Активность: ${new Date(d.lastSeenAt).toLocaleDateString("ru")}`
                    : `Привязано: ${new Date(d.createdAt).toLocaleDateString("ru")}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revoke(d.id)}
                disabled={revoking === d.id}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-md text-rose-300 hover:text-rose-200 hover:bg-rose-500/[0.08] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {revoking === d.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                Отозвать
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
