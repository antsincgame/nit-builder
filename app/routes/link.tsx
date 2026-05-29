import { useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import {
  Monitor,
  Loader2,
  CheckCircle2,
  Mail,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { getAuth } from "~/lib/server/requireAuth.server";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";

export const meta: MetaFunction = () => [
  { title: "Привязка устройства · nitgen" },
  { name: "robots", content: "noindex" },
];

/**
 * /link?challenge=&state=&port=&device=
 *
 * Cursor-style привязка устройства: десктоп открывает эту страницу в браузере.
 * Если юзер не залогинен — инлайн magic-link форма (с возвратом на эту же
 * страницу через next). Если залогинен — кнопка «Подключить», которая берёт
 * одноразовый код у /approve и редиректит на loopback десктопа.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("challenge") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const portRaw = url.searchParams.get("port") ?? "";
  const device = (url.searchParams.get("device") ?? "").slice(0, 128);

  const portNum = Number(portRaw);
  const paramsValid =
    /^[A-Za-z0-9_-]{43,128}$/.test(challenge) &&
    state.length > 0 &&
    state.length <= 256 &&
    Number.isInteger(portNum) &&
    portNum >= 1024 &&
    portNum <= 65535;

  const user = await getAuth(request);

  return {
    authed: !!user,
    email: user?.email ?? null,
    paramsValid,
    challenge,
    state,
    port: portNum,
    device: device || "Неизвестное устройство",
    nextUrl: url.pathname + url.search,
  };
}

type ApproveStage = "idle" | "approving" | "done";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-hidden">
      <NeuralBackground />
      <header className="relative z-10 px-5 sm:px-8 py-5 max-w-[1200px] mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <Logo size={32} />
          <span className="font-semibold text-[15px] text-white tracking-tight">nitgen</span>
        </a>
      </header>
      <main className="relative z-10 max-w-[480px] mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-20">
        {children}
      </main>
    </div>
  );
}

export default function LinkDevice() {
  const data = useLoaderData<typeof loader>();
  const [stage, setStage] = useState<ApproveStage>("idle");
  const [error, setError] = useState<string | null>(null);

  // —— Некорректные параметры ——
  if (!data.paramsValid) {
    return (
      <Shell>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-7 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 border border-amber-500/30 bg-amber-500/[0.08] text-amber-400">
            <AlertTriangle size={22} />
          </div>
          <h1 className="text-lg font-semibold text-white mb-2">Ссылка привязки повреждена</h1>
          <p className="text-sm text-[#A1A1AA] leading-relaxed">
            Откройте её заново из приложения nitgen — нажмите «Войти через nitgen» ещё раз.
          </p>
        </div>
      </Shell>
    );
  }

  // —— Не залогинен ——
  if (!data.authed) {
    return (
      <Shell>
        <LoginInline nextUrl={data.nextUrl} device={data.device} />
      </Shell>
    );
  }

  // —— Готово (после редиректа на loopback) ——
  if (stage === "done") {
    return (
      <Shell>
        <div className="rounded-2xl border border-emerald-500/25 bg-[#0f1a14] p-7 text-center shadow-[0_0_40px_rgba(16,185,129,0.08)]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400">
            <CheckCircle2 size={22} strokeWidth={2.5} />
          </div>
          <h1 className="text-lg font-semibold text-white mb-2">Устройство привязано</h1>
          <p className="text-sm text-[#A1A1AA] leading-relaxed">
            Вернитесь в приложение nitgen — оно уже подключается. Эту вкладку можно закрыть.
          </p>
        </div>
      </Shell>
    );
  }

  async function handleApprove() {
    setStage("approving");
    setError(null);
    try {
      const res = await fetch("/api/auth/tunnel/approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge: data.challenge, device: data.device }),
      });
      const json = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !json.code) {
        setError(json.error ?? "Не удалось подтвердить привязку.");
        setStage("idle");
        return;
      }
      const target =
        "http://127.0.0.1:" +
        data.port +
        "/?code=" +
        encodeURIComponent(json.code) +
        "&state=" +
        encodeURIComponent(data.state);
      setStage("done");
      window.location.assign(target);
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
      setStage("idle");
    }
  }

  // —— Залогинен: экран подтверждения ——
  return (
    <Shell>
      <div className="rounded-2xl border border-emerald-500/25 bg-[#0f1a14] p-7 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 border border-emerald-500/25 bg-emerald-500/[0.1] text-emerald-300">
          <ShieldCheck size={22} />
        </div>
        <h1 className="text-xl font-semibold text-white mb-1.5">Подключить устройство?</h1>
        <p className="text-sm text-[#A1A1AA] leading-relaxed mb-5">
          Приложение nitgen хочет привязать это устройство к вашему аккаунту. После подтверждения
          туннель сможет выполнять генерацию через ваш GPU.
        </p>

        <div className="flex items-center gap-3 p-3.5 mb-5 rounded-xl border border-white/[0.08] bg-white/[0.03]">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/70">
            <Monitor size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-white truncate">{data.device}</div>
            <div className="text-[11px] text-[#71717A] truncate">Аккаунт: {data.email}</div>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 text-[12px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
            {error}
          </div>
        )}

        <button
          onClick={handleApprove}
          disabled={stage === "approving"}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#0A0A0A] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)]"
        >
          {stage === "approving" ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Подключаем…
            </>
          ) : (
            "Подключить устройство"
          )}
        </button>

        <p className="text-[11px] text-[#71717A]/70 leading-relaxed text-center mt-4">
          Подключайте устройство только если вы сами только что нажали «Войти» в приложении.
        </p>
      </div>
    </Shell>
  );
}

function LoginInline({ nextUrl, device }: { nextUrl: string; device: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const isValid = email.includes("@") && email.includes(".");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || state === "sending") return;
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextUrl }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        loggedIn?: boolean;
        redirectTo?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Не удалось отправить ссылку.");
        setState("idle");
        return;
      }
      if (json.loggedIn && json.redirectTo) {
        window.location.assign(json.redirectTo);
        return;
      }
      setState("sent");
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-[#0f1a14] p-7 text-center shadow-[0_0_40px_rgba(16,185,129,0.08)]">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400">
          <CheckCircle2 size={22} strokeWidth={2.5} />
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">Проверьте почту</h1>
        <p className="text-sm text-[#A1A1AA] leading-relaxed mb-1">
          Отправили ссылку для входа на <span className="text-white font-medium">{email}</span>.
        </p>
        <p className="text-[11px] text-[#71717A] leading-relaxed">
          Перейдите по ней — вернётесь сюда и подтвердите привязку устройства. Письмо может прийти в
          течение минуты, проверьте папку «Спам».
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-[#0f1a14] p-7 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 border border-emerald-500/25 bg-emerald-500/[0.1] text-emerald-300">
        <Monitor size={22} />
      </div>
      <h1 className="text-xl font-semibold text-white mb-1.5">Войдите, чтобы привязать устройство</h1>
      <p className="text-sm text-[#A1A1AA] leading-relaxed mb-5">
        Устройство «{device}» хочет подключиться к nitgen. Войдите по email — после входа вы
        вернётесь сюда и подтвердите привязку.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        />

        {error && (
          <div className="p-3 text-[12px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || state === "sending"}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:border disabled:border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:shadow-none"
        >
          {state === "sending" ? (
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
    </div>
  );
}
