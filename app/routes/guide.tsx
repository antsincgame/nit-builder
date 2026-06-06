import type { ReactNode } from "react";
import type { Route } from "./+types/guide";
import { Link } from "react-router";
import { Download, ArrowRight } from "lucide-react";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Logo from "~/components/landing/Logo";
import Footer from "~/components/landing/Footer";

export const meta: Route.MetaFunction = () => [
  { title: "Как начать · nitgen" },
  {
    name: "description",
    content:
      "Пошаговая инструкция: как создать сайт в nitgen на своём компьютере. Установка LM Studio, запуск nitgen и генерация сайта — без кода и подписок.",
  },
];

type Step = { n: number; title: string; body: ReactNode };

const HARDWARE: Array<{ vram: string; model: string; note: string; star?: boolean }> = [
  { vram: "4 ГБ", model: "Qwen2.5-Coder-3B", note: "Медленно, но работает" },
  { vram: "8 ГБ · RTX 3060 / 4060", model: "Qwen2.5-Coder-7B", note: "Оптимально", star: true },
  { vram: "12+ ГБ", model: "Qwen2.5-Coder-14B", note: "Максимальное качество" },
];

const TROUBLESHOOTING: Array<{ q: string; a: string }> = [
  {
    q: "Статус «не подключён» не исчезает",
    a: "Проверьте: nitgen запущен, вы вошли через «Войти через nitgen», и в LM Studio нажата кнопка Start Server.",
  },
  {
    q: "Не хватает памяти при загрузке модели",
    a: "Уменьшите Context Length до 8192 и включите Flash Attention в настройках модели — либо выберите модель поменьше (3B).",
  },
  {
    q: "Генерация идёт очень медленно",
    a: "Убедитесь, что в LM Studio все слои модели вынесены на видеокарту (GPU Offload — Max) и включён Flash Attention.",
  },
  {
    q: "Сайт получился не таким, как хотелось",
    a: "Опишите задачу подробнее или поправьте результат через чат — правки применяются поверх текущего сайта, начинать заново не нужно.",
  },
];

