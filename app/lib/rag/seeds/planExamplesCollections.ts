/**
 * Сиды с коллекциями (Tier 6): few-shot примеры декларации повторяющихся
 * записей. Без живых примеров 7B не берёт новое поле collections и по
 * старой памяти раскладывает каталоги на фиксированные зоны (cake_1_*,
 * cake_2_* …) — админка тогда умеет править, но не добавлять/удалять.
 *
 * Паттерн разделения в обоих сидах: единичные блоки (hero, «о нас»,
 * контакты) — в editable_zones; всё, что повторяется карточками — в
 * collections. id коллекций не пересекаются с id зон.
 *
 * explicit (ресторан) + inferred (магазин) — оба уровня уверенности.
 */

import type { PlanExampleSeed } from "./planExamples";

export const PLAN_EXAMPLE_SEEDS_COLLECTIONS: PlanExampleSeed[] = [
  {
    id: "restaurant-admin-menu",
    niche: "restaurant",
    query:
      "сайт грузинского ресторана с меню и админкой: повар сам добавляет и убирает блюда, меняет цены и фото",
    plan: {
      business_type: "грузинский ресторан",
      target_audience: "семьи и компании 20-50 лет, ужины и банкеты",
      tone: "гостеприимный, сытный, без пафоса",
      style_hints: "тёплые тона терракоты, крупные фото блюд, меню карточками",
      color_mood: "earth-natural",
      sections: ["hero", "menu", "about", "testimonials", "faq", "contact"],
      keywords: ["ресторан", "грузинская кухня", "хинкали", "хачапури", "банкет", "админка"],
      cta_primary: "Забронировать стол",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Хинкали лепим при вас — с 12:00 до последнего гостя",
      hero_subheadline:
        "Шеф из Тбилиси, тоне для шоти и винная карта на 38 позиций. Банкеты до 60 гостей, детская комната.",
      key_benefits: [
        {
          title: "Тесто каждое утро",
          description:
            "Хинкали и хачапури лепим с 7 утра, ничего замороженного — не успели продать, отдаём команде.",
        },
        {
          title: "Вино из Кахетии",
          description:
            "Прямые поставки от трёх семейных виноделен — саперави от ₽450 за бокал.",
        },
        {
          title: "Банкет без аренды зала",
          description:
            "Платите только за меню: банкетный зал на 60 мест и тамада-поддержка входят в счёт.",
        },
      ],
      social_proof_line: "12 лет на одном месте, 4.8 на Яндекс.Картах по 2 100 отзывам",
      cta_microcopy: "Подтверждение брони за 5 минут в мессенджере",
      faq: [
        {
          question: "Нужно ли бронировать стол заранее?",
          answer:
            "В будни до 18:00 свободные столы обычно есть. Пятница-суббота и праздники — бронь за 2-3 дня, особенно на компанию от 6 человек.",
        },
        {
          question: "Есть ли вегетарианские блюда?",
          answer:
            "Да: лобио, пхали, хачапури, аджапсандали и грибы на кеци — отдельный раздел в меню, 14 позиций.",
        },
        {
          question: "Можно ли со своим тортом на день рождения?",
          answer:
            "Можно, пробкового сбора нет. Предупредите при брони — охладим и вынесем со свечами.",
        },
      ],
      hours_text: "Ежедневно 12:00–23:00, кухня до 22:30",
      contact_phone: "+7 (812) 407-22-88",
      contact_address: "Санкт-Петербург, ул. Рубинштейна 14",
      needs_admin: true,
      admin_intent_confidence: "explicit",
      editable_zones: [
        { id: "hero_title", type: "text", label: "Заголовок hero", section: "hero" },
        { id: "hero_image", type: "image", label: "Главное фото", section: "hero" },
        { id: "about_text", type: "richtext", label: "Текст О ресторане", section: "about" },
        { id: "hours_line", type: "text", label: "Часы работы", section: "contact" },
        { id: "contact_phone", type: "text", label: "Телефон брони", section: "contact" },
      ],
      collections: [
        {
          id: "menu_items",
          label: "Блюда меню",
          section: "menu",
          fields: [
            { id: "name", label: "Название", type: "text" },
            { id: "description", label: "Описание", type: "text" },
            { id: "price", label: "Цена", type: "price" },
            { id: "photo", label: "Фото", type: "image" },
          ],
        },
      ],
    },
  },
  {
    id: "ecommerce-admin-products",
    niche: "ecommerce",
    query:
      "магазин чехлов ручной работы: хочу сама добавлять товары с фото и ценами, без программиста",
    plan: {
      business_type: "интернет-магазин чехлов ручной работы",
      target_audience: "владельцы смартфонов 18-35, подарки и кастом",
      tone: "лёгкий, творческий, личный",
      style_hints: "чистая сетка товаров, пастель, крупные фото на белом",
      color_mood: "warm-pastel",
      sections: ["hero", "catalog", "how-it-works", "testimonials", "faq", "contact"],
      keywords: ["чехлы на телефон", "ручная работа", "подарок", "кастом"],
      cta_primary: "Выбрать чехол",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Чехлы, которых нет ни у кого в вагоне",
      hero_subheadline:
        "Рисую и отливаю вручную под 140 моделей телефонов. Срок — 5 дней, отправка по всей стране с треком.",
      key_benefits: [
        {
          title: "Кастом по вашему эскизу",
          description:
            "Пришлите референс — согласуем макет до оплаты, правки бесплатны.",
        },
        {
          title: "Не скользит и не желтеет",
          description:
            "Матовый TPU с покрытием soft-touch — тестирую каждую партию полгода на своём телефоне.",
        },
        {
          title: "Обмен без вопросов",
          description:
            "Не подошла модель или оттенок — 14 дней на замену, обратная доставка за мой счёт.",
        },
      ],
      social_proof_line: "2 700 чехлов за три года, 4.9 по 510 отзывам на Ярмарке Мастеров",
      cta_microcopy: "Макет бесплатно до оплаты",
      faq: [
        {
          question: "Сколько делается чехол на заказ?",
          answer:
            "Готовые дизайны отправляю на следующий день. Кастом по эскизу — 5 дней на отрисовку и отливку плюс доставка.",
        },
        {
          question: "На какие модели телефонов есть чехлы?",
          answer:
            "140 моделей: iPhone от 7 до текущих, Samsung A/S, Xiaomi, Realme, Honor. Нет вашей в списке — напишите, обычно нахожу форму за неделю.",
        },
        {
          question: "Как оплатить и получить заказ?",
          answer:
            "Оплата картой или СБП после согласования макета. Доставка Почтой или СДЭК от ₽250, трек приходит в день отправки.",
        },
      ],
      contact_email: "hello@case-craft.ru",
      needs_admin: true,
      admin_intent_confidence: "inferred",
      editable_zones: [
        { id: "hero_title", type: "text", label: "Заголовок hero", section: "hero" },
        { id: "hero_subtitle", type: "text", label: "Подзаголовок hero", section: "hero" },
        { id: "how_text", type: "richtext", label: "Как заказать", section: "how-it-works" },
        { id: "contact_email", type: "text", label: "Email для заказов", section: "contact" },
      ],
      collections: [
        {
          id: "products",
          label: "Товары",
          section: "catalog",
          fields: [
            { id: "photo", label: "Фото", type: "image" },
            { id: "name", label: "Название", type: "text" },
            { id: "price", label: "Цена", type: "price" },
          ],
        },
      ],
    },
  },
];
