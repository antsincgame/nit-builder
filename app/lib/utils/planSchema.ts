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
 * атрибутом data-edit="<id>" и выведена в PHP-админке.
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
  // needs_admin=true и размечает зоны. Пост-процессор (следующий этап
  // roadmap) превращает их в PHP при бандлинге.
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
});

export type Plan = z.infer<typeof PlanSchema>;
export type PlanBenefit = z.infer<typeof BenefitSchema>;
export type PlanPricingTier = z.infer<typeof PricingTierSchema>;
export type PlanFaqItem = z.infer<typeof FaqItemSchema>;
export type PlanEditableZone = z.infer<typeof EditableZoneSchema>;

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
 * Coder-promptpath этот блок пока не потребляет — включим в следующем
 * коммите (инструкции Coder + few-shots по разметке).
 */
export function buildEditableZonesHint(plan: Plan): string | null {
  if (!plan.needs_admin || !plan.editable_zones || plan.editable_zones.length === 0) {
    return null;
  }
  const list = plan.editable_zones
    .map((z, i) => `  ${i + 1}. id="${z.id}" type=${z.type} section=${z.section} — ${z.label}`)
    .join("\n");
  return `РАЗМЕТКА РЕДАКТИРУЕМЫХ ЗОН (для PHP-админки):
Добавь атрибут data-edit="<id>" на узлы, соответствующие зонам ниже:
${list}
Правила: type=text — одна строка (h1/h2/span/p короткий); type=richtext — блоковый элемент с несколькими абзацами (div/article/section); type=image — элемент <img>. Ровно один узел на id.`;
}
