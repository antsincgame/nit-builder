/**
 * Добавка копирайт-банка для ниш v8 (vet, home-services, digital-agency,
 * moving, renovation, hotel). Типы и назначение — см. copywritingBank.ts.
 * Отдельный файл — чтобы мелкими коммитами не перезаписывать основной.
 * Планка planQuality: конкретные цифры, без штампов.
 */

import type {
  HeroSeed,
  BenefitsSeed,
  SocialProofSeed,
  MicrocopySeed,
} from "./copywritingBank";

export const HERO_HEADLINE_SEEDS_V8: HeroSeed[] = [
  { text: "Сантехник без «буду после обеда» — приедет к названному часу", niche: "home-services", tone: "прямой", language: "ru" },
  { text: "Сайты, которые окупают себя до конца квартала", niche: "digital-agency", tone: "уверенный", language: "ru" },
  { text: "Переезд без коробок на ваших плечах", niche: "moving", tone: "спокойный", language: "ru" },
  { text: "Отель, где помнят, какой кофе вы пили в прошлый раз", niche: "hotel", tone: "гостеприимный", language: "ru" },
  { text: "Ремонт, в котором смета — это цена, а не старт торга", niche: "renovation", tone: "честный", language: "ru" },
  { text: "Врач, который разговаривает и с питомцем, и с вами", niche: "vet", tone: "заботливый", language: "ru" },
];

export const BENEFITS_SEEDS_V8: BenefitsSeed[] = [
  {
    niche: "vet",
    language: "ru",
    items: [
      { title: "Своя лаборатория", description: "Анализы за 40 минут без отправки в сторонние лабы." },
      { title: "Стационар с веб-камерами", description: "Смотрите на питомца с телефона в любое время суток." },
      { title: "Узкие специалисты", description: "Кардиолог, дерматолог и ортопед без направлений в другие клиники." },
    ],
  },
  {
    niche: "moving",
    language: "ru",
    items: [
      { title: "Оценка по видео за 20 минут", description: "Точная смета без выезда оценщика — покажите квартиру по звонку." },
      { title: "Страховка до 1 млн ₽", description: "Повреждение фиксируем актом, выплата за 10 рабочих дней." },
      { title: "Сборка мебели включена", description: "Разбираем, пакуем в плёнку и собираем на новом месте." },
    ],
  },
  {
    niche: "hotel",
    language: "ru",
    items: [
      { title: "Завтрак до 12:00", description: "Свежая выпечка и омлеты на заказ — включены в цену номера." },
      { title: "Тихие номера", description: "Стеклопакеты с шумоизоляцией 42 дБ — спите при окнах на улицу." },
      { title: "Поздний выезд бесплатно", description: "До 15:00 при наличии свободных номеров — предупредите накануне." },
    ],
  },
  {
    niche: "digital-agency",
    language: "ru",
    items: [
      { title: "Запуск за 14 дней", description: "Бриф → прототип на 3-й день → дизайн на 7-й → лендинг в проде на 14-й." },
      { title: "Дизайн по метрикам", description: "A/B-тест после запуска, средний рост конверсии по кейсам — 34%." },
      { title: "Исходники ваши", description: "Figma, репозиторий и доступы передаём после финальной оплаты." },
    ],
  },
];

export const SOCIAL_PROOF_SEEDS_V8: SocialProofSeed[] = [
  { text: "38 000 выполненных заявок за 9 лет, 4.7 на Яндекс.Услугах", niche: "home-services", language: "ru" },
  { text: "140 проектов за 6 лет, 11 наград CSS Design Awards", niche: "digital-agency", language: "ru" },
  { text: "6 200 переездов за 8 лет, 14 страховых случаев на все", niche: "moving", language: "ru" },
  { text: "9.4 на Островке по 640 отзывам, гости возвращаются 2.3 раза", niche: "hotel", language: "ru" },
  { text: "212 квартир сдано за 7 лет, средняя просрочка по 2024 — 0 дней", niche: "renovation", language: "ru" },
];

export const MICROCOPY_SEEDS_V8: MicrocopySeed[] = [
  { text: "Диагностика бесплатно при заказе работ", niche: "home-services", purpose: "lower-barrier" },
  { text: "Перенос даты бесплатно за 24 часа", niche: "moving", purpose: "safety" },
  { text: "Бесплатная отмена за 48 часов до заезда", niche: "hotel", purpose: "safety" },
  { text: "Замер и смета бесплатно, выезд за 1 день", niche: "renovation", purpose: "lower-barrier" },
  { text: "Экстренный приём — без записи, круглосуточно", niche: "vet", purpose: "speed" },
  { text: "Оценка проекта и смета — бесплатно, за 2 дня", niche: "digital-agency", purpose: "lower-barrier" },
];
