/**
 * OAuthButtons — две кнопки входа через Google / GitHub + разделитель «или».
 *
 * Клик → window.location.href = /api/auth/oauth/{provider}/start.
 * Сервер редиректнет на провайдера; если ENV не настроен —
 * вернёт 503 и юзер увидит generic-вкладку браузера (это приемлемо
 * на время когда провайдер выключен осознанно).
 */

import { useEffect, useState } from "react";

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.11.78-.25.78-.55v-1.94c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.41-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.26 5.69.42.36.8 1.08.8 2.18v3.23c0 .31.2.67.79.55C20.21 21.38 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

/**
 * Словарь ошибок которые может вернуть callback в query (?error=oauth_*).
 * Показываем юзеру понятные сообщения вместо технических кодов.
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  user_cancelled: "Вход через провайдера отменён",
  no_email: "Не получили email от провайдера. Разрешите доступ к email или используйте другой вариант входа",
  state_mismatch: "Не удалось подтвердить вход (state mismatch). Попробуйте ещё раз",
  missing_params: "Некорректные параметры от провайдера. Попробуйте ещё раз",
  invalid_provider: "Неверный провайдер",
  provider_not_configured: "Этот способ входа пока не настроен. Обратитесь к админу",
  token_exchange_failed: "Не удалось завершить вход через провайдера",
  internal_error: "Внутренняя ошибка. Попробуйте позже",
};

type Props = {
  /** Действие которое инициируется — просто для текста кнопки. */
  intent?: "login" | "register";
};

export function OAuthButtons({ intent = "login" }: Props) {
  const [oauthError, setOAuthError] = useState<string | null>(null);

  // Парсим ?error=oauth_* из URL. Чистим URL после прочтения.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error && error.startsWith("oauth_")) {
      const key = error.slice("oauth_".length);
      setOAuthError(OAUTH_ERROR_MESSAGES[key] ?? "Не удалось войти");
      // Убираем параметр из URL чтобы reload не показал ту же ошибку второй раз.
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const label = intent === "register" ? "Продолжить через" : "Войти через";

  return (
    <div className="space-y-3">
      {oauthError && (
        <div className="p-3 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.08] text-rose-300">
          {oauthError}
        </div>
      )}

      <a
        href="/api/auth/oauth/google/start"
        className="w-full h-11 inline-flex items-center justify-center gap-2.5 rounded-xl bg-white text-[#0A0A0A] hover:bg-white/90 font-medium text-sm no-underline transition-all"
      >
        <GoogleIcon size={16} />
        {label} Google
      </a>

      <a
        href="/api/auth/oauth/github/start"
        className="w-full h-11 inline-flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/[0.2] font-medium text-sm no-underline transition-all"
      >
        <GitHubIcon size={16} />
        {label} GitHub
      </a>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.06]" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-[11px] text-[#71717A] bg-[#141414]">
            или email и пароль
          </span>
        </div>
      </div>
    </div>
  );
}
