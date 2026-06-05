/**
 * Admin-сиды: примеры планов с needs_admin=true, admin_intent_confidence и
 * размеченными editable_zones (Tier 5: PHP-админка).
 *
 * Без живых примеров в корпусе 7B-планировщик практически никогда не
 * выставляет админ-поля, даже когда юзер явно просит «админку». Три сида
 * покрывают разные СТРУКТУРЫ админок:
 *   - barbershop-admin-prices   — услуги с редактируемыми ценами (text-зоны
 *     прайса + акция + фото мастера), confidence=explicit
 *   - nutritionist-admin-programs — контентный сайт с richtext-программами
 *     и текстом «о себе», confidence=inferred («чтобы я сама обновляла»)
 *   - flowers-admin-catalog     — мини-каталог с парами фото+название+цена
 *     (image-зоны), confidence=explicit
 *
 * Правила зон (EditableZoneSchema): id — snake_case, type — только
 * text|richtext|image, section — строго из plan.sections, при needs_admin=true
 * зон должно быть >= 3 (инвариант normalizePlanForRequest).
 *
 * Версионирование: сиды доливаются в текущий SEED_VERSION=v8 БЕЗ бампа:
 * repair-ветка doBootstrap видит totalPlanSeeds < EXPECTED_PLAN_SEEDS и прогоняет
 * все сиды через addDocument — существующие дедупятся по id мгновенно
 * (возвращается existing с готовым эмбеддингом), новые эмбедятся и встают
 * в корпус без дублей контента.
 */

import type { PlanExampleSeed } from "./planExamples";

