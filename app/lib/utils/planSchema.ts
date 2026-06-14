import { z } from "zod";

/**
 * Структурированный копирайт от Planner-а. Пусть планировщик
 * пишет готовые тексты вместо того чтобы Кодер фантазировал. Тексты копирайтерского
 * качества лучше выходят от Planner-а потому что у него маленький контекст
 * (всего запрос + каталог) и он фокусируется только на смысле. Кодер же держит
 * в контексте весь HTML-шаблон и часто скатывается к шаблонным фразам из исходника.
 */
const BenefitSchema = z.object({
  title: z.string().min(2).max(60),
  description: z.string().min(5).max(180),
});

/**
 * Услуга/оффер для секции services/programs/subjects/... — РЕАЛЬНОЕ предложение
 * («Наращивание ресниц», «Чистка лица»), в отличие от key_benefits (выгоды-
 * «почему мы»). Та же форма, что у BenefitSchema, но смысл иной: это каталог
 * того, ЧТО делает бизнес. Заполняется инжектором в офферные секции. (Б)
 */
const ServiceSchema = z.object({
  title: z.string().min(2).max(60),
  description: z.string().min(5).max(180),
});

/** Тариф для pricing-секции. */
const PricingTierSchema = z.object({
  name: z.string().min(1).max(40),
  /** Цена с валютой как строка ("₽1 500", "$29", "€49/мес"). Гибкость > типов. */
  price: z.string().min(1).max(40),
  /** "в месяц", "за сеанс", "разово". */
  period: z.string().max(40).optional(),
  features: z.array(z.string().min(1).max(120)).min(1).max(8),
  /** Рекомендуемый тариф (визуальный акцент в шаблоне). */
  highlighted: z.boolean().optional(),
});

/** Пара вопрос→ответ для FAQ-секции. */
const FaqItemSchema = z.object({
  question: z.string().min(3).max(200),
  answer: z.string().min(5).max(500),
});

/** Член команды/мастер для секции team/masters/staff. */
const TeamMemberSchema = z.object({
  name: z.string().min(1).max(60),
  /** Роль/специализация ("Топ-мастер", "Барбер · 5 лет опыта"). Опц. */
  role: z.string().max(80).optional(),
});

/**
 * Редактируемая зона в сгенерированном сайте — будет помечена в HTML
 * атрибутами data-edit="<id>" data-edit-type="<type>" data-edit-label="<label>"
 * и выведена в PHP-админке.
 *
 * MVP: только три типа. list/link/phone/email — в v2, когда будет ясно что
 * Coder стабильно ставит простые зоны. Не раздувать заранее.
 */
const EditableZoneSchema = z.object({
  /** snake_case, уникальный в рамках сайта. Примеры: hero_title, about_text, contact_phone. */
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "id — snake_case, только a-z, 0-9, _, начинается с буквы"),
  /** Тип контента (MVP: три типа). */
  type: z.enum(["text", "richtext", "image"]),
  /** Подпись для админ-UI, человеческая, на языке сайта. "Заголовок hero". */
  label: z.string().min(2).max(80),
  /** ID секции из plan.sections, в которой живёт зона. Группировка в админке. */
  section: z.string().min(1).max(50),
});

/**
 * Поле записи коллекции (Tier 6). Аналог колонки таблицы в админке.
 * price/number — текстовые input-ы с валидацией на стороне админки,
 * в HTML рендерятся как обычный текст (форматирование решает Coder).
 */
const CollectionFieldSchema = z.object({
  /** snake_case, уникален в рамках коллекции. Примеры: name, price, photo. */
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "id — snake_case, только a-z, 0-9, _, начинается с буквы"),
  /** Подпись колонки в админ-таблице, на языке сайта. "Название", "Цена". */
  label: z.string().min(2).max(80),
  /** Тип поля: рендер формы и валидация в админке. */
  type: z.enum(["text", "richtext", "image", "price", "number"]),
});

