/**
 * TunnelTokenSection v3 — эстетика лендинга: Tailwind, emerald для акцентов,
 * amber для важных предупреждений, rose для опасных действий.
 */

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "~/lib/contexts/AuthContext";

type Props = {
  resetSignal: boolean;
};

export function TunnelTokenSection({ resetSignal }: Props) {
  const auth = useAuth();
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (resetSignal) {
      setShowRegenerate(false);
      setPassword("");
      setError(null);
      setNewToken(null);
      setCopied(false);
    }
  }, [resetSignal]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/regenerate-tunnel-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { tunnelToken?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось создать новый ключ");
        setRegenerating(false);
        return;
      }
      setNewToken(data.tunnelToken ?? null);
      setPassword("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setRegenerating(false);
    }
  }

  function copyToken() {
    if (!newToken) return;
    navigator.clipboard
      .writeText(newToken)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setError("Буфер обмена недоступен. Скопируйте ключ вручную.");
      });
  }

  if (auth.status !== "authenticated") return null;

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-3 text-[#71717A]/80">
        Ключ доступа (для разработчиков)
      </div>

      {newToken ? (
        <div className="space-y-3">
          <div className="p-3 text-[13px] rounded-lg border border-amber-500/30 bg-amber-500/[0.06] text-amber-300">
            Ключ показан один раз. Скопируйте его сейчас — потом восстановить нельзя.
          </div>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={newToken}
              className="w-full px-3 py-3 pr-28 text-[12px] font-mono outline-none rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#A1A1AA]"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={copyToken}
              className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[12px] font-semibold rounded-md transition inline-flex items-center gap-1.5 ${
                copied
                  ? "bg-emerald-500 text-[#0A0A0A]"
                  : "bg-white/[0.08] text-white hover:bg-white/[0.12]"
              }`}
            >
              {copied ? (
                <>
                  <Check size={12} />
                  Скопировано
                </>
              ) : (
                "Копировать"
              )}
            </button>
          </div>
        </div>
      ) : showRegenerate ? (
        <div className="space-y-3">
          <p className="text-[13px] text-[#A1A1AA] leading-relaxed">
            Введите ваш пароль. Старый ключ перестанет работать сразу — все
            активные подключения отключатся.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ваш пароль"
            autoComplete="current-password"
            className="w-full px-3 py-3 text-[14px] outline-none transition rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
          />
          {error && (
            <div className="p-2.5 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowRegenerate(false);
                setPassword("");
                setError(null);
              }}
              className="flex-1 px-4 py-2.5 text-[13px] rounded-lg border border-white/[0.08] bg-white/[0.02] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || password.length === 0}
              className="flex-1 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition"
            >
              {regenerating ? "…" : "Создать новый"}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-[13px] mb-3 text-[#A1A1AA] leading-relaxed">
            Нужен только если вы запускаете генерацию на своём компьютере
            через консольный клиент. Большинству пользователей не нужен.
          </p>
          {auth.tunnelTokenCreatedAt && (
            <p className="text-[12px] mb-3 text-[#71717A]">
              Создан: {new Date(auth.tunnelTokenCreatedAt).toLocaleDateString("ru")}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowRegenerate(true)}
            className="text-[13px] text-rose-300 hover:text-rose-200 transition"
          >
            Создать новый ключ →
          </button>
        </div>
      )}
    </div>
  );
}
