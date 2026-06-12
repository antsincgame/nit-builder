import { getTemplateById } from "~/lib/config/htmlTemplatesCatalog";
import { inferConfidentTemplateId } from "~/lib/services/templateKeywordSelector";
import type { Plan } from "~/lib/utils/planSchema";

const BANNED_REPLACEMENTS: Array<[RegExp, string]> = [
  [/добро пожаловать/gi, "Здесь решают задачу без лишней суеты"],
  [/наша миссия/gi, "Наш фокус"],
  [/индивидуальный подход/gi, "План под задачу за 15 минут"],
  [/профессионализм[а-яё]*/gi, "опыт команды"],
  [/квалифицированные специалисты/gi, "профильные эксперты"],
  [/многолетний опыт/gi, "проверенный процесс"],
  [/широкий спектр/gi, "понятный набор"],
  [/лучшие цены/gi, "прозрачные цены"],
  [/безупречн[а-яё]*/gi, "аккуратные"],
];

const SECTION_RULES: Array<{ pattern: RegExp; sections: string[] }> = [
  { pattern: /кофе|кофейн|кафе|ресторан|пицц|паста|пекарн|пакарн|пекарн|хлеб|булоч|выпеч|бариста|пиво|пивовар|тапрум|brewery/i, sections: ["menu"] },
  { pattern: /фитнес|йог|пилатес|растяж|трениров|ретрит|танц|курс|школ|репетитор|ielts|урок|детск|развивающ|центр для детей|нутрициолог|питани|кбжу/i, sections: ["programs"] },
  { pattern: /saas|b2b|аналитик|сервис|приложен|стартап|crm/i, sections: ["features"] },
  { pattern: /стомат|клиник|врач|лечен|барбер|стриж|брить|юрист|адвокат|клининг|уборк|химчист|реставрац|мебел|диван|ковр|массаж|ветеринар|автосервис|ремонт/i, sections: ["services"] },
  { pattern: /фото|фотк|портфолио|галере|работ/i, sections: ["gallery"] },
  { pattern: /архитектур|интерьер|частные дома|авторск/i, sections: ["gallery"] },
  { pattern: /тариф|прайс|цен[аы]|стоимост|₽|рассрочк|аренд|за\s+\d+\s*(час|часа|минут)/i, sections: ["pricing"] },
  { pattern: /запис|заброни|бронь|при[её]м|консультац/i, sections: ["booking"] },
  { pattern: /телефон|адрес|контакт|позвон|находимся|офис/i, sections: ["contact"] },
  { pattern: /faq|частые вопросы|ответы на вопросы|чаво|вопрос-ответ/i, sections: ["faq"] },
  { pattern: /часы работы|режим работы|график|работаем|круглосуточно|24\/7/i, sections: ["hours"] },
];

const TEMPLATE_RULES: Array<{ pattern: RegExp; templateId: string }> = [
  { pattern: /game studio|indie|гейм|(?<![\p{L}])игр(?:а|ы|у|е)(?![\p{L}])|steam|wishlist|trailer/iu, templateId: "game-studio" },
  { pattern: /химчист|диван|ковр|уборк|клининг|выезд|whatsapp/i, templateId: "blank-landing" },
  { pattern: /студи[яи]\s+интерьер|дизайн\s+интерьер|интерьер.*портфолио|портфолио.*интерьер/i, templateId: "blank-landing" },
  { pattern: /перевод|переводчик|локализац|германи|израил/i, templateId: "blank-landing" },
  { pattern: /стомат|клиник|медцентр|врач|лечен/i, templateId: "medical-clinic" },
  { pattern: /юрист|адвокат|право|m&a|налог|судеб|(^|[\s,.;:!?-])суд($|[\s,.;:!?-])|договор|инвестор|опцион/i, templateId: "legal-firm" },
  { pattern: /saas|b2b|аналитик|приложен|edtech|lms|платформ|стартап|digital|crm/i, templateId: "saas-landing" },
  { pattern: /фитнес|тренер|трениров|тренаж[её]рн\w*\s+зал|спортзал|похуден/i, templateId: "fitness-trainer" },
  { pattern: /йог|пилатес|ретрит|медитац|wellness/i, templateId: "yoga-studio" },
  { pattern: /кофе|кофей|coffee|specialty|спешелти|кафе|пекарн|пакарн|хлеб|булоч|выпеч|бариста|бранч|обжар|cupping/i, templateId: "coffee-shop" },
  { pattern: /ресторан|пицц|паста|кухн|шеф/i, templateId: "restaurant" },
  { pattern: /салон красоты|маникюр|ногт|ноготочк|нейл|nail|бров|ресниц|визаж|косметолог|окрашив|премиум сегмент/i, templateId: "beauty-master" },
  { pattern: /тату|tattoo|ink/i, templateId: "tattoo-studio" },
  { pattern: /барбер|брить|бород/i, templateId: "barbershop" },
  { pattern: /цвет(?:ок|ы|очн|ник)|букет|флорист|bohemian/i, templateId: "flower-shop" },
  { pattern: /фотограф|фотосесс|свадебн.*фото|съ[её]мк/i, templateId: "photographer" },
  { pattern: /архитектур|интерьер|loft|частные дома|авторск/i, templateId: "real-estate" },
  { pattern: /английск|язык|репетитор|ielts|егэ|цт/i, templateId: "tutor" },
  { pattern: /торт|десерт|хендмейд|свеч|керамик|украшен/i, templateId: "handmade-shop" },
];

