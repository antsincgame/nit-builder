import { useEffect, useRef } from "react";
import {
  Coffee, Briefcase, ShoppingBag, Utensils, Music, Camera,
  GraduationCap, Heart, Home, Dumbbell, Car, Palette,
} from "lucide-react";

const cases = [
  { icon: <Coffee size={18} />, label: "Кафе и ресторан", desc: "Создать сайт кафе бесплатно через ИИ — меню, бронирование, карта" },
  { icon: <Briefcase size={18} />, label: "Портфолио", desc: "Сделать сайт-портфолио нейросетью — проекты, навыки, резюме" },
  { icon: <ShoppingBag size={18} />, label: "Интернет-магазин", desc: "ИИ-генератор сайта магазина — каталог товаров, цены, контакты" },
  { icon: <Utensils size={18} />, label: "Доставка еды", desc: "Бесплатно создать лендинг доставки — меню, зоны, заказ онлайн" },
  { icon: <Music size={18} />, label: "Музыкант", desc: "Сайт артиста через ИИ бесплатно — биография, треки, райдер" },
  { icon: <Camera size={18} />, label: "Фотограф", desc: "Сделать сайт фотографа нейросетью — галерея, прайс, запись" },
  { icon: <GraduationCap size={18} />, label: "Онлайн-курс", desc: "Лендинг курса через ИИ — программа, отзывы, форма записи" },
  { icon: <Heart size={18} />, label: "Мероприятие", desc: "Сайт мероприятия бесплатно — программа, билеты, расположение" },
  { icon: <Home size={18} />, label: "Недвижимость", desc: "Создать сайт агентства через ИИ — объекты, фильтр, заявка" },
  { icon: <Dumbbell size={18} />, label: "Фитнес", desc: "Сайт тренера нейросетью бесплатно — услуги, расписание, отзывы" },
  { icon: <Car size={18} />, label: "Автосервис", desc: "ИИ создаст сайт автосервиса — прайс, запись, акции" },
  { icon: <Palette size={18} />, label: "Дизайнер", desc: "Портфолио дизайнера через ИИ — кейсы, процесс, контакты" },
];

export default function UseCases() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.05 }
    );
    el.querySelectorAll(".fade-in-up").forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14 fade-in-up">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Для каких проектов подходит nitgen
          </h2>
          <p className="text-[#71717A] text-lg max-w-2xl mx-auto">
            Для личных проектов — <strong className="text-white/70">бесплатно</strong>. Для коммерческих и клиентских задач —
            по <a href="mailto:sales@nitgen.org" className="text-emerald-400/80 hover:text-emerald-300 underline transition-colors">коммерческой лицензии</a>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((c, i) => (
            <article
              key={i}
              className="fade-in-up rounded-xl border border-white/[0.06] bg-[#141414] p-5 flex gap-4 hover:border-white/[0.12] transition-colors"
              style={{ transitionDelay: `${(i % 6) * 50}ms` }}
            >
              <div className="w-9 h-9 rounded-lg border border-white/[0.08] bg-[#1A1A1A] flex items-center justify-center text-white/50 flex-shrink-0">
                {c.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{c.label}</h3>
                <p className="text-xs text-[#71717A] leading-relaxed">{c.desc}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 fade-in-up">
          <p className="text-center text-sm text-[#71717A] max-w-2xl mx-auto leading-relaxed">
            Нейросеть генерирует уникальный дизайн на основе вашего описания — не шаблон, а индивидуальный сайт.
            Личные проекты — бесплатно. Коммерческое использование —{" "}
            <a href="mailto:sales@nitgen.org" className="text-emerald-400/70 hover:text-emerald-300 underline transition-colors">запросить лицензию</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
