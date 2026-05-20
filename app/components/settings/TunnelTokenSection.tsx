/**
 * TunnelTokenSection v2 — русский. Это техническая секция (для тех кто хочет
 * использовать CLI на своём GPU), оставлена «для разработчиков». Текст
 * упрощён, плейсхолдеры и кнопки на русском.
 */

import { useEffect, useState } from "react";
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
      <div className="text-[12px] font-semibold mb-3" style={{ color: "var(--ink-dim)" }}>
        Ключ доступа (для разработчиков)
      </div>

      {newToken ? (
        <div className="space-y-3">
          <div
            className="p-3 text-[13px] rounded-lg"
            style={{
              border: "1px solid var(--amber)",
              background: "rgba(251, 191, 36, 0.06)",
              color: "var(--amber)",
            }}
          >
            Ключ показан один раз. Скопируйте его сейчас — потом восстановить нельзя.
          </div>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={newToken}
              className="w-full px-3 py-3 pr-24 text-[12px] font-mono outline-none rounded-lg"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--line-strong)",
                color: "var(--ink-dim)",
              }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={copyToken}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[12px] font-semibold rounded-md transition"
              style={{
                background: copied ? "var(--green)" : "var(--ink)",
                color: "var(--bg)",
              }}
            >
              {copied ? "✓" : "Копировать"}
            </button>
          </div>
        </div>
      ) : showRegenerate ? (
        <div className="space-y-3">
          <p className="text-[13px]" style={{ color: "var(--muted)", lineHeight: 1.55 }}>
            Введите ваш пароль. Старый ключ перестанет работать сразу — все
            активные подключения отключатся.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ваш пароль"
            autoComplete="current-password"
            className="w-full px-3 py-3 text-[14px] outline-none transition rounded-lg"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--line-strong)",
              color: "var(--ink)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--cyan)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--line-strong)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {error && (
            <div
              className="p-2.5 text-[13px] rounded-lg"
              style={{
                border: "1px solid var(--pink)",
                background: "rgba(244, 114, 182, 0.06)",
                color: "var(--pink)",
              }}
            >
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
              className="flex-1 btn-ghost"
              style={{ padding: "10px 16px", fontSize: 13 }}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || password.length === 0}
              className="flex-1 px-4 py-2.5 text-[13px] font-semibold rounded-lg transition disabled:opacity-40"
              style={{ background: "var(--pink)", color: "white" }}
            >
              {regenerating ? "…" : "Создать новый"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="p-4 rounded-xl"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--line)",
          }}
        >
          <p className="text-[13px] mb-3" style={{ color: "var(--muted)", lineHeight: 1.55 }}>
            Нужен только если вы запускаете генерацию на своём компьютере
            через консольный клиент. Большинству пользователей не нужен.
          </p>
          {auth.tunnelTokenCreatedAt && (
            <p className="text-[12px] mb-3" style={{ color: "var(--muted-2)" }}>
              Создан: {new Date(auth.tunnelTokenCreatedAt).toLocaleDateString("ru")}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowRegenerate(true)}
            className="text-[13px] transition"
            style={{ color: "var(--pink)" }}
          >
            Создать новый ключ →
          </button>
        </div>
      )}
    </div>
  );
}
