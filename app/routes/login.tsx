import { useEffect, useState } from "react";
import type { MetaFunction } from "react-router";
import { useAuth } from "~/lib/contexts/AuthContext";

export const meta: MetaFunction = () => [
  { title: "Вход · NITGEN" },
  { name: "robots", content: "noindex" },
];

/**
 * Login v2 — упрощённая версия для обычных пользователей.
 *
 * Раньше была полная техническая верстка с тоннелями, GPU, "Sign in",
 * "// auth» и английскими лейбалами. Привожу к виду register.tsx —
 * одинаковый дизайн, язык обычных людей.
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
    <div className="relative min-h-screen text-[color:var(--ink)] overflow-hidden">
      <div className="nit-bg-mesh" aria-hidden>
        <div className="nit-bg-mesh-orb nit-bg-mesh-1" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-2" />
      </div>
      <div className="nit-bg-grid" aria-hidden />

      <nav className="relative z-10 px-5 sm:px-8 py-5">
        <a href="/" className="inline-flex items-center gap-2 no-underline">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[14px]"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            N
          </div>
          <span className="text-[15px] font-semibold text-[color:var(--ink)]">nitgen</span>
        </a>
      </nav>

      <main
        className="relative z-10 flex items-center justify-center px-5 sm:px-8 pb-12"
        style={{ minHeight: "calc(100vh - 80px)" }}
      >
        <div className="w-full max-w-[420px]">
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: "rgba(19, 20, 27, 0.85)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid var(--line-strong)",
            }}
          >
            <h1 className="nit-display mb-2" style={{ fontSize: 28, color: "var(--ink)" }}>
              Вход
            </h1>
            <p className="text-[14px] mb-6" style={{ color: "var(--muted)" }}>
              Ещё нет аккаунта?{" "}
              <a href="/register" className="transition-colors" style={{ color: "var(--cyan)" }}>
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
                <div
                  className="p-3 text-[13px] rounded-lg"
                  style={{
                    border: "1px solid var(--pink)",
                    background: "rgba(244, 114, 182, 0.08)",
                    color: "var(--pink)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
                style={{
                  padding: "12px 22px",
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Входим…" : "Войти"}
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
        className="block text-[13px] font-medium mb-1.5"
        style={{ color: "var(--ink-dim)" }}
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
        className="w-full px-4 py-3 text-[15px] rounded-lg outline-none transition"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line-strong)",
          color: "var(--ink)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--cyan)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--line-strong)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </div>
  );
}