export default function Guide() {
  const steps: Step[] = [
    {
      n: 1,
      title: "Установите LM Studio и скачайте модель",
      body: (
        <>
          LM Studio — бесплатная программа, которая запускает нейросеть прямо на вашем
          компьютере (Windows, macOS или Linux). Установите её, откройте вкладку{" "}
          <b className="text-white">Discover</b> и найдите модель{" "}
          <b className="text-white">Qwen2.5-Coder-7B-Instruct</b> — вариант{" "}
          <span className="font-mono text-emerald-300">Q4_K_M</span> (~4.5 ГБ). Нажмите
          Download и дождитесь загрузки.
          <a
            href="https://lmstudio.ai"
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex w-fit items-center gap-1.5 text-[13px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Скачать LM Studio <ArrowRight size={13} />
          </a>
        </>
      ),
    },
    {
      n: 2,
      title: "Запустите локальный сервер в LM Studio",
      body: (
        <>
          Откройте загруженную модель, перейдите во вкладку{" "}
          <b className="text-white">Developer</b> (или Local Server) и нажмите{" "}
          <b className="text-white">Start Server</b>. Сервер поднимется на порту{" "}
          <span className="font-mono text-emerald-300">1234</span> — менять ничего не нужно.
          Просто оставьте LM Studio открытым в фоне.
        </>
      ),
    },
    {
      n: 3,
      title: "Скачайте и запустите nitgen",
      body: (
        <>
          nitgen — маленькое приложение, которое связывает конструктор с вашей
          LM Studio, чтобы промпты не уходили в облако. Скачайте, запустите и нажмите{" "}
          <b className="text-white">«Войти через nitgen»</b> — откроется браузер, войдите
          (если ещё не вошли) и подтвердите это устройство. Клиент сам найдёт запущенную
          LM Studio и подключится. Токен вводить вручную не нужно.
          <Link
            to="/download"
            className="mt-3 flex w-fit items-center gap-2 px-4 py-2 rounded-lg text-[13px] bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)]"
          >
            <Download size={14} /> Скачать nitgen
          </Link>
        </>
      ),
    },
    {
      n: 4,
      title: "Опишите сайт в конструкторе",
      body: (
        <>
          Вернитесь в конструктор — статус сменится на{" "}
          <b className="text-emerald-300">«подключено»</b>. Опишите в паре фраз, что вам нужно
          («сайт для кофейни в Минске») и нажмите «Создать». Когда сайт будет
          готов — скачайте HTML, версию с PHP-редактором для хостинга или
          поделитесь публичной ссылкой.
          <Link
            to="/app"
            className="mt-3 flex w-fit items-center gap-1.5 text-[13px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Открыть конструктор <ArrowRight size={13} />
          </Link>
        </>
      ),
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
      <NeuralBackground />

      <header className="relative z-10">
        <nav className="max-w-[820px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <Logo size={32} />
            <span className="font-semibold text-[15px] text-white tracking-tight">nitgen</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/login" className="text-[13px] text-[#71717A] hover:text-white transition-colors">
              Войти
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] text-[13px] font-semibold transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)]"
            >
              Конструктор
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10 max-w-[820px] mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-20">
        {/* Hero */}
        <div className="mb-12 sm:mb-16">
          <div className="text-[11px] tracking-[0.25em] uppercase text-emerald-400/80 mb-4">
            Инструкция
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight leading-[1.1] text-white mb-4">
            Как создать сайт
            <br />
            <span className="bg-gradient-to-r from-white via-white/90 to-emerald-200/80 bg-clip-text text-transparent">
              на своём компьютере
            </span>
          </h1>
          <p className="max-w-[560px] text-base sm:text-lg text-[#A1A1AA] leading-relaxed">
            nitgen генерирует сайты на вашей видеокарте через нейросеть — бесплатно и
            без облака. Настройка занимает минут 15 и делается один раз. Дальше каждый
            новый сайт.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-14">
          {steps.map((s) => (
            <div
              key={s.n}
              className="flex gap-4 sm:gap-5 rounded-2xl border border-white/[0.08] bg-[#141414] p-5 sm:p-6"
            >
              <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-[15px]">
                {s.n}
              </div>
              <div className="min-w-0">
                <h2 className="text-[17px] sm:text-lg font-semibold text-white mb-2">{s.title}</h2>
                <div className="text-[14px] sm:text-[15px] text-[#A1A1AA] leading-relaxed">
                  {s.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hardware */}
        <div className="mb-14">
          <h2 className="text-lg font-semibold text-white mb-1">Какая нужна видеокарта</h2>
          <p className="text-[13px] text-[#71717A] mb-5">
            Можно и без мощной GPU — на интегрированной графике или CPU будет работать,
            просто медленнее.
          </p>
          <div className="rounded-2xl border border-white/[0.08] bg-[#141414] overflow-hidden">
            {HARDWARE.map((h, i) => (
              <div
                key={h.vram}
                className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-white flex items-center gap-2 flex-wrap">
                    {h.vram}
                    {h.star && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold tracking-wide">
                        РЕКОМЕНДУЕМ
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] font-mono text-[#71717A] mt-0.5">{h.model}</div>
                </div>
                <div className="text-[13px] text-[#A1A1AA] text-right shrink-0">{h.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mb-14">
          <h2 className="text-lg font-semibold text-white mb-5">Если что-то пошло не так</h2>
          <div className="space-y-3">
            {TROUBLESHOOTING.map((t) => (
              <div key={t.q} className="rounded-xl border border-white/[0.08] bg-[#141414] p-5">
                <div className="text-[14px] font-medium text-white mb-1.5">{t.q}</div>
                <div className="text-[13px] sm:text-[14px] text-[#A1A1AA] leading-relaxed">{t.a}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[13px] text-[#71717A] leading-relaxed">
            Тонкая настройка под 8 ГБ — Flash Attention, квантование KV-кэша, расчёт VRAM — в{" "}
            <a
              href="https://github.com/antsincgame/nit-builder/blob/main/docs/lm-studio-guide.md"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              подробном гайде по LM Studio
            </a>
            .
          </p>
        </div>

        {/* Final CTA */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-7 sm:p-9 text-center">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">Готовы?</h2>
          <p className="text-[14px] sm:text-[15px] text-[#A1A1AA] mb-6 max-w-[420px] mx-auto leading-relaxed">
            Откройте конструктор и опишите свой первый сайт — остальное сделает нейросеть.
          </p>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] font-semibold text-sm transition-all shadow-[0_0_28px_rgba(16,185,129,0.4)]"
          >
            Открыть конструктор <ArrowRight size={15} />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