export const PLAN_EXAMPLE_SEEDS_ADMIN: PlanExampleSeed[] = [
  {
    id: "barbershop-admin-prices",
    niche: "barbershop",
    query:
      "лендинг барбершопа с админкой: самим менять цены, акцию на главной и фото мастеров",
    plan: {
      business_type: "барбершоп",
      target_audience: "мужчины 20-45, запись онлайн на точное время",
      tone: "уверенный, прямой, без пафоса",
      style_hints: "тёмное дерево, металл, фото мастеров за работой",
      color_mood: "dark-premium",
      sections: [
        "hero",
        "services",
        "pricing",
        "masters",
        "about",
        "contact",
        "booking",
      ],
      keywords: ["барбершоп", "стрижка", "борода", "запись онлайн"],
      cta_primary: "Записаться",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Стрижка по записи на точное время, без ожидания",
      hero_subheadline:
        "4 мастера со стажем от 6 лет. Цены на сайте всегда актуальны — обновляем в день изменения, без сюрпризов на кассе.",
      key_benefits: [
        {
          title: "Запись на точное время",
          description:
            "Слоты по 45 минут, мастер ждёт именно вас — среднее ожидание 0 минут.",
        },
        {
          title: "Мастера от 6 лет стажа",
          description:
            "Каждый прошёл обучение в школе барберов и режет от 1 200 стрижек в год.",
        },
        {
          title: "Фиксированный прайс",
          description:
            "Цена на сайте = цена на кассе. Допуслуги — только если сами попросите.",
        },
      ],
      social_proof_line: "4.9 на Яндекс.Картах, 280 отзывов за 3 года",
      cta_microcopy: "Перенос записи — в один клик из SMS",
      needs_admin: true,
      admin_intent_confidence: "explicit",
      editable_zones: [
        {
          id: "hero_title",
          type: "text",
          label: "Заголовок на главной",
          section: "hero",
        },
        {
          id: "promo_banner",
          type: "text",
          label: "Акция на главной (полоса над шапкой)",
          section: "hero",
        },
        {
          id: "price_haircut",
          type: "text",
          label: "Цена: мужская стрижка",
          section: "pricing",
        },
        {
          id: "price_beard",
          type: "text",
          label: "Цена: оформление бороды",
          section: "pricing",
        },
        {
          id: "price_combo",
          type: "text",
          label: "Цена: стрижка + борода",
          section: "pricing",
        },
        {
          id: "master_1_photo",
          type: "image",
          label: "Фото первого мастера",
          section: "masters",
        },
        {
          id: "about_text",
          type: "richtext",
          label: "Текст «О барбершопе»",
          section: "about",
        },
      ],
    },
  },
  {
    id: "nutritionist-admin-programs",
    niche: "nutritionist",
    query:
      "сайт нутрициолога, чтобы я сама обновляла программы питания, цены и текст о себе без программиста",
    plan: {
      business_type: "частная практика нутрициолога",
      target_audience:
        "женщины 25-45, хотят энергию и стабильный вес без жёстких диет",
      tone: "поддерживающий, экспертный, без давления",
      style_hints: "светлые фото еды, портрет специалиста, мягкие формы",
      color_mood: "warm-pastel",
      sections: ["hero", "about", "programs", "results", "contact", "booking"],
      keywords: ["нутрициолог", "питание", "программа", "консультация"],
      cta_primary: "Выбрать программу",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Питание, которое встроится в вашу жизнь, а не наоборот",
      hero_subheadline:
        "Программы на 4-12 недель: рацион под ваш график и бюджет, поддержка в чате 5 дней в неделю, перестройка привычек без срывов и запретов.",
      key_benefits: [
        {
          title: "Рацион под ваш график",
          description:
            "Меню строится из привычных продуктов и готовки до 30 минут в день.",
        },
        {
          title: "Поддержка 5 дней в неделю",
          description:
            "Отвечаю в чате в течение рабочего дня — разбираем срывы и меню ресторанов.",
        },
        {
          title: "Замеры каждые 2 недели",
          description:
            "Отслеживаем не только вес: замеры, сон, энергию — корректируем программу по факту.",
        },
      ],
      social_proof_line:
        "140 клиенток за 2 года, 86% доходят до конца программы",
      cta_microcopy: "Первая консультация 30 минут — бесплатно",
      needs_admin: true,
      admin_intent_confidence: "inferred",
      editable_zones: [
        {
          id: "hero_title",
          type: "text",
          label: "Заголовок на главной",
          section: "hero",
        },
        {
          id: "about_photo",
          type: "image",
          label: "Моё фото в блоке «Обо мне»",
          section: "about",
        },
        {
          id: "about_text",
          type: "richtext",
          label: "Текст «Обо мне»",
          section: "about",
        },
        {
          id: "program_basic_desc",
          type: "richtext",
          label: "Описание базовой программы",
          section: "programs",
        },
        {
          id: "program_basic_price",
          type: "text",
          label: "Цена базовой программы",
          section: "programs",
        },
        {
          id: "program_pro_price",
          type: "text",
          label: "Цена расширенной программы",
          section: "programs",
        },
        {
          id: "results_text",
          type: "richtext",
          label: "Блок результатов клиенток",
          section: "results",
        },
      ],
    },
  },
  {
    id: "flowers-admin-catalog",
    niche: "flowers",
    query:
      "сайт цветочной мастерской с CMS: менять букеты недели, их фото и цены через админку",
    plan: {
      business_type: "цветочная мастерская",
      target_audience: "покупатели букетов 25-50, заказ к дате и доставка",
      tone: "тёплый, эстетичный, лаконичный",
      style_hints: "крупные фото букетов на нейтральном фоне, много воздуха",
      color_mood: "light-minimal",
      sections: ["hero", "catalog", "delivery", "about", "contact"],
      keywords: ["букеты", "цветы", "доставка цветов", "флорист"],
      cta_primary: "Заказать букет",
      language: "ru",
      suggested_template_id: "blank-landing",
      hero_headline: "Букеты недели из свежей поставки каждый вторник",
      hero_subheadline:
        "Собираем из цветов, приехавших 1-2 дня назад. Доставка по городу за 2 часа, фото вашего букета перед отправкой — в WhatsApp.",
      key_benefits: [
        {
          title: "Поставка дважды в неделю",
          description:
            "Цветы не стоят в холодильнике неделями — букет стоит у вас дома от 7 дней.",
        },
        {
          title: "Доставка за 2 часа",
          description:
            "По городу — в день заказа, к точному часу — бесплатно при заказе от 3 000 ₽.",
        },
        {
          title: "Фото перед отправкой",
          description:
            "Присылаем снимок собранного букета до курьера — заменим цветы, если что-то не так.",
        },
      ],
      social_proof_line: "6 лет в городе, 4.8 по 520 отзывам на Flowwow",
      cta_microcopy: "Оплата онлайн или курьеру при получении",
      needs_admin: true,
      admin_intent_confidence: "explicit",
      editable_zones: [
        {
          id: "hero_title",
          type: "text",
          label: "Заголовок на главной",
          section: "hero",
        },
        {
          id: "hero_image",
          type: "image",
          label: "Главное фото на обложке",
          section: "hero",
        },
        {
          id: "bouquet_1_photo",
          type: "image",
          label: "Букет недели №1 — фото",
          section: "catalog",
        },
        {
          id: "bouquet_1_name",
          type: "text",
          label: "Букет недели №1 — название",
          section: "catalog",
        },
        {
          id: "bouquet_1_price",
          type: "text",
          label: "Букет недели №1 — цена",
          section: "catalog",
        },
        {
          id: "bouquet_2_photo",
          type: "image",
          label: "Букет недели №2 — фото",
          section: "catalog",
        },
        {
          id: "bouquet_2_name",
          type: "text",
          label: "Букет недели №2 — название",
          section: "catalog",
        },
        {
          id: "bouquet_2_price",
          type: "text",
          label: "Букет недели №2 — цена",
          section: "catalog",
        },
        {
          id: "delivery_text",
          type: "richtext",
          label: "Условия доставки",
          section: "delivery",
        },
      ],
    },
  },
];
