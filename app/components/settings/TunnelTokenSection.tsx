/**
 * TunnelTokenSection v4 — passwordless era.
 *
 * Изменения vs v3:
 *  - убран password-prompt (юзер не знает пароль — magic-link era)
 *  - вместо password — confirm() dialog «Создать новый ключ?»
 *  - заголовок без «(для разработчиков)» — теперь основной flow
 *  - убрана фраза «через консольный клиент» — теперь GUI приложение
 *
 * NB: серверный эндпоинт /api/auth/regenerate-tunnel-token раньше принимал
 * password в body. Теперь мы шлём пустое body. Серверная сторона должна
 * принимать запрос без password (auth берётся из session cookie). Если
 * эндпоинт всё ещё проверяет password — он отдаст 401, и юзер увидит
 * ошибку. Серверный фикс пойдёт отдельным коммитом.
 */

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "~/lib/contexts/AuthContext";

type Props = {
  resetSignal: boolean;
};

export function TunnelTokenSection({ resetSignal }: Props) {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (resetSignal) {
      setError(null);
      setNewToken(null);
      setCopied(false);
    }
  }, [resetSignal]);

  async function handleRegenerate() {
    // eslint-disable-next-line no-alert -- intentional destructive confirmation
    if (!confirm("Создать новый ключ? Старый перестанет работать сразу — все активные подключения отключатся.")) {
      return;
    }
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/regenerate-tunnel-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { tunnelToken?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось создать новый ключ");
        setRegenerating(false);
        return;
      }
      setNewToken(data.tunnelToken ?? null);
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
        Ключ доступа
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
      ) : (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-[13px] mb-3 text-[#A1A1AA] leading-relaxed">
            Используется приложением для подключения к nitgen. Обычно подставляется автоматически при входе по email — создавать новый нужно только если хотите отключить старое устройство.
          </p>
          {auth.tunnelTokenCreatedAt && (
            <p className="text-[12px] mb-3 text-[#71717A]">
              Создан: {new Date(auth.tunnelTokenCreatedAt).toLocaleDateString("ru")}
            </p>
          )}
          {error && (
            <div className="p-2.5 mb-3 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-[13px] text-rose-300 hover:text-rose-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {regenerating ? "…" : "Создать новый ключ →"}
          </button>
        </div>
      )}
    </div>
  );
}