/**
 * Коллекция (Tier 6) — повторяющиеся данные сайта: товары, букеты, отзывы,
 * номера отеля. В админке выглядит как таблица (колонки = fields, строки =
 * записи) с добавлением/редактированием/удалением. На сайте рендерится
 * PHP-циклом из одного элемента-образца, размеченного Coder-ом.
 *
 * LLM НЕ пишет ни SQL, ни PHP: Planner декларирует эту схему, Coder
 * размечает образец атрибутами data-collection(-label) / data-item /
 * data-field(-type/-label), детерминированный baker превращает образец в
 * foreach, данные живут в data/collections.json (key = collection id).
 *
 * Разметка самодостаточна (как у зон): label контейнера и type/label каждого
 * поля живут в самом HTML, поэтому бандл-роут умеет извлечь схему коллекций
 * из html даже когда план недоступен (extractCollectionsFromHtml).
 */
const CollectionSchema = z.object({
  /** snake_case, уникален в рамках сайта. Примеры: products, bouquets, reviews. */
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "id — snake_case, только a-z, 0-9, _, начинается с буквы"),
  /** Название таблицы в админке, на языке сайта. "Товары", "Букеты". */
  label: z.string().min(2).max(80),
  /** Колонки таблицы. 1-10 — админ-таблица шире не влезает и не нужна. */
  fields: z.array(CollectionFieldSchema).min(1).max(10),
  /** ID секции из plan.sections, где рендерится коллекция. */
  section: z.string().min(1).max(50),
});

export const PlanSchema = z.object({
  business_type: z.string().min(2).max(100),
  target_audience: z.string().max(200).default(""),
  tone: z.string().max(100).default("профессиональный"),
  style_hints: z.string().max(300).default(""),
  color_mood: z
    .enum([
      "warm-pastel",
      "cool-mono",
      "vibrant-neon",
      "dark-premium",
      "earth-natural",
      "light-minimal",
      "bold-contrast",
    ])
    .default("light-minimal"),
  sections: z.array(z.string()).min(1).max(12),
  keywords: z.array(z.string()).max(15).default([]),
  cta_primary: z.string().max(50).default("Связаться"),
  language: z.enum(["ru", "en", "by"]).default("ru"),
  suggested_template_id: z.string().min(1),

  /** Случайный seed вариативности верстки. Ставится пайплайном при генерации (не планировщиком): один и тот же объект плана идёт в билдер и в превью, поэтому styleVariant даёт один вариант без рассинхрона CSS и разметки. */
  variantSeed: z.number().int().optional(),

  // ─── Копирайт от Planner-а (опц., backward-compat) ───
  hero_headline: z.string().min(3).max(120).optional(),
  hero_subheadline: z.string().max(300).optional(),
  key_benefits: z.array(BenefitSchema).min(3).max(5).optional(),

  /** 3-8 реальных услуг/офферов для секции services/programs/subjects/... Отдельно от key_benefits (это выгоды). Заполняется в офферные секции инжектором. */
  services: z.array(ServiceSchema).min(3).max(8).optional(),

  social_proof_line: z.string().max(150).optional(),
  cta_microcopy: z.string().max(100).optional(),

  /** Название бренда/бизнеса для шапки и футера ("BroDude", "Кофе Лес"). Коротко, 1-3 слова. */
  brand_name: z.string().max(60).optional(),

  /** Команда/мастера/специалисты (name + role) для секции team/masters/staff/barbers. */
  team: z.array(TeamMemberSchema).max(8).optional(),

  // ─── Tier 4: расширенные секции (опц., заполнять только когда уместно) ───

  /** 2-4 тарифа для #pricing секции. В нишах без явных тарифов (юрист, ритуал) пропускать. */
  pricing_tiers: z.array(PricingTierSchema).min(2).max(4).optional(),

  /** Часы работы свободным текстом ("Пн-Пт 9:00-21:00, Сб-Вс 10:00-19:00"). */
  hours_text: z.string().max(200).optional(),

  /** Телефон в свободном формате ("+7 (495) 123-45-67"). */
  contact_phone: z.string().max(40).optional(),

  /** Email. */
  contact_email: z.string().max(80).optional(),

  /** Короткий адрес ("Москва, ул. Арбат 12"). */
  contact_address: z.string().max(150).optional(),

  /** 3-6 типовых вопросов-ответов для #faq секции. */
  faq: z.array(FaqItemSchema).min(3).max(6).optional(),

  // ─── Tier 5: PHP-админка и редактируемые зоны (опц.) ───
  //
  // Когда юзер просит возможность редактировать контент после генерации
  // (админка, CMS, «чтобы клиент сам менял цены») — Planner выставляет
  // needs_admin=true и размечает зоны. Пост-процессор (htmlToPhp baker)
  // превращает их в PHP при бандлинге.
  //
  // Инварианты (реализованы в normalizePlanForRequest):
  //   - needs_admin=true без единой зоны и коллекции => needs_admin гасится
  //   - collections непустой => needs_admin форсится в true
  // Планка «needs_admin => зон >= 3» остаётся рекомендацией промпта:
  // синтезировать зоны детерминированно нельзя (они зависят от секций).

  /** Требуется ли генерировать PHP-админку для этого сайта. */
  needs_admin: z.boolean().optional(),

  /**
   * Уверенность в админ-намерении:
   *   - explicit: юзер явно написал «админка» / «CMS» / «редактор контента»
   *   - inferred: выведено из контекста («чтобы клиент сам обновлял прайс»)
   *   - none: никаких признаков — статика достаточна
   */
  admin_intent_confidence: z.enum(["explicit", "inferred", "none"]).optional(),

  /**
   * Список редактируемых зон. При needs_admin=true обычно 5-12 зон
   * (hero title/subtitle, about text, контакты, картинки главных блоков).
   */
  editable_zones: z.array(EditableZoneSchema).max(20).optional(),

  // ─── Tier 6: коллекции — табличные данные с CRUD в админке (опц.) ───
  //
  // Когда сайту нужны повторяющиеся записи, которые владелец будет
  // добавлять/удалять сам (товары, букеты, отзывы, номера) — Planner
  // декларирует коллекции. Заполнять ТОЛЬКО при needs_admin=true и только
  // когда повторяемость очевидна из запроса; единичные блоки остаются
  // editable_zones.
  //
  // Инварианты:
  //   - collections непустой => needs_admin=true (форсится в normalizePlanForRequest)
  //   - id коллекций не пересекаются с id зон (рекомендация промпта)

  /** Коллекции записей для админ-таблиц. Обычно 1-2 на сайт. */
  collections: z.array(CollectionSchema).max(5).optional(),
});

