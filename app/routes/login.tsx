import { useEffect, useState } from "react";
import type { MetaFunction } from "react-router";
import { Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "~/lib/contexts/AuthContext";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";

export const meta: MetaFunction = () => [
  { title: "Вход · nitgen" },
  { name: "robots", content: "noindex" },
];

/**
 * Login v3 — выровнян под эстетику лендинга nitgen-gront:
 * чёрный #0A0A0A фон, NeuralBackground canvas, emerald-акценты.
 * Навигация — обычные <a href>, так как auth-flow всё равно
 * дёргает window.location.href и режим SPA-перехода здесь ненужен.
 */
export default function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "authenticated") {
      window.location.href = "/app";
    }
  }, [auth.status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { error?: string; userId?: string };

      if (!res.ok) {
        setError(data.error ?? "Неверный email или пароль");
        setLoading(false);
        return;
      }

      window.location.href = "/app";
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
      setLoading(false);
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
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white mb-2">
              Вход
            </h1>
            <p className="text-sm text-[#71717A] mb-7">
              Ещё нет аккаунта?{" "}
              <a href="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Создать
              </a>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field
                label="Email"
                id="email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="vasha@pochta.ru"
                autoComplete="email"
                required
              />
              <Field
                label="Пароль"
                id="password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Введите пароль"
                autoComplete="current-password"
                minLength={8}
                required
              />

              {error && (
                <div className="p-3 text-[13px] rounded-lg border border-rose-500/30 bg-rose-500/[0.08] text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:border disabled:border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Входим…
                  </>
                ) : (
                  <>
                    Войти
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  required,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[13px] font-medium mb-1.5 text-[#A1A1AA]"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
      />
    </div>
  );
}
