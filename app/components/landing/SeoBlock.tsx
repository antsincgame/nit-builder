import { useEffect, useRef } from "react";

export default function SeoBlock() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    el.querySelectorAll(".fade-in-up").forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-20 border-t border-b border-white/[0.04]">
      <div className="max-w-4xl mx-auto px-5 sm:px-8">
        <article className="fade-in-up prose prose-invert max-w-none">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-6 text-center">
            Как бесплатно сделать сайт с помощью нейросети
          </h2>

          <div className="space-y-5 text-sm text-[#71717A] leading-relaxed">
            <p>
              <strong className="text-[#A1A1AA]">Бесплатное создание сайтов через ИИ</strong> — это реальность
              с nitgen. Больше не нужно платить за конструкторы вроде Tilda или Wix. Искусственный интеллект
              генерирует сайт по вашему описанию — и делает это прямо на вашем компьютере, бесплатно и без ограничений.
            </p>

            <p>
              Если вы искали способ <strong className="text-[#A1A1AA]">создать сайт бесплатно без знания кода</strong>,
              nitgen решает эту задачу. Опишите свой проект одним предложением — нейросеть создаст готовый
              готовый HTML-сайт. Не нужно разбираться в программировании, CSS или JavaScript.
            </p>

            <p>
              Сайты от nitgen — это не «пустые» страницы. ИИ генерирует <strong className="text-[#A1A1AA]">сайт с SEO-оптимизацией</strong>:
              корректные мета-теги, заголовки, Open Graph и семантическая разметка, чтобы страница хорошо
              индексировалась в Google и Яндекс. А если нужен <strong className="text-[#A1A1AA]">сайт с базой данных и админкой</strong> —
              каталог товаров, форма заявок, простой интернет-магазин — nitgen соберёт готовый PHP-проект
              с SQLite и панелью управления, где можно добавлять и редактировать контент без программиста.
            </p>

            <p>
              <strong className="text-[#A1A1AA]">ИИ генератор сайтов</strong> nitgen работает через LM Studio —
              бесплатную программу для запуска нейросетей локально. Это значит, что ваши данные не уходят
              в облако, а генерация сайтов через искусственный интеллект не требует интернета.
            </p>

            <p>
              В отличие от облачных сервисов, где нужно платить $17–50 в месяц, nitgen
              <strong className="text-[#A1A1AA]"> бесплатен для личного использования</strong> — без подписок,
              без отправки контента на чужие серверы. Ваш компьютер — ваш инструмент,
              ваши сайты — ваша собственность.
            </p>

            <p>
              <strong className="text-[#A1A1AA]">Создать сайт через ИИ бесплатно</strong> можно для
              личных проектов: портфолио, блог, некоммерческий лендинг, каталог с админкой.
              Для коммерческих задач — клиентские сайты, агентская работа, бизнес — доступна
              <strong className="text-[#A1A1AA]"> коммерческая лицензия</strong>. Свяжитесь с отделом продаж: sales@nitgen.org.
            </p>

            <p>
              Откройте nitgen в браузере и <strong className="text-[#A1A1AA]">создайте сайт с помощью ИИ</strong> прямо
              сейчас — без регистрации карты, без пробных периодов. Конструктор работает в браузере,
              а генерация — на вашем компьютере (Windows, macOS, Linux) через LM Studio.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
