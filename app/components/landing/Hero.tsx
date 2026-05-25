/**
 * Hero — главный блок лендинга nitgen.
 *
 * Изменения vs Bolt-исходник:
 * - navigate('/x') из кастомного pushState-роутера → useNavigate() от react-router
 * - RegisterCard кнопка "Зарегистрироваться" ведёт на /register (форма-stub в Bolt)
 * - useOS импортируется из app/hooks (SSR-safe версия)
 */
import { useState } from "react";
import { Download, Monitor, Apple, Terminal, ArrowRight, CheckSquare, Square, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useOS } from "~/hooks/useOS";

function RegisterCard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [consentData, setConsentData] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValid = email.includes("@") && email.includes(".") && consentData && consentTerms;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    // Прокидываем email на /register, там полноценный flow регистрации (auth API).
    setTimeout(() => navigate(`/register?email=${encodeURIComponent(email)}`), 400);
  };

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-[#0f1a14] p-7 shadow-[0_0_40px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(16,185,129,0.1)]">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white leading-tight">Регистрация</h3>
        <p className="text-xs text-emerald-400/60 mt-0.5">Бесплатно для личного использования</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="relative">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setConsentData(!consentData)}
            className="flex items-start gap-2.5 text-left w-full group cursor-pointer"
          >
            {consentData
              ? <CheckSquare size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              : <Square size={16} className="text-[#71717A] group-hover:text-[#A1A1AA] shrink-0 mt-0.5 transition-colors" />
            }
            <span className="text-[11px] text-[#71717A] leading-relaxed">
              Даю согласие на обработку персональных данных в соответствии с{" "}
              <button type="button" onClick={() => navigate("/privacy")} className="text-[#A1A1AA] underline hover:text-white transition-colors">Политикой конфиденциальности</button>,{" "}
              ФЗ-152 «О персональных данных» (РФ) и Законом N 99-З «О защите персональных данных» (РБ)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setConsentTerms(!consentTerms)}
            className="flex items-start gap-2.5 text-left w-full group cursor-pointer"
          >
            {consentTerms
              ? <CheckSquare size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              : <Square size={16} className="text-[#71717A] group-hover:text-[#A1A1AA] shrink-0 mt-0.5 transition-colors" />
            }
            <span className="text-[11px] text-[#71717A] leading-relaxed">
              Принимаю{" "}
              <button type="button" onClick={() => navigate("/terms")} className="text-[#A1A1AA] underline hover:text-white transition-colors">Пользовательское соглашение</button>{" "}
              и{" "}
              <button type="button" onClick={() => navigate("/terms")} className="text-[#A1A1AA] underline hover:text-white transition-colors">Условия использования сервиса</button>
            </span>
          </button>
        </div>

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:border disabled:border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0A] disabled:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:shadow-none"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              Зарегистрироваться
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function DownloadCard() {
  const navigate = useNavigate();
  const os = useOS();

  const platforms = {
    windows: { label: "Скачать для Windows", sub: "Windows 10/11 · 64-bit · .exe", icon: <Monitor size={15} /> },
    macos: { label: "Скачать для macOS", sub: "macOS 12+ · .dmg", icon: <Apple size={15} /> },
    linux: { label: "Скачать для Linux", sub: ".AppImage · .deb", icon: <Terminal size={15} /> },
  };

  const primary = os === "unknown" ? "windows" : os;
  const secondaries = (["windows", "macos", "linux"] as const).filter((p) => p !== primary);

  return (
    <div id="download" className="rounded-2xl border border-white/[0.08] bg-[#141414] p-7">
      <h3 className="text-lg font-semibold text-white mb-1">Скачать nitgen</h3>
      <p className="text-xs text-[#71717A] mb-6">Версия 1.0 · ~80 МБ · Бесплатно для личного использования</p>

      <button
        onClick={() => navigate("/download")}
        className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.08] text-white text-sm font-semibold transition-all group cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          {platforms[primary].icon}
          {platforms[primary].label}
        </span>
        <Download size={15} className="text-[#71717A] group-hover:text-white transition-colors" />
      </button>
      <p className="text-xs text-[#71717A] text-center mt-2 mb-5">{platforms[primary].sub}</p>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-xs text-[#71717A]">Другие платформы</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      <div className="flex flex-col gap-2">
        {secondaries.map((p) => (
          <button
            key={p}
            onClick={() => navigate("/download")}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-[#A1A1AA] hover:text-white border border-white/[0.06] hover:border-white/[0.12] bg-transparent transition-all cursor-pointer"
          >
            {platforms[p].icon}
            <span>{platforms[p].label.replace("Скачать для ", "")}</span>
          </button>
        ))}
      </div>

      {/* Лицензия */}
      <div className="mt-5 pt-4 border-t border-white/[0.05] space-y-2">
        <div className="flex items-start gap-2 text-[11px] text-[#71717A] leading-relaxed">
          <span className="text-emerald-500/70 shrink-0 mt-0.5">✓</span>
          <span>Бесплатно для <strong className="text-white/60">личного использования</strong></span>
        </div>
        <div className="flex items-start gap-2 text-[11px] text-[#71717A] leading-relaxed">
          <span className="text-amber-400/60 shrink-0 mt-0.5">!</span>
          <span>
            Для <strong className="text-white/60">коммерческого использования</strong> требуется лицензия.{" "}
            <a
              href="mailto:sales@nitgen.org"
              className="text-emerald-400/80 hover:text-emerald-300 underline transition-colors"
            >
              Написать в отдел продаж
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative pt-28 pb-16 overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-12 lg:gap-16 items-start">
          <div className="flex flex-col gap-6">
            {/* Бейдж */}
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] w-fit shadow-[0_0_20px_rgba(16,185,129,0.12)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-[13px] text-emerald-300 font-medium">Бесплатно для личного использования · Локально</span>
            </div>

            {/* H1 */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.06)]">
              Создайте сайт для себя<br />
              <span className="bg-gradient-to-r from-white via-white/90 to-emerald-200/80 bg-clip-text text-transparent">с помощью ИИ</span>
            </h1>

            {/* Подзаголовок */}
            <p className="text-lg text-[#A1A1AA] leading-relaxed max-w-xl">
              Генератор сайтов на нейросети — <strong className="text-white font-semibold">бесплатно для личного использования</strong>. Опишите проект одним предложением —
              ИИ соберёт готовый сайт за <strong className="text-white font-semibold">60 секунд</strong> прямо на вашем компьютере.
              <span className="text-white/60"> Без данных в облаке. Без знания кода.</span>
            </p>

            <div className="mt-2">
              <div
                className="relative rounded-2xl border border-white/[0.08] overflow-hidden bg-[#141414]"
                style={{ aspectRatio: "16/9", maxWidth: "640px" }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white/80 border-b-[10px] border-b-transparent ml-1" />
                  </div>
                  <span className="text-sm text-[#71717A]">Демо: создание сайта через ИИ за 60 секунд</span>
                </div>
              </div>
              <p className="mt-3 text-[13px] text-[#71717A]">
                Видео: как бесплатно создать сайт с помощью нейросети за 60 секунд в nitgen
              </p>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 flex flex-col gap-4">
            <RegisterCard />
            <DownloadCard />
          </div>
        </div>

        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <h2 className="text-center text-xl sm:text-2xl font-bold text-white mb-2">Начните за 4 шага</h2>
          <p className="text-center text-sm text-[#71717A] mb-10">Настройка займёт не больше 5 минут</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: "1",
                title: "Скачайте LM Studio",
                desc: "Загрузите рекомендованные модели для кодинга",
                link: "https://lmstudio.ai/download",
                linkLabel: "lmstudio.ai",
              },
              {
                step: "2",
                title: "Скачайте Nitgen",
                desc: "Бесплатное приложение для Windows, macOS и Linux",
                link: "#download",
                linkLabel: "Перейти к скачиванию",
              },
              {
                step: "3",
                title: "Авторизуйтесь",
                desc: "Войдите по Email на сайте и в приложении",
                link: undefined,
                linkLabel: undefined,
              },
              {
                step: "4",
                title: "Творите!",
                desc: "Опишите идею — ИИ соберёт сайт за секунды",
                link: undefined,
                linkLabel: undefined,
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="group relative rounded-2xl border border-white/[0.06] bg-[#141414] p-5 hover:border-emerald-500/20 transition-all duration-500"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center group-hover:scale-125 transition-transform duration-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" style={{ animationDelay: `${i * 300}ms` }} />
                </div>

                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 group-hover:border-emerald-500/20 group-hover:bg-emerald-500/5 transition-all duration-500">
                  <span className="text-xs font-bold text-[#A1A1AA] group-hover:text-emerald-400 transition-colors duration-500">{item.step}</span>
                </div>

                <h3 className="text-sm font-semibold text-white mb-1.5">{item.title}</h3>
                <p className="text-[11px] text-[#71717A] leading-relaxed mb-3">{item.desc}</p>

                {item.link && (
                  <a
                    href={item.link}
                    target={item.link.startsWith("http") ? "_blank" : undefined}
                    rel={item.link.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA] underline hover:text-white transition-colors"
                  >
                    {item.linkLabel}
                    <ArrowRight size={9} />
                  </a>
                )}

                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                )}
              </div>
            ))}
          </div>

          {/* Анимированная neural-линия */}
          <div className="relative h-px mt-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent animate-pulse" />
            <div className="absolute top-0 left-0 w-20 h-full bg-gradient-to-r from-emerald-400/40 to-transparent animate-[slideRight_3s_linear_infinite]" />
          </div>
        </div>
      </div>
    </section>
  );
}
