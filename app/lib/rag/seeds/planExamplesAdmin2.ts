/**
 * Admin-сиды, порция 2 (Tier 5): ещё три вида админки в дополнение
 * к planExamplesAdmin.ts (барбершоп/нутрициолог/цветочная мастерская).
 *
 * Ниши не пересекаются с первой порцией:
 *   - cleaning-admin-pricing     — услуги: редактируемые цены тарифов + акция (explicit)
 *   - handmade-admin-catalog     — каталог тортов: фото + названия + цены (explicit)
 *   - psychologist-admin-content — контент: richtext-статьи и «о себе» (inferred,
 *     без слова «админка» в запросе)
 *
 * Отдельный файл — чтобы мелкими коммитами не перезаписывать первый.
 * Заливка БЕЗ бампа SEED_VERSION — repair-веткой doBootstrap после
 * подключения массива в ragBootstrap (отдельный коммит).
 */

import type { PlanExampleSeed } from "./planExamples";

export const PLAN_EXAMPLE_SEEDS_ADMIN_2: PlanExampleSeed[] = [
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
          features: ["Пыль, полы, санузел, кухня", "2 клинера, 2 часа", "Средства и инвентарь наши"],
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
    id: "handmade-admin-catalog",
    niche: "handmade",
    query:
      "сайт кондитерской с тортами на заказ и админкой: меняю фото тортов, названия и цены сама",
    plan: {
      business_type: "домашняя кондитерская: торты на заказ",
      target_audience: "заказчики тортов на дни рождения, свадьбы и детские праздники",
      tone: "тёплый, аппетитный, личный",
      style_hints: "крупные фото тортов, кремовые тона, карточная сетка",
      color_mood: "warm-pastel",
      sections: ["hero", "catalog", "how-to-order", "reviews", "faq", "contact"],
      keywords: ["торты на заказ", "кондитер", "бенто-торт", "капкейки", "админка"],
      cta_primary: "Заказать торт",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Торты на заказ: от бенто до свадебных в три яруса",
      hero_subheadline:
        "Только натуральные сливки и бельгийский шоколад. Заказ за 3 дня, срочные бенто — за 24 часа. Фото готового торта перед доставкой.",
      key_benefits: [
        {
          title: "Дегустационный сет",
          description:
            "6 начинок за ₽900 перед большим заказом — сумма зачитывается при заказе торта.",
        },
        {
          title: "Точный повтор макета",
          description:
            "Согласуем эскиз до выпечки. Если торт заметно отличается от эскиза — вернём 30% стоимости.",
        },
        {
          title: "Доставка в термобоксе",
          description:
            "Торт едет в холоде и приезжает ровным даже летом — 374 доставки в 2025 без единого «поплыл».",
        },
      ],
      social_proof_line: "1 400 тортов за 4 года, 4.9 по 380 отзывам",
      cta_microcopy: "Расчёт по фото-референсу за час",
      faq: [
        {
          question: "За сколько дней нужно заказывать?",
          answer:
            "Обычный торт — за 3 дня, свадебный многоярусный — за неделю. Бенто и капкейки — за 24 часа при наличии окна.",
        },
        {
          question: "Есть ли торты без сахара или без глютена?",
          answer:
            "Да: линейка на эритрите и безглютеновые коржи на миндальной муке. Состав и КБЖУ пришлём до оплаты.",
        },
        {
          question: "Как хранить торт до праздника?",
          answer:
            "В холодильнике при +2…+6°C до 48 часов. Достать за 30-40 минут до подачи — крем раскроет вкус.",
        },
      ],
      hours_text: "Приём заказов ежедневно 9:00-20:00",
      contact_phone: "+375 (29) 644-18-22",
      needs_admin: true,
      admin_intent_confidence: "explicit",
      editable_zones: [
        { id: "hero_title", type: "text", label: "Заголовок hero", section: "hero" },
        { id: "cake_1_photo", type: "image", label: "Торт 1: фото", section: "catalog" },
        { id: "cake_1_name", type: "text", label: "Торт 1: название", section: "catalog" },
        { id: "cake_1_price", type: "text", label: "Торт 1: цена", section: "catalog" },
        { id: "cake_2_photo", type: "image", label: "Торт 2: фото", section: "catalog" },
        { id: "cake_2_name", type: "text", label: "Торт 2: название", section: "catalog" },
        { id: "cake_2_price", type: "text", label: "Торт 2: цена", section: "catalog" },
        { id: "cake_3_photo", type: "image", label: "Торт 3: фото", section: "catalog" },
        { id: "cake_3_name", type: "text", label: "Торт 3: название", section: "catalog" },
        { id: "cake_3_price", type: "text", label: "Торт 3: цена", section: "catalog" },
        { id: "order_text", type: "richtext", label: "Как заказать", section: "how-to-order" },
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