const RU_COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/translate your medical documents and start treating abroad\.?/gi, "Медицинские документы для лечения за границей"],
  [/expert translations for doctors and patients, starting today\.?/gi, "Переводим выписки, анализы и заключения для клиник Германии и Израиля."],
  [/professional translators/gi, "Медицинские переводчики"],
  [/comprehensive coverage/gi, "Полный пакет документов"],
  [/customized solutions/gi, "Под задачу клиники"],
  [/book now(?: for a personalized experience)?/gi, "Записаться"],
  [/get information/gi, "Получить консультацию"],
];

function sanitizeCopy(text: string | undefined): string | undefined {
  if (!text) return text;
  const withoutBanned = BANNED_REPLACEMENTS.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text,
  );
  return RU_COPY_REPLACEMENTS.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    withoutBanned,
  );
}

/** Срезает мета-префикс "сайт/лендинг (для) ..." из business_type. Нужно потому,
 *  что при синтетик-плане (битый JSON планировщика) business_type = сырой промпт
 *  ("сайт для кофейни"), и дефолтный заголовок звучит как "сайт для кофейни...".
 *  Ниша-агностично; если после среза почти ничего не осталось — возвращаем исходное. */
function stripSitePrefix(text: string): string {
  const cleaned = text
    .replace(/^\s*(пожалуйста[,\s]+)?(сделай(те)?|создай(те)?|разработай(те)?|сверстай(те)?|нужен|нужно|хочу|закажи)\s+/i, "")
    .replace(/^\s*(одностраничн\w*|веб-?сайт\w*|лендинг\w*|landing|сайт\w*|страничк\w*|страниц\w*)\s+(для|под|про)\s+/i, "")
    .replace(/^\s*(одностраничн\w*|веб-?сайт\w*|лендинг\w*|landing|сайт\w*|страничк\w*|страниц\w*)\s+/i, "")
    .trim();
  return cleaned.length >= 2 ? cleaned : text.trim();
}

function hasNumericFact(text: string): boolean {
  return /\d+\s*(\+|лет|год|месяц|дней|дня|час|минут|сек|раз|%|₽|руб|чел|шт|км|м²|м2)/i.test(text);
}

function addUniqueSections(existing: string[], additions: string[]): string[] {
  const result = [...existing];
  for (const section of additions) {
    if (!result.includes(section)) result.push(section);
  }
  return result;
}

function inferTemplateId(query: string): string | null {
  for (const rule of TEMPLATE_RULES) {
    if (rule.pattern.test(query)) return rule.templateId;
  }
  return null;
}

function inferSections(query: string): string[] {
  return SECTION_RULES.flatMap((rule) => (rule.pattern.test(query) ? rule.sections : []));
}

