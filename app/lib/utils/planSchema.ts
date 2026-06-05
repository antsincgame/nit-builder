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
 * размечает образец атрибутами data-collection/data-item/data-field,
 * детерминированный baker превращает образец в foreach, данные живут
 * в data/collections.json (key = collection id).
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

  // ─── Копирайт от Planner-а (опц., backward-compat) ───
  hero_headline: z.string().min(3).max(120).optional(),
  hero_subheadline: z.string().max(300).optional(),
  key_benefits: z.array(BenefitSchema).min(3).max(5).optional(),
  social_proof_line: z.string().max(150).optional(),
  cta_microcopy: z.string().max(100).optional(),

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
  // Инварианты (проверяем в normalizePlanForRequest, в этой зоне мягко):
  //   - needs_admin=true => editable_zones.length >= 3
  //   - needs_admin=false => editable_zones пустой или отсутствует
  //   - admin_intent_confidence="none" => needs_admin=false

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
  // Инварианты (мягко, как зоны):
  //   - collections непустой => needs_admin=true
  //   - id коллекций не пересекаются с id зон

  /** Коллекции записей для админ-таблиц. Обычно 1-2 на сайт. */
  collections: z.array(CollectionSchema).max(5).optional(),
});

export type Plan = z.infer<typeof PlanSchema>;
export type PlanBenefit = z.infer<typeof BenefitSchema>;
export type PlanPricingTier = z.infer<typeof PricingTierSchema>;
export type PlanFaqItem = z.infer<typeof FaqItemSchema>;
export type PlanEditableZone = z.infer<typeof EditableZoneSchema>;
export type PlanCollection = z.infer<typeof CollectionSchema>;
export type PlanCollectionField = z.infer<typeof CollectionFieldSchema>;

export function extractPlanJson(raw: string): unknown {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last < 0) throw new Error("Plan JSON not found");
  return JSON.parse(cleaned.slice(first, last + 1));
}

/**
 * Собрать готовый копирайт из плана в текстовый блок для Coder-а.
 * Возвращает null если план не содержит ни одного копирайт-поля (legacy планы).
 */
export function buildCopyHint(plan: Plan): string | null {
  const parts: string[] = [];

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
 * Собрать инструкции по разметке коллекций (data-collection/data-item/data-field)
 * для Coder-а. Возвращает null если коллекций нет.
 *
 * Coder создаёт РОВНО ОДИН элемент-образец на коллекцию — baker вырежет его,
 * обернёт в PHP-foreach и положит дефолтные значения образца первой записью
 * в data/collections.json. Админка размножает записи, не Coder.
 */
export function buildCollectionsHint(plan: Plan): string | null {
  if (!plan.needs_admin || !plan.collections || plan.collections.length === 0) {
    return null;
  }
  const list = plan.collections
    .map((c, i) => {
      const fields = c.fields
        .map((f) => `id="${f.id}" type="${f.type}" label="${f.label}"`)
        .join("; ")
      return `  ${i + 1}. collection id="${c.id}" label="${c.label}" section="${c.section}"\n     поля: ${fields}`;
    })
    .join("\n");
  return `РАЗМЕТКА КОЛЛЕКЦИЙ (повторяющиеся записи для PHP-админки):
Для каждой коллекции ниже создай в её секции ОДИН элемент-образец:
  - контейнер списка (grid/flex) пометь атрибутом data-collection="<id>"
  - внутри контейнера РОВНО ОДНА карточка-образец с атрибутом data-item
  - поля внутри карточки пометь data-field="<field_id>"
Пример:
  <div data-collection="cakes" class="grid md:grid-cols-3 gap-6">
    <article data-item class="rounded-xl border p-4">
      <img data-field="photo" src="https://images.unsplash.com/..." alt="">
      <h3 data-field="name">Торт «Минск»</h3>
      <span data-field="price">₽2 900</span>
    </article>
  </div>
Коллекции:
${list}
Правила:
  - id коллекций и полей — дословно из списка.
  - Ровно ОДИН data-item на коллекцию: не дублируй карточку руками, PHP-цикл размножит её сам.
  - type=image — data-field на самом <img>, src сохраняется как дефолт.
  - type=richtext — блочный узел; text/price/number — текстовый узел.
  - Заполни образец реалистичными значениями: они станут первой записью таблицы.`;
}
