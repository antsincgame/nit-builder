import { useEffect, useRef } from "react";
import { Shield, Banknote, Zap, Globe, Lock, Cpu, Search, Database, Image } from "lucide-react";

const cards = [
  {
    icon: <Zap size={20} />,
    title: "Сайт из одного описания",
    desc: "Напишите одно предложение — нейросеть сгенерирует готовый HTML-сайт. Не нужно знать код, чтобы сделать сайт через искусственный интеллект.",
    highlight: true,
  },
  {
    icon: <Search size={20} />,
    title: "SEO из коробки",
    desc: "ИИ генерирует сайт с правильными мета-тегами, заголовками, Open Graph и семантической вёрсткой. Сайт сразу готов к индексации в Google и Яндекс — без ручной донастройки SEO.",
    highlight: true,
  },
  {
    icon: <Database size={20} />,
    title: "База данных и админка",
    desc: "Нужен каталог, заявки или товары? nitgen соберёт полноценный PHP-сайт с SQLite-базой и готовой админ-панелью: добавляйте и редактируйте контент через удобный интерфейс — без программирования.",
    highlight: true,
  },
  {
    icon: <Image size={20} />,
    title: "Картинки и медиа",
    desc: "Сайты собираются с изображениями, иконками и адаптивными блоками под фото. Загружайте свои картинки или используйте подобранные — всё аккуратно ляжет в дизайн.",
  },
  {
    icon: <Lock size={20} />,
    title: "Промпты не уходят в чужие ИИ",
    desc: "Генерация выполняется на вашей видеокарте, а не в облачных нейросетях. Ваши описания не используются для чужого обучения, исходник сайта всегда у вас.",
  },
  {
    icon: <Banknote size={20} />,
    title: "Бесплатно для личного использования",
    desc: "Nitgen бесплатен для личных и некоммерческих проектов — без подписок и скрытых платежей. Для коммерческого использования требуется лицензия.",
  },
  {
    icon: <Globe size={20} />,
    title: "Генерация на вашем компьютере",
    desc: "Нейросеть работает на вашей видеокарте через LM Studio: промпты и данные не уходят в чужое облако, а готовый HTML остаётся у вас.",
  },
  {
    icon: <Shield size={20} />,
    title: "Открытый исходный код",
    desc: "Прозрачный AI-конструктор сайтов. Код открыт — проверьте сами, что данные не уходят в облако при создании сайтов через ИИ.",
  },
  {
    icon: <Cpu size={20} />,
    title: "Любая нейросеть на выбор",
    desc: "Llama, Mistral, Qwen, DeepSeek — выбирайте модель для генерации сайтов. Бесплатный ИИ для создания сайтов на вашем железе.",
  },
];

export default function Features() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.08, rootMargin: "0px 0px -32px 0px" }
    );
    el.querySelectorAll(".fade-in-up").forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={ref} className="py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14 fade-in-up">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Не просто страница — полноценный сайт
          </h2>
          <p className="text-[#71717A] text-lg max-w-2xl mx-auto">
            SEO, база данных, админка и картинки из коробки. Всё, что нужно для настоящего сайта на ИИ — бесплатно для личного использования, локально.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card, i) => (
            <article
              key={i}
              className={`fade-in-up rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-300 ${"highlight" in card && card.highlight
                ? "border-emerald-500/20 bg-[#0f1a14] hover:border-emerald-500/35 shadow-[0_0_30px_rgba(16,185,129,0.05)]"
                : "border-white/[0.06] bg-[#141414] hover:border-white/[0.12]"}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${"highlight" in card && card.highlight ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-white/[0.08] bg-[#1A1A1A] text-white/60"}`}>
                {card.icon}
              </div>
              <h3 className={`text-[15px] font-semibold ${"highlight" in card && card.highlight ? "text-white" : "text-white/80"}`}>{card.title}</h3>
              <p className="text-sm text-[#71717A] leading-relaxed">{card.desc}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 fade-in-up">
          <p className="text-center text-sm text-[#71717A] max-w-2xl mx-auto leading-relaxed">
            С nitgen вы можете создать сайт через ИИ для личных проектов бесплатно: лендинг, портфолио,
            визитка, каталог с админкой. Искусственный интеллект генерирует сайты на основе вашего описания — без шаблонов, без ограничений по дизайну.
            Для коммерческого использования требуется{" "}
            <a href="mailto:sales@nitgen.org" className="text-emerald-400/70 hover:text-emerald-300 underline transition-colors">коммерческая лицензия</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