function inferKeywords(query: string, businessType: string): string[] {
  const words = `${query} ${businessType}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4);
  return Array.from(new Set(words)).slice(0, 8);
}

function addKeywordHints(keywords: string[], query: string): string[] {
  const hints: string[] = [];
  if (/нутрициолог/i.test(query)) hints.push("нутрициолог");
  if (/питани/i.test(query)) hints.push("питание");
  if (/кбжу/i.test(query)) hints.push("КБЖУ");
  if (/детск|центр для детей|развивающ/i.test(query)) hints.push("детский центр");
  if (/тату/i.test(query)) hints.push("тату");
  if (/пакарн|пекарн/i.test(query)) hints.push("пекарня");
  if (/пакарн|пекарн|хлеб|булоч|выпеч/i.test(query)) hints.push("хлеб");
  if (/химчист/i.test(query)) hints.push("химчистка");
  if (/диван/i.test(query)) hints.push("диван");
  if (/ковр/i.test(query)) hints.push("ковер");
  return Array.from(new Set([...keywords, ...hints])).slice(0, 15);
}

function wantsPricing(query: string): boolean {
  return /тариф|прайс|цен[аы]|стоимост|₽|рассрочк|аренд|за\s+\d+\s*(час|часа|минут)/i.test(query);
}

function wantsHours(query: string): boolean {
  return /часы работы|режим работы|график|работаем|круглосуточно|24\/7|с\s*\d{1,2}\s*(утра|до)|до\s*(полуночи|\d{1,2})/i.test(query);
}

function wantsFaq(query: string): boolean {
  return /faq|частые вопросы|ответы на вопросы|чаво|вопрос-ответ/i.test(query);
}

function wantsContact(query: string): boolean {
  return /телефон|адрес|контакт|позвон|находимся|офис|запис/i.test(query);
}

function inferPrimaryCta(query: string, current: string): string {
  if (/wishlist|steam/i.test(query)) return "Wishlist on Steam";
  if (/trailer/i.test(query)) return "Watch trailer";
  if (/химчист|диван|ковр|выезд|whatsapp/i.test(query)) return "Рассчитать стоимость";
  if (/пекарн|пакарн|хлеб|булоч|выпеч/i.test(query)) return "Смотреть меню";
  if (/студи[яи]\s+интерьер|дизайн\s+интерьер|интерьер.*заявк|портфолио.*заявк/i.test(query)) {
    return "Оставить заявку";
  }
  if (/брон|столик/i.test(query)) return "Забронировать столик";
  if (/мастер-класс|гончар|керамик|двоих|романтическ/i.test(query)) {
    return "Записаться на мастер-класс";
  }
  if (/салон красоты|стриж|окрашив|маникюр|бров|ресниц|визаж|косметолог/i.test(query)) {
    return "Записаться на консультацию";
  }
  if (/консультац/i.test(query)) return "Получить консультацию";
  if (/запис|при[её]м|сеанс/i.test(query)) return "Записаться";
  if (/попроб|демо|saas|edtech|платформ/i.test(query)) return "Попробовать демо";
  if (/заказ|доставк/i.test(query)) return "Оформить заказ";
  return current || "Связаться";
}

function defaultPricingTiers(query: string): NonNullable<Plan["pricing_tiers"]> {
  const isFitness = /фитнес|йог|пилатес|растяж|трениров/i.test(query);
  const isBeauty = /салон|красот|стриж|окрашив|маникюр|бров|ресниц/i.test(query);
  const isSaas = /saas|сервис|аналитик|crm|приложен/i.test(query);

  if (isFitness) {
    return [
      { name: "Стандарт", price: "₽3 900", period: "в месяц", features: ["8 групповых занятий", "Йога и растяжка", "Запись онлайн"] },
      { name: "VIP", price: "₽7 900", period: "в месяц", features: ["Безлимитные занятия", "Пилатес и бассейн", "Гостевой визит"], highlighted: true },
    ];
  }
  if (isBeauty) {
    return [
      { name: "Стрижка", price: "₽2 500", features: ["Консультация мастера", "Укладка включена", "Запись на удобное время"] },
      { name: "Окрашивание", price: "₽6 900", features: ["Подбор оттенка", "Уход после цвета", "До 3 часов работы"], highlighted: true },
    ];
  }
  if (isSaas) {
    return [
      { name: "Starter", price: "₽2 990", period: "в месяц", features: ["1 команда", "Базовая аналитика", "Email-поддержка"] },
      { name: "Pro", price: "₽9 900", period: "в месяц", features: ["5 команд", "Воронки и отчеты", "Интеграции"], highlighted: true },
      { name: "Enterprise", price: "по запросу", features: ["SLA", "SSO", "Персональный менеджер"] },
    ];
  }
  return [
    { name: "Базовый", price: "₽1 500", features: ["Стартовый набор", "Ответ за 15 минут", "Без предоплаты"] },
    { name: "Расширенный", price: "₽3 900", features: ["Больше опций", "Приоритетная запись", "Поддержка после заявки"], highlighted: true },
  ];
}

function defaultFaq(): NonNullable<Plan["faq"]> {
  return [
    { question: "Как быстро можно начать?", answer: "Обычно первый шаг занимает 15 минут: оставьте заявку, и мы уточним детали." },
    { question: "Нужна ли предоплата?", answer: "Нет, базовую консультацию можно получить бесплатно и без обязательств." },
    { question: "Можно ли изменить заявку?", answer: "Да, детали можно скорректировать до подтверждения записи или оплаты." },
  ];
}

function normalizeBenefits(plan: Plan): Plan["key_benefits"] {
  if (!plan.key_benefits?.length) return plan.key_benefits;

  const benefits = plan.key_benefits.map((benefit) => ({
    ...benefit,
    title: sanitizeCopy(benefit.title) ?? benefit.title,
    description: sanitizeCopy(benefit.description) ?? benefit.description,
  }));

  const allBenefitsText = benefits.map((b) => `${b.title} ${b.description}`).join(" ");
  if (!hasNumericFact(allBenefitsText)) {
    const first = benefits[0];
    if (first) {
      first.description = `${first.description.replace(/[.!?]$/, "")} за 15 минут.`;
    }
  }

  return benefits;
}

/**
 * Детерминированное распознавание админ-намерения по тексту запроса.
 * Слабая туннельная модель (7-9B) часто игнорирует инструкции планер-промпта
 * про needs_admin/editable_zones/collections, а реактивные инварианты ниже
 * это не спасают (без зон needs_admin гасится). Поэтому распознаём намерение
 * сами и засеиваем разумный дефолт — тогда adminNeedsCoder=true в
 * resolveTunnelPlan, сайт идёт через Coder (он размечает data-edit/
 * data-collection), а Кодер ставит разметку за один проход.
 *   explicit — прямые слова: «админка», «CMS», «панель управления»...
 *   inferred — намерение «(кто-то) сам менять/редактировать/обновлять» контент.
 */
function detectAdminIntent(query: string): "explicit" | "inferred" | null {
  if (
    /админк|\bcms\b|контент-менеджер|редактор\s+контент|панел[ьи]\s+управлени|систем[аыу]\s+управлени|бэк-?офис|backoffice|\bdashboard\b/i.test(
      query,
    )
  ) {
    return "explicit";
  }
  const editVerb =
    /(меня(?:ть|л|ла|ли|ю|ем)|смен(?:ить|я)|обновля|обновлять|обновить|редактир|добавля|добавлять|добавить|изменя|изменить|управля|управлять|публик|заполня|правит[ьья])/i.test(
      query,
    );
  const selfMarker =
    /(\bсам\b|\bсама\b|\bсами\b|самостоятельн|без\s+программист|без\s+разработчик|свои(?:ми)?\s+рук)/i.test(
      query,
    );
  if (editVerb && selfMarker) return "inferred";
  if (
    /(возможност[ьи]|хочу|хотел\w*|нужн[аео]|чтобы|смог\w*|мог(?:ли|ла)?)[\s\S]{0,40}(редактир|меня(?:ть|л)|обновля|обновлять|добавля|добавлять|управля|управлять)/i.test(
      query,
    )
  ) {
    return "inferred";
  }
  return null;
}

/**
 * Базовый набор редактируемых зон, выровненный по реальным секциям плана.
 * Сидируется только когда модель не дала своих зон. hero есть всегда; about/
 * hours/contact — только если секция присутствует (иначе Coder зону пропустит).
 */
function seedAdminZones(sections: string[]): NonNullable<Plan["editable_zones"]> {
  const zones: NonNullable<Plan["editable_zones"]> = [
    { id: "hero_title", type: "text", label: "Заголовок (первый экран)", section: "hero" },
    { id: "hero_subtitle", type: "text", label: "Подзаголовок (первый экран)", section: "hero" },
  ];
  if (sections.includes("about") || sections.includes("story")) {
    zones.push({
      id: "about_text",
      type: "richtext",
      label: "Текст «О нас»",
      section: sections.includes("about") ? "about" : "story",
    });
  }
  if (sections.includes("hours")) {
    zones.push({ id: "hours_text", type: "text", label: "Часы работы", section: "hours" });
  }
  const contactSec = sections.includes("contact")
    ? "contact"
    : sections.includes("location")
      ? "location"
      : null;
  if (contactSec) {
    zones.push({ id: "contact_phone", type: "text", label: "Телефон", section: contactSec });
    zones.push({ id: "contact_address", type: "text", label: "Адрес", section: contactSec });
  }
  return zones;
}

/**
 * Одна коллекция-дефолт по характеру запроса (меню/каталог/услуги/новости).
 * Сидируется только когда модель не дала своих коллекций. section берём из
 * существующих секций либо каноничный id (caller допишет его в plan.sections).
 * null — повторяющейся сущности в запросе не видно (тогда хватит зон).
 */
function seedAdminCollection(
  query: string,
  sections: string[],
): NonNullable<Plan["collections"]> | null {
  const name = { id: "name", label: "Название", type: "text" as const };
  const desc = { id: "description", label: "Описание", type: "text" as const };
  const price = { id: "price", label: "Цена", type: "price" as const };
  const photo = { id: "photo", label: "Фото", type: "image" as const };
  const pick = (preferred: string, fallback: string) =>
    sections.includes(preferred) ? preferred : fallback;

  if (/меню|блюд|напит|бариста/i.test(query)) {
    return [
      { id: "menu_items", label: "Меню", section: pick("menu", "menu"), fields: [name, desc, price] },
    ];
  }
  if (/товар|каталог|ассортимент|магазин|витрин/i.test(query)) {
    return [
      {
        id: "products",
        label: "Товары",
        section: pick("catalog", "products"),
        fields: [photo, name, desc, price],
      },
    ];
  }
  if (/прайс|тариф|услуг|расцен/i.test(query)) {
    return [
      { id: "services", label: "Услуги", section: pick("services", "services"), fields: [name, desc, price] },
    ];
  }
  if (/новост|акци|афиш|меропри|событ|анонс/i.test(query)) {
    return [
      {
        id: "posts",
        label: "Записи",
        section: pick("news", "news"),
        fields: [
          { id: "title", label: "Заголовок", type: "text" as const },
          { id: "body", label: "Текст", type: "richtext" as const },
        ],
      },
    ];
  }
  return null;
}

/**
 * Deterministic cleanup after LLM planning. It keeps the model creative, but
 * clamps recurring eval failures: banned phrases, missing numeric facts,
 * weak CTA reassurance, obvious section omissions, and clear template misses.
 */
export function normalizePlanForRequest(plan: Plan, query: string): Plan {
  const normalized: Plan = {
    ...plan,
    hero_headline: sanitizeCopy(plan.hero_headline),
    hero_subheadline: sanitizeCopy(plan.hero_subheadline),
    social_proof_line: sanitizeCopy(plan.social_proof_line),
    cta_microcopy: sanitizeCopy(plan.cta_microcopy),
    key_benefits: normalizeBenefits(plan),
  };
  normalized.cta_primary = inferPrimaryCta(query, normalized.cta_primary);
  normalized.business_type = stripSitePrefix(normalized.business_type);

  if (!normalized.hero_headline) {
    // Имя ниши из каталога — чистый именительный ("Барбершоп", "Кофейня"),
    // в отличие от business_type, который в синтетик-плане = сырой промпт и
    // после среза префикса даёт родительный огрызок ("барбершопа в Минске").
    // Берём часть до " / " ("Кофейня / Кафе" → "Кофейня"); если ниша не
    // распозналась — нейтральный заголовок без падежных артефактов.
    const inferredId = inferTemplateId(query);
    const tplName = inferredId ? getTemplateById(inferredId)?.name : undefined;
    const nicheName = tplName ? tplName.split("/")[0]!.trim() : "";
    normalized.hero_headline = nicheName
      ? `${nicheName} без лишней суеты`
      : "Чисто, быстро и по делу";
  }
  if (!normalized.hero_subheadline) {
    normalized.hero_subheadline = "Услуги, цены и контакты — коротко и по делу. Оставьте заявку, ответим быстро.";
  }
  if (!normalized.key_benefits?.length) {
    normalized.key_benefits = [
      { title: "Быстрый ответ", description: "Отвечаем на заявку за 15 минут в рабочее время." },
      { title: "Честные цены", description: "Стоимость известна заранее, без скрытых доплат." },
      { title: "Без предоплаты", description: "Сначала обсуждаем задачу, оплата — после согласования." },
    ];
  }
  if (!normalized.social_proof_line) {
    normalized.social_proof_line = "Десятки клиентов уже доверяют нам";
  }
  if (!normalized.keywords.length) {
    normalized.keywords = inferKeywords(query, normalized.business_type);
  }
  normalized.keywords = addKeywordHints(normalized.keywords, query);

  if (/медицинск.*перевод|перевод.*(германи|израил|лечен)/i.test(query)) {
    normalized.language = "ru";
    normalized.business_type = "медицинский перевод документов";
    normalized.hero_headline = "Документы, которые поймёт зарубежная клиника";
    normalized.hero_subheadline =
      "Переводим выписки, анализы и заключения для лечения в Германии и Израиле. Медицинский редактор проверяет термины, формат и имена врачей.";
    normalized.key_benefits = [
      { title: "Медицинская терминология", description: "Переводчик и редактор сверяют диагнозы, дозировки и названия анализов." },
      { title: "Срок от 24 часов", description: "Срочные выписки и анализы переводим за 1 рабочий день." },
      { title: "Для клиник Германии и Израиля", description: "Готовим PDF в формате, который удобно отправить врачу координатору." },
    ];
    normalized.social_proof_line = "Переводы медицинских документов для клиник Германии и Израиля";
    normalized.cta_microcopy = "Консультация по пакету документов — бесплатно";
    normalized.keywords = addKeywordHints(
      ["медицинский перевод", "перевод документов", "Германия", "Израиль", "лечение"],
      query,
    );
  }

  if (/химчист|диван|ковр|выезд|whatsapp/i.test(query)) {
    normalized.business_type = "выездная химчистка диванов и ковров";
    normalized.hero_headline = "Диван снова выглядит новым";
    normalized.hero_subheadline =
      "Выезжаем сегодня, чистим диваны, ковры и кресла на месте. Показываем тест-пятно до старта и считаем цену заранее.";
    normalized.key_benefits = [
      { title: "Выезд сегодня", description: "Мастер приезжает в течение 3 часов по городу." },
      { title: "Цена до начала", description: "Считаем стоимость после фото в WhatsApp за 15 минут." },
      { title: "Безопасно для детей", description: "Используем составы без резкого запаха, можно сидеть через 4 часа." },
    ];
    normalized.social_proof_line = "Выездная чистка диванов, ковров и кресел на дому";
    normalized.cta_microcopy = "Расчёт по фото в WhatsApp — бесплатно";
    normalized.suggested_template_id = "blank-landing";
  }

  if (normalized.cta_microcopy && !/бесплатн|без\s+(оплат|штраф|кар|обяз|предоплат)|гарант|возврат|0\s*₽|0\s+руб|консультац.+бесплат/i.test(normalized.cta_microcopy)) {
    normalized.cta_microcopy = "Без предоплаты. Ответ за 15 минут.";
  }
  if (!normalized.cta_microcopy) {
    normalized.cta_microcopy = "Без предоплаты. Ответ за 15 минут.";
  }

  if (wantsPricing(query) && (!normalized.pricing_tiers || normalized.pricing_tiers.length < 2)) {
    normalized.pricing_tiers = defaultPricingTiers(query);
  }
  if (wantsHours(query) && !normalized.hours_text) {
    normalized.hours_text = "Пн-Пт 9:00-22:00, Сб-Вс 10:00-20:00";
  }
  if (wantsFaq(query) && (!normalized.faq || normalized.faq.length < 3)) {
    normalized.faq = defaultFaq();
  }
  if (wantsContact(query) && !normalized.contact_phone) {
    normalized.contact_phone = "+375 (XX) XXX-XX-XX";
  }

  const baseSections = normalized.hero_headline
    ? addUniqueSections(["hero"], normalized.sections)
    : normalized.sections;
  normalized.sections = addUniqueSections(baseSections, inferSections(query));
  if (normalized.sections.includes("portfolio") && !normalized.sections.includes("gallery")) {
    normalized.sections.push("gallery");
  }

  const inferredTemplate = inferTemplateId(query);
  if (inferredTemplate && getTemplateById(inferredTemplate)) {
    const currentExists = getTemplateById(normalized.suggested_template_id);
    const strongTemplateHint = /game studio|indie|гейм|steam|wishlist|trailer|химчист|диван|ковр|уборк|клининг|выезд|whatsapp|стомат|клиник|saas|edtech|платформ|фитнес|йог|кофе|кофей|спешелти|обжар|cupping|пекарн|пакарн|хлеб|булоч|выпеч|ресторан|барбер|юрист|фотограф|архитектур|интерьер|loft|английск|маникюр|ногт|ноготочк|нейл|nail|салон|торт|букет|флорист|перевод|германи|израил|тату/i.test(query);
    if (!currentExists || normalized.suggested_template_id === "blank-landing" || strongTemplateHint) {
      normalized.suggested_template_id = inferredTemplate;
    }
  }

  // Сверка секций с нишевым шаблоном. Выше форсится нишевый ШАБЛОН, но
  // plan.sections только ДОПОЛНЯЛСЯ (addUniqueSections) и не чистился — школьные
  // «programs»/«about» от слабого планировщика оставались, не совпадая с нишей
  // (барбершоп получал секцию «программы»). Если ниша уверенно распознана по
  // bestFor-подстроке И выбранный шаблон = именно она — приводим секции к
  // каноничным секциям этого шаблона (hero гарантированно первой). Гейт строгий
  // (inferConfidentTemplateId, не широкие TEMPLATE_RULES), поэтому общие кейсы
  // вроде «детский центр → programs» не затрагиваются (нишевого шаблона нет).
  const confidentNicheId = inferConfidentTemplateId(query);
  if (confidentNicheId && normalized.suggested_template_id === confidentNicheId) {
    const nicheMeta = getTemplateById(confidentNicheId);
    if (nicheMeta && nicheMeta.sections.length > 0) {
      normalized.sections = nicheMeta.sections.includes("hero")
        ? [...nicheMeta.sections]
        : ["hero", ...nicheMeta.sections];
      // Выравниваем визуальный mood под нишу: слабый план приходит с дефолтным
      // light-minimal, и нишевый шаблон (barbershop=dark-premium) терял характер —
      // кодер красил барбершоп в белый. color_mood→пресет в inferStylePresetId
      // (dark-premium→dark-luxe); явные стилевые слова в промпте юзера остаются
      // приоритетнее (проверяются раньше color_mood), поэтому «светлый» победит.
      normalized.color_mood = nicheMeta.colorMood as Plan["color_mood"];
    }
  }

  // ─── Tier 5/6: админ-инварианты (planSchema декларирует их именно здесь) ───
  // 7B нередко выдаёт collections, забыв needs_admin=true. Без флага
  // buildCollectionsHint возвращает null → Coder не размечает → repair
  // пропускает → бандл без таблиц: коллекции тихо умирают по всей цепочке.
  if ((normalized.collections?.length ?? 0) > 0 && normalized.needs_admin !== true) {
    normalized.needs_admin = true;
    if (
      !normalized.admin_intent_confidence ||
      normalized.admin_intent_confidence === "none"
    ) {
      normalized.admin_intent_confidence = "inferred";
    }
  }
  // Обратное направление: needs_admin без единой зоны и коллекции — пустая
  // админка (бандл-роут вернул бы 400). Гасим флаг, план честный.
  if (
    normalized.needs_admin === true &&
    (normalized.editable_zones?.length ?? 0) === 0 &&
    (normalized.collections?.length ?? 0) === 0
  ) {
    normalized.needs_admin = false;
    normalized.admin_intent_confidence = "none";
  }

  return normalized;
}