export type Plan = z.infer<typeof PlanSchema>;
export type PlanBenefit = z.infer<typeof BenefitSchema>;
export type PlanService = z.infer<typeof ServiceSchema>;
export type PlanPricingTier = z.infer<typeof PricingTierSchema>;
export type PlanFaqItem = z.infer<typeof FaqItemSchema>;
export type PlanTeamMember = z.infer<typeof TeamMemberSchema>;
export type PlanEditableZone = z.infer<typeof EditableZoneSchema>;
export type PlanCollection = z.infer<typeof CollectionSchema>;
export type PlanCollectionField = z.infer<typeof CollectionFieldSchema>;

export function extractPlanJson(raw: string): unknown {
  const cleaned = raw
    // Reasoning-модели (Qwen3 и т.п.) эмитят <think>...</think> ПЕРЕД JSON.
    // Без вырезания slice от первой { до последней } захватывает фигурные скобки
    // из размышлений → невалидный JSON → JSON.parse бросает → тихий synthetic-
    // fallback (хороший план модели молча подменяется generic-заглушкой).
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last < 0) throw new Error("Plan JSON not found");
  return JSON.parse(cleaned.slice(first, last + 1), (key, value) => {
    // Защита от prototype pollution: dangerous-ключи из недоверенного LLM-JSON
    // не пропускаем. Zod ниже и так срезал бы неизвестные поля, но дропаем
    // заранее — defense-in-depth для любого кода, читающего объект до Zod.
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return undefined;
    }
    return value;
  });
}

