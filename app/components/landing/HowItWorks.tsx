/**
 * HowItWorks — временный stub. Полный вариант с 3 фазами (Setup/Generation/Result),
 * canvas-анимацией и 12 шаблонами — в следующем коммите (файл 60KB).
 */
import { Terminal, Zap, Globe } from "lucide-react";

const steps = [
  {
    icon: <Terminal size={20} />,
    num: "01",
    title: "Установка",
    desc: "Скачайте LM Studio и nitgen. Авторизуйтесь по email — 5 минут настройки.",
  },
  {
    icon: <Zap size={20} />,
    num: "02",
    title: "Генерация",
    desc: "Опишите проект одним предложением — нейросеть соберёт HTML за 60 секунд.",
  },
  {
    icon: <Globe size={20} />,
    num: "03",
    title: "Результат",
    desc: "Получите готовый сайт. Публикуйте через туннель или скачайте HTML.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.02] blur-[100px] pointer-events-none" />
      <div className="max-w-6xl mx-auto px-5 sm:px-8 relative">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
            Как бесплатно создать сайт через ИИ
          </h2>
          <p className="text-[#71717A] text-lg max-w-2xl mx-auto">
            Три простых шага — от идеи до готового сайта.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <div
              key={s.num}
              className="rounded-2xl border border-cyan-500/[0.08] bg-[#0A0E14] p-7 hover:border-cyan-500/20 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] flex items-center justify-center text-cyan-300">
                  {s.icon}
                </div>
                <span className="font-mono text-xs text-cyan-400/40">{s.num}</span>
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-[#71717A] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
