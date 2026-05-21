import { TEMPLATE_CATALOG } from "~/lib/config/htmlTemplatesCatalog";

type Props = {
  onSelect: (prompt: string) => void;
};

/**
 * TemplateGrid v2 — без uppercase/font-mono на русских именах.
 * Используется t.emoji вместо SVG TemplateIcon (был сложный технический вид).
 */
const QUICK_PROMPTS: Record<string, string> = {
  "coffee-shop": "Сайт для уютной кофейни в центре города. Меню, часы работы, адрес, контакты.",
  "barbershop": "Брутальный сайт барбершопа. Услуги, цены, мастера, онлайн-запись.",
  "photographer": "Портфолио свадебного фотографа с галереей работ и ценами.",
  "portfolio-dev": "Личный сайт разработчика с проектами и контактами.",
  "wedding": "Свадебное приглашение с историей пары, программой дня и формой ответа.",
  "fitness-trainer": "Сайт персонального тренера с программами и записью на тренировку.",
  "restaurant": "Элегантный сайт ресторана с меню, фото зала и бронированием.",
  "tutor": "Сайт репетитора по английскому языку с ценами и отзывами.",
  "beauty-master": "Сайт мастера маникюра с работами, прайсом и записью.",
  "car-service": "Сайт СТО с услугами, ценами и контактами.",
  "handmade-shop": "Сайт домашней кондитерской, торты на заказ с галереей работ.",
  "dj-music": "Сайт диджея с треками, афишей и бронью на мероприятие.",
  "saas-landing": "Лендинг приложения или своего стартапа с возможностями, ценами и регистрацией.",
  "medical-clinic": "Сайт стоматологической клиники с услугами, врачами и записью.",
  "yoga-studio": "Сайт йога-студии с расписанием, инструкторами и ценами.",
  "tattoo-studio": "Брутальный сайт тату-студии с мастерами, стилями и галереей работ.",
  "flower-shop": "Нежный сайт цветочного магазина с букетами и доставкой.",
  "language-school": "Сайт школы английского с курсами, преподавателями и ценами.",
  "legal-firm": "Строгий сайт юридической компании с услугами и командой.",
  "game-studio": "Сайт инди-студии с играми, дневником разработки и сообществом.",
  "real-estate": "Сайт агентства недвижимости с объектами и риелторами.",
};

export function TemplateGrid({ onSelect }: Props) {
  const templates = TEMPLATE_CATALOG.filter((t) => t.id !== "blank-landing");

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(QUICK_PROMPTS[t.id] ?? t.description)}
            className="nit-card-glow flex flex-col items-start gap-3 p-4 sm:p-5 rounded-xl transition-all"
            style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
          >
            <div className="text-2xl sm:text-3xl">{t.emoji}</div>
            <div
              className="text-[13px] sm:text-[14px] font-medium text-left leading-tight"
              style={{ color: "var(--ink)" }}
            >
              {t.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
