import { useEffect, useState } from "react";
import type { MetaFunction } from "react-router";
import { Loader2, Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "~/lib/contexts/AuthContext";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";

export const meta: MetaFunction = () => [
  { title: "Вход · nitgen" },
  { name: "robots", content: "noindex" },
];

/**
 * Login v5 — passwordless magic-link only.
 *
 * Flow:
 *   1. Юзер вводит email → POST /api/auth/request-magic-link
 *   2. Показываем экран «проверьте почту»
 *   3. Юзер кликает на ссылку из письма → /auth/verify?token=...
 *      → выписывается session cookie → редирект /app
 *
 * Пароли больше не запрашиваются. Существующие юзеры с паролями могут
 * входить тем же magic-link (на их email). Регистрация — это
 * автоматический result первого magic-link на новый email.
 */
export default function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "authenticated") {
      window.location.href = "/app";
    }
  }, [auth.status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage("sending");

    try {
      const res = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as { error?: string; ok?: boolean };

      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить ссылку. Попробуйте ещё раз.");
        setStage("idle");
        return;
      }

      setStage("sent");
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
      setStage("idle");
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-hidden">
      <NeuralBackground />

      <nav className="relative z-10 px-5 sm:px-8 py-5">
        <a href="/" className="inline-flex items-center gap-2.5 no-underline">
          <Logo size={32} />
          <span className="font-semibold text-[15px] text-white tracking-tight">nitgen</span>
        </a>
      </nav>

      <main
        className="relative z-10 flex items-center justify-center px-5 sm:px-8 pb-12"
        style={{ minHeight: "calc(100vh - 80px)" }}
      >
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-7 sm:p-8">
            {stage === "sent" ? (
              <SentScreen email={email} onChangeEmail={() => setStage("idle")} />
            ) : (
              <>
                <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white mb-2">
                  Вход в nitgen
                </h1>
                <p className="text-sm text-[#71717A] mb-7 leading-relaxed">
                  Введите email — мы пришлём ссылку для входа. Регистрация не нужна,
                  если введёте новый адрес — создадим аккаунт автоматически.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-[13px] font-medium mb-1.5 text-[#A1A1AA]"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                      placeholder="vasha@pochta.ru"
                      className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[15px] placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>

                  {error && (
                    <div className="p-3 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.08] text-rose-300">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={stage === "sending" || !email}
                    className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:border disabled:border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:shadow-none"
                  >
                    {stage === "sending" ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Отправляем…
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        Отправить ссылку
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center text-[12px] text-[#71717A]/70 leading-relaxed">
                  Продолжая, вы соглашаетесь с{" "}
                  <a href="/terms" className="text-[#A1A1AA] underline hover:text-white transition-colors">
                    условиями
                  </a>{" "}
                  и{" "}
                  <a href="/privacy" className="text-[#A1A1AA] underline hover:text-white transition-colors">
                    политикой конфиденциальности
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SentScreen({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5 border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400">
        <CheckCircle2 size={26} strokeWidth={2.5} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white mb-3">
        Проверьте почту
      </h1>
      <p className="text-sm text-[#A1A1AA] leading-relaxed mb-2">
        Отправили ссылку для входа на
      </p>
      <p className="text-[15px] font-medium text-white mb-6">{email}</p>
      <p className="text-[12px] text-[#71717A] leading-relaxed mb-6">
        Письмо может прийти в течение минуты. Проверьте папку «Спам»,
        если ничего не получили.
      </p>
      <button
        type="button"
        onClick={onChangeEmail}
        className="inline-flex items-center gap-2 text-[13px] text-[#A1A1AA] hover:text-white transition-colors"
      >
        <ArrowLeft size={13} />
        Использовать другой email
      </button>
    </div>
  );
}