/**
 * Собрать готовый копирайт из плана в текстовый блок для Coder-а.
 * Возвращает null если план не содержит ни одного копирайт-поля (legacy планы).
 */
export function buildCopyHint(plan: Plan): string | null {
  const parts: string[] = [];

  if (plan.brand_name) {
    parts.push(`BRAND NAME (название бренда в шапке/футере, используй дословно): ${plan.brand_name}`);
  }
  if (plan.hero_headline) {
    parts.push(`HERO HEADLINE (используй дословно): ${plan.hero_headline}`);
  }
  if (plan.hero_subheadline) {
    parts.push(`HERO SUBHEADLINE: ${plan.hero_subheadline}`);
  }
  if (plan.key_benefits && plan.key_benefits.length > 0) {
    const list = plan.key_benefits
      .map((b, i) => `  ${i + 1}. ${b.title} — ${b.description}`)
      .join("\n");
    parts.push(`KEY BENEFITS (для features/benefits-секции):\n${list}`);
  }
  if (plan.services && plan.services.length > 0) {
    const items = plan.services.map((s) => `${s.title} — ${s.description}`).join("; ");
    parts.push(`SERVICES (реальные услуги для services/programs/subjects-секции): ${items}`);
  }
  if (plan.team && plan.team.length > 0) {
    const list = plan.team
      .map((t, i) => `  ${i + 1}. ${t.name}${t.role ? ` — ${t.role}` : ""}`)
      .join("\n");
    parts.push(`TEAM (для секции команда/мастера, имя + роль):\n${list}`);
  }
  if (plan.social_proof_line) {
    parts.push(`SOCIAL PROOF: ${plan.social_proof_line}`);
  }
  if (plan.cta_microcopy) {
    parts.push(`CTA MICROCOPY (маленький текст под кнопкой): ${plan.cta_microcopy}`);
  }
  if (plan.pricing_tiers && plan.pricing_tiers.length > 0) {
    const list = plan.pricing_tiers
      .map((t, i) => {
        const period = t.period ? ` (${t.period})` : "";
        const star = t.highlighted ? " ★" : "";
        return `  ${i + 1}. ${t.name}${star} — ${t.price}${period}\n     features: ${t.features.join(", ")}`;
      })
      .join("\n");
    parts.push(`PRICING TIERS (для #pricing секции):\n${list}`);
  }
  if (plan.hours_text) {
    parts.push(`HOURS: ${plan.hours_text}`);
  }
  if (plan.contact_phone || plan.contact_email || plan.contact_address) {
    const lines: string[] = [];
    if (plan.contact_phone) lines.push(`  phone: ${plan.contact_phone}`);
    if (plan.contact_email) lines.push(`  email: ${plan.contact_email}`);
    if (plan.contact_address) lines.push(`  address: ${plan.contact_address}`);
    parts.push(`CONTACT INFO:\n${lines.join("\n")}`);
  }
  if (plan.faq && plan.faq.length > 0) {
    const list = plan.faq
      .map((f, i) => `  ${i + 1}. Q: ${f.question}\n     A: ${f.answer}`)
      .join("\n");
    parts.push(`FAQ:\n${list}`);
  }

  if (parts.length === 0) return null;
  return `ГОТОВЫЙ КОПИРАЙТ ОТ ПЛАНИРОВЩИКА (вставь дословно в соответствующие места шаблона, не переписывай своими словами):\n${parts.join("\n")}`;
}

/**
 * Собрать инструкции по разметке data-edit атрибутов для Coder-а.
 * Возвращает null если админка не нужна или зоны не размечены.
 *
 * Три атрибута делают HTML самодостаточным: htmlToPhp baker и PHP-админка
 * не нуждаются в plan.editable_zones — всё читается из самого HTML.
 */
