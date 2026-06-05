/**
 * Admin-сиды (Tier 5): примеры планов с needs_admin + editable_zones.
 *
 * Цель — few-shot adoption админ-полей: без живых примеров в корпусе 7B модель
 * практически никогда не выставляет needs_admin и не размечает зоны, даже
 * когда юзер явно просит админку.
 *
 * Три разных «вида админки» (разная структура зон):
 *   - cleaning-admin-pricing    — услуги: редактируемые цены/акция/тексты (explicit)
 *   - flowers-admin-catalog     — каталог: фото + названия + цены товаров (explicit)
 *   - psychologist-admin-content — контент: richtext-статьи/«о себе»/расписание,
 *     без слова «админка» в запросе (inferred)
 *
 * Инварианты схемы: needs_admin=true => editable_zones >= 3; id зон — snake_case;
 * type только text|richtext|image (MVP); section — из plan.sections.
 *
 * Заливка БЕЗ бампа SEED_VERSION: doBootstrap видит totalPlanSeeds < EXPECTED и
 * доливает недостающие repair-веткой (существующие дедупятся по id).
 */

import type { PlanExampleSeed } from "./planExamples";

export const PLAN_EXAMPLE_SEEDS_ADMIN: PlanExampleSeed[] = [
  {
    id: "cleaning-admin-pricing",
    niche: "cleaning",
    query:
      "сайт клининговой компании с админкой: менеджер сам меняет цены, акции и тексты без программиста",
    plan: {
      business_type: "клининговая компания",
      target_audience: "квартиры и офисы, заказ уборки онлайн",
      tone: "деловой, аккуратный, без воды",
      style_hints: "чистые светлые тона, фото до/после, крупные цены",
      color_mood: "light-minimal",
      sections: ["hero", "services", "pricing", "why-us", "faq", "contact"],
      keywords: ["клининг", "уборка", "химчистка", "мытьё окон", "админка"],
      cta_primary: "Заказать уборку",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Уборка с гарантией: не понравилось — переделаем бесплатно",
      hero_subheadline:
        "Выезд уже завтра, цена фиксируется до начала работ. 56 клинеров в штате, своё оборудование Karcher.",
      key_benefits: [
        {
          title: "Цена известна заранее",
          description:
            "Расчёт по метражу до выезда, без доплат «на месте» — сумма в заявке финальная.",
        },
        {
          title: "Клинеры в штате",
          description:
            "56 сотрудников с проверкой и формой, никаких случайных людей из агрегаторов.",
        },
        {
          title: "Гарантия переделки 24 часа",
          description:
            "Нашли пропущенное место — вернёмся и переделаем бесплатно в течение суток.",
        },
      ],
      social_proof_line: "18 000 уборок за 5 лет, 4.8 на Яндекс.Услугах",
      cta_microcopy: "Оценка по фото за 10 минут",
      pricing_tiers: [
        {
          name: "Поддерживающая",
          price: "₽2 990",
          period: "до 50 м²",
          features: ["Пыль, полы, санузел, кухня", "2 клинера, 2 часа", "Свои средства и инвентарь"],
        },
        {
          name: "Генеральная",
          price: "₽6 500",
          period: "до 50 м²",
          features: [
            "Всё из поддерживающей",
            "Окна, плинтуса, внутри шкафов",
            "Кухонный жир и налёт в санузле",
          ],
          highlighted: true,
        },
        {
          name: "После ремонта",
          price: "₽9 900",
          period: "до 50 м²",
          features: ["Строительная пыль и следы краски", "Вывоз мелкого мусора", "3-4 клинера"],
        },
      ],
      faq: [
        {
          question: "Нужно ли быть дома во время уборки?",
          answer:
            "Необязательно: 60% клиентов оставляют ключи консьержу. Клинеры фотографируют результат, отчёт приходит в мессенджер.",
        },
        {
          question: "Чьи средства и оборудование?",
          answer:
            "Наши: профессиональная химия и пылесосы Karcher входят в цену. Есть гипоаллергенная линейка — укажите в заявке.",
        },
        {
          question: "Как быстро можно заказать уборку?",
          answer:
            "При заявке до 15:00 — выезд на следующий день. Срочная уборка «сегодня» — по наличию бригад, наценка 20%.",
        },
      ],
      hours_text: "Ежедневно 8:00-22:00, заявки на сайте — круглосуточно",
      contact_phone: "+7 (343) 290-55-10",
      needs_admin: true,
      admin_intent_confidence: "explicit",
      editable_zones: [
        { id: "hero_title", type: "text", label: "Заголовок hero", section: "hero" },
        { id: "hero_subtitle", type: "text", label: "Подзаголовок hero", section: "hero" },
        { id: "promo_banner", type: "text", label: "Текст акции в шапке", section: "hero" },
        { id: "price_basic", type: "text", label: "Цена: поддерживающая уборка", section: "pricing" },
        { id: "price_general", type: "text", label: "Цена: генеральная уборка", section: "pricing" },
        { id: "price_after_repair", type: "text", label: "Цена: уборка после ремонта", section: "pricing" },
        { id: "about_text", type: "richtext", label: "Текст блока Почему мы", section: "why-us" },
        { id: "contact_phone", type: "text", label: "Телефон в контактах", section: "contact" },
      ],
    },
  },
  {
    id: "flowers-admin-catalog",
    niche: "flowers",
    query:
      "сайт цветочного магазина с каталогом букетов и админкой, чтобы менять фото, названия и цены букетов",
    plan: {
      business_type: "цветочный магазин с доставкой",
      target_audience: "покупатели букетов к праздникам и без повода, доставка по городу",
      tone: "тёплый, лёгкий, без пафоса",
      style_hints: "крупные фото букетов, мягкие тона, карточная сетка каталога",
      color_mood: "warm-pastel",
      sections: ["hero", "catalog", "delivery", "reviews", "contact"],
      keywords: ["букеты", "цветы", "доставка цветов", "флорист", "админка"],
      cta_primary: "Выбрать букет",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Свежие букеты с доставкой за 90 минут",
      hero_subheadline:
        "Собираем из утренней поставки, присылаем фото готового букета перед отправкой. Опоздали больше чем на 15 минут — доставка бесплатно.",
      key_benefits: [
        {
          title: "Фото перед доставкой",
          description:
            "Собрали букет — прислали фото на согласование. Не понравилось — пересобираем до отправки.",
        },
        {
          title: "Свежесть 7 дней",
          description:
            "Цветы из утренней поставки. Завяли раньше недели — заменим букет по фото.",
        },
        {
          title: "К точному часу",
          description:
            "Интервал доставки 30 минут — курьер приедет к встрече из роддома или к началу юбилея.",
        },
      ],
      social_proof_line: "31 000 доставленных букетов, 4.9 по 2 600 отзывам",
      cta_microcopy: "Открытка к букету — бесплатно",
      faq: [
        {
          question: "Что если получателя нет дома?",
          answer:
            "Курьер звонит за 30 минут. Если встреча не сложилась — согласуем новое время в тот же день без доплаты или оставим букет соседям/консьержу по договорённости.",
        },
        {
          question: "Как продлить жизнь букета?",
          answer:
            "Подрезать стебли под углом, менять воду раз в день, держать подальше от батареи. Пакетик подкормки кладём к каждому букету.",
        },
        {
          question: "Можно ли заказать анонимно?",
          answer:
            "Да, по желанию не называем имя отправителя. Текст открытки — любой, подпись необязательна.",
        },
      ],
      hours_text: "Приём заказов ежедневно 8:00-21:00",
      contact_phone: "+7 (812) 309-77-44",
      needs_admin: true,
      admin_intent_confidence: "explicit",
      editable_zones: [
        { id: "hero_title", type: "text", label: "Заголовок hero", section: "hero" },
        { id: "hero_image", type: "image", label: "Главное фото", section: "hero" },
        { id: "bouquet_1_photo", type: "image", label: "Букет 1: фото", section: "catalog" },
        { id: "bouquet_1_name", type: "text", label: "Букет 1: название", section: "catalog" },
        { id: "bouquet_1_price", type: "text", label: "Букет 1: цена", section: "catalog" },
        { id: "bouquet_2_photo", type: "image", label: "Букет 2: фото", section: "catalog" },
        { id: "bouquet_2_name", type: "text", label: "Букет 2: название", section: "catalog" },
        { id: "bouquet_2_price", type: "text", label: "Букет 2: цена", section: "catalog" },
        { id: "bouquet_3_photo", type: "image", label: "Букет 3: фото", section: "catalog" },
        { id: "bouquet_3_name", type: "text", label: "Букет 3: название", section: "catalog" },
        { id: "bouquet_3_price", type: "text", label: "Букет 3: цена", section: "catalog" },
        { id: "delivery_text", type: "richtext", label: "Условия доставки", section: "delivery" },
      ],
    },
  },
  {
    id: "psychologist-admin-content",
    niche: "psychologist",
    query:
      "сайт психолога: хочу сама обновлять текст о себе, статьи и расписание приёма без помощи разработчика",
    plan: {
      business_type: "частная практика психолога",
      target_audience: "взрослые 25-45 с тревожностью и выгоранием, онлайн и очно",
      tone: "спокойный, поддерживающий, без клише",
      style_hints: "мягкие нейтральные тона, портрет, много воздуха",
      color_mood: "earth-natural",
      sections: ["hero", "about", "services", "articles", "schedule", "contact"],
      keywords: ["психолог", "КПТ", "тревожность", "консультация"],
      cta_primary: "Записаться на сессию",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Психолог КПТ: работа с тревогой и выгоранием",
      hero_subheadline:
        "Очно и онлайн, сессия 55 минут. Когнитивно-поведенческая терапия — 14 лет практики, ежемесячная супервизия.",
      key_benefits: [
        {
          title: "Доказательный подход",
          description:
            "КПТ-протоколы под конкретный запрос: тревога, панические атаки, выгорание, самооценка.",
        },
        {
          title: "Первая сессия — знакомство",
          description:
            "Формулируем запрос и план на 6-10 встреч. Продолжать или нет — решаете только вы.",
        },
        {
          title: "Онлайн без потери качества",
          description:
            "Видеосвязь, дневники и материалы между сессиями — формат работает из любого города.",
        },
      ],
      social_proof_line: "14 лет практики, 4 200+ проведённых сессий",
      cta_microcopy: "Ответ на заявку в течение дня",
      faq: [
        {
          question: "Сколько нужно сессий?",
          answer:
            "Зависит от запроса: точечная проблема — обычно 6-10 встреч, глубинная работа — дольше. План обсуждаем на первой сессии и пересматриваем каждые 5 встреч.",
        },
        {
          question: "Это конфиденциально?",
          answer:
            "Да, полностью. Содержание сессий не передаётся третьим лицам, записи не ведутся без вашего согласия. Исключения — только прямая угроза жизни, это оговариваем на старте.",
        },
        {
          question: "Как проходит онлайн-сессия?",
          answer:
            "Видеозвонок 55 минут в удобном сервисе. Нужны наушники и место, где вас не потревожат. Материалы и домашние практики приходят после встречи на почту.",
        },
      ],
      contact_email: "hello@kpt-praktika.ru",
      needs_admin: true,
      admin_intent_confidence: "inferred",
      editable_zones: [
        { id: "hero_title", type: "text", label: "Заголовок hero", section: "hero" },
        { id: "about_photo", type: "image", label: "Портрет", section: "about" },
        { id: "about_text", type: "richtext", label: "Текст О себе", section: "about" },
        { id: "article_1", type: "richtext", label: "Статья 1", section: "articles" },
        { id: "article_2", type: "richtext", label: "Статья 2", section: "articles" },
        { id: "schedule_text", type: "text", label: "Текст расписания приёма", section: "schedule" },
        { id: "contact_email", type: "text", label: "Email для записи", section: "contact" },
      ],
    },
  },
];
