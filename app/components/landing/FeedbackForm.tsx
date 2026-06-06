/**
 * FeedbackForm — форма обратной связи на лендинге.
 *
 * POST /api/feedback → письмо на support@nitgen.org через серверный mailer.
 * Honeypot-поле `website` скрыто от людей (hidden + tabIndex -1): боты его
 * заполняют, сервер такие сообщения тихо отбрасывает.
 */
import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

export default function FeedbackForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [stage, setStage] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const isValid = message.trim().length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || stage === "sending") return;
    setError(null);
    setStage("sending");
    try {
      const payload: Record<string, string> = { message: message.trim() };
      if (name.trim()) payload.name = name.trim();
      if (email.trim()) payload.email = email.trim();
      if (website.trim()) payload.website = website.trim();

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить. Попробуйте ещё раз.");
        setStage("idle");
        return;
      }
      setStage("sent");
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
      setStage("idle");
    }
  }

  if (stage === "sent") {
    return (
      <div
        id="contact"
        className="rounded-2xl border border-emerald-500/25 bg-[#0f1a14] p-7 text-center"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400">
          <CheckCircle2 size={22} strokeWidth={2.5} />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Сообщение отправлено</h3>
        <p className="text-sm text-[#A1A1AA] leading-relaxed">
          Спасибо! Мы прочитаем его и ответим на указанный email.
        </p>
      </div>
    );
  }

  return (
    <form
      id="contact"
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6 sm:p-7 scroll-mt-24"
    >
      <h3 className="text-lg font-semibold text-white mb-1">Напишите нам</h3>
      <p className="text-xs text-[#71717A] mb-5">
        Вопрос, идея или что-то не работает — расскажите, ответим на почту.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя (необязательно)"
          maxLength={100}
          className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email для ответа (необязательно)"
          maxLength={255}
          className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        />
      </div>

      {/* Honeypot: скрыт от людей, боты заполняют — сервер отбрасывает. */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ваше сообщение…"
        rows={4}
        required
        minLength={10}
        maxLength={2000}
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 resize-none focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all mb-3"
      />

      {error && (
        <div className="mb-3 p-3 text-[12px] rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-rose-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] text-[#71717A] leading-relaxed">
          Или напишите напрямую:{" "}
          <a href="mailto:support@nitgen.org" className="text-[#A1A1AA] underline hover:text-white transition-colors">
            support@nitgen.org
          </a>
        </p>
        <button
          type="submit"
          disabled={!isValid || stage === "sending"}
          className="shrink-0 inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:border disabled:border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white font-semibold text-sm transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:shadow-none"
        >
          {stage === "sending" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Отправляем…
            </>
          ) : (
            <>
              <Send size={14} />
              Отправить
            </>
          )}
        </button>
      </div>
    </form>
  );
}