export function buildEditableZonesHint(plan: Plan): string | null {
  if (!plan.needs_admin || !plan.editable_zones || plan.editable_zones.length === 0) {
    return null;
  }
  const list = plan.editable_zones
    .map(
      (z, i) =>
        `  ${i + 1}. id="${z.id}" type="${z.type}" label="${z.label}" section="${z.section}"`,
    )
    .join("\n");
  return `РАЗМЕТКА РЕДАКТИРУЕМЫХ ЗОН (для PHP-админки):
Для каждой зоны ниже добавь ТРИ атрибута на один и тот же узел:
  data-edit="<id>" data-edit-type="<type>" data-edit-label="<label>"
Примеры:
  <h1 data-edit="hero_title" data-edit-type="text" data-edit-label="Заголовок hero">Лучший кофе в Гродно</h1>
  <div data-edit="about_text" data-edit-type="richtext" data-edit-label="О нас"><p>Мы открылись в 2019...</p></div>
  <img data-edit="hero_image" data-edit-type="image" data-edit-label="Главное фото" src="https://images.unsplash.com/..." alt="">
Зоны:
${list}
Правила:
  - type=text — узел с одной строкой: h1/h2/h3/span/a/p короткий.
  - type=richtext — блочный узел: div/article/section с несколькими абзацами.
  - type=image — элемент <img>. Атрибуты идут на сам <img>, src сохраняется.
  - Ровно один узел на id. id и type дословно из списка, label тоже дословно.
  - Если секция зоны удаляется по плану — пропусти эту зону полностью.`;
}

/**
 * Собрать инструкции по разметке коллекций для Coder-а.
 * Возвращает null если коллекций нет.
 *
 * Coder создаёт РОВНО ОДИН элемент-образец на коллекцию — baker вырежет его,
 * обернёт в PHP-foreach и положит дефолтные значения образца первой записью
 * в data/collections.json. Админка размножает записи, не Coder.
 *
 * Разметка самодостаточна (зеркало зон): label контейнера и type/label
 * каждого поля живут в атрибутах — extractCollectionsFromHtml восстановит
 * схему коллекций из одного html, когда plan недоступен (туннельный путь
 * не передаёт план в браузер, фронт шлёт в бандл-роут только html).
 */
export function buildCollectionsHint(plan: Plan): string | null {
  if (!plan.needs_admin || !plan.collections || plan.collections.length === 0) {
    return null;
  }
  const list = plan.collections
    .map((c, i) => {
      const fields = c.fields
        .map((f) => `id="${f.id}" type="${f.type}" label="${f.label}"`)
        .join("; ");
      return `  ${i + 1}. collection id="${c.id}" label="${c.label}" section="${c.section}"\n     поля: ${fields}`;
    })
    .join("\n");
  return `РАЗМЕТКА КОЛЛЕКЦИЙ (повторяющиеся записи для PHP-админки):
Для каждой коллекции ниже создай в её секции ОДИН элемент-образец:
  - контейнер списка (grid/flex) пометь ДВУМЯ атрибутами: data-collection="<id>" data-collection-label="<label>"
  - внутри контейнера РОВНО ОДНА карточка-образец с атрибутом data-item
  - каждое поле внутри карточки пометь ТРЕМЯ атрибутами: data-field="<field_id>" data-field-type="<type>" data-field-label="<label>"
Пример:
  <div data-collection="cakes" data-collection-label="Торты" class="grid md:grid-cols-3 gap-6">
    <article data-item class="rounded-xl border p-4">
      <img data-field="photo" data-field-type="image" data-field-label="Фото" src="https://images.unsplash.com/..." alt="">
      <h3 data-field="name" data-field-type="text" data-field-label="Название">Торт «Минск»</h3>
      <span data-field="price" data-field-type="price" data-field-label="Цена">₽2 900</span>
    </article>
  </div>
Коллекции:
${list}
Правила:
  - id, type, label — дословно из списка. Все атрибуты обязательны: HTML самодостаточен, как у зон.
  - Ровно ОДИН data-item на коллекцию: не дублируй карточку руками, PHP-цикл размножит её сам.
  - type=image — все три data-field-атрибута на самом <img>, src сохраняется как дефолт.
  - type=richtext — блочный узел; text/price/number — текстовый узел.
  - Заполни образец реалистичными значениями: они станут первой записью таблицы.`;
}
