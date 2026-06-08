/**
 * Фундамент посекционной генерации (для слабых моделей S/M).
 *
 * Идея: вместо одного большого вызова Coder (весь HTML за раз — слабая 7-9B
 * обрывается и упрощает), генерировать КАЖДУЮ секцию отдельным компактным
 * вызовом с единой дизайн-системой, затем детерминированно сшивать в один
 * документ. Мелкий вызов 7B тянет качественно; общая дизайн-система (палитра +
 * шрифты + CSS-переменные) держит секции согласованными; сшивка гарантирует
 * единый <head>, шрифты и базовый визуальный язык — красота не зависит от того,
 * вспомнит ли модель про консистентность.
 *
 * Здесь — ЧИСТЫЕ функции (дизайн-система, сборка, валидатор контента). Они не
 * трогают рантайм: оркестрация посекционных вызовов подключается отдельно и за
 * флагом. Это позволяет покрыть фундамент юнит-тестами до интеграции.
 */
import type { Plan } from "~/lib/utils/planSchema";
import {
  getPalette,
  pickFontPair,
  type ColorPalette,
  type FontPair,
  type Language,
} from "~/lib/config/designTokens";

export type SectionBlock = {
  /** Имя секции из plan.sections: hero, features, pricing, faq, contact… */
  name: string;
  /** HTML секции — ожидается один <section>…</section> без обвязки документа. */
  html: string;
};

export type SectionDesignSystem = {
  palette: ColorPalette;
  fonts: FontPair;
  /** <link> на Google Fonts (display=swap), готов к вставке в <head>. */
  fontLinks: string;
  /** <style> с :root-переменными палитры + базовый каркас секций/контейнера. */
  baseCss: string;
};

/**
 * Единый дизайн-контракт для всех секций: палитра + шрифты + CSS-переменные.
 * Конкретные hex и шрифты берём из курированных designTokens (тех же, что
 * рекомендуются Coder-у), поэтому посекционный путь визуально совпадает с
 * монолитным. Переменные (--bg/--fg/--primary/--accent/--muted) и базовый
 * каркас (.container/.section/.cards/.btn) дают секциям общий язык, на который
 * они ссылаются вместо изобретения своих цветов и отступов.
 */
export function buildSectionDesignSystem(plan: Plan): SectionDesignSystem {
  const palette = getPalette(plan.color_mood);
  const fonts = pickFontPair({
    colorMood: plan.color_mood,
    language: plan.language as Language,
  });

  const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${fonts.cdnUrl}" rel="stylesheet">`;

  const baseCss = `<style id="nit-section-base">
:root{--bg:${palette.background};--fg:${palette.foreground};--primary:${palette.primary};--primary-fg:${palette.primaryForeground};--accent:${palette.accent};--muted:${palette.muted};--radius:20px;--shadow:0 10px 30px rgba(15,23,42,.06);--shadow-lg:0 24px 60px rgba(15,23,42,.10);--maxw:1160px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:"${fonts.body}",ui-sans-serif,system-ui,sans-serif;line-height:1.6}
h1,h2,h3,h4{font-family:"${fonts.display}",${displaySerif(fonts.display)};line-height:1.1;letter-spacing:-.02em;margin:.2em 0 .4em}
h1{font-size:clamp(2.2rem,5vw,4rem)}
h2{font-size:clamp(1.6rem,3.5vw,2.6rem)}
p{margin:0 0 1em;max-width:65ch}
img,svg,video{max-width:100%;height:auto}
a{color:var(--primary)}
.container{max-width:var(--maxw);margin:0 auto;padding:0 24px}
.section{padding:clamp(64px,10vw,128px) 0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:28px}
.card{background:var(--muted);border-radius:var(--radius);box-shadow:var(--shadow);padding:28px;transition:transform .2s ease,box-shadow .2s ease}
.card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
.btn{display:inline-block;background:var(--primary);color:var(--primary-fg);border-radius:999px;padding:14px 28px;text-decoration:none;font-weight:600;transition:transform .15s ease,box-shadow .2s ease}
.btn:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
</style>`;

  return { palette, fonts, fontLinks, baseCss };
}

function displaySerif(display: string): string {
  // Serif-дисплеи получают serif-фоллбэк, остальные — sans-serif.
  return /Fraunces|Playfair|serif/i.test(display) ? "Georgia,serif" : "ui-sans-serif,system-ui,sans-serif";
}

const HTML_LANG: Record<string, string> = { ru: "ru", by: "be", en: "en" };

/**
 * Детерминированно сшивает секции в единый документ: общий <head> (мета,
 * шрифты, базовый CSS дизайн-системы) + <body> из блоков по порядку
 * plan.sections. Никакой LLM — только склейка, поэтому документ всегда
 * валиден и консистентен, даже если отдельные секции пришли от слабой модели.
 */
export function assembleSections(
  blocks: SectionBlock[],
  params: { plan: Plan; design: SectionDesignSystem },
): string {
  const { plan, design } = params;
  const lang = HTML_LANG[plan.language] ?? "ru";
  const title = (plan.hero_headline || plan.business_type || "").trim();

  const body = blocks
    .map((b) => b.html.trim())
    .filter((h) => h.length > 0)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${design.fontLinks}
${design.baseCss}
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Валидатор контента секции ───
//
// Ловит признаки лени слабой модели: пустую/почти пустую секцию, generic-
// штампы-воду, незаполненные плейсхолдеры. Между посекционными вызовами это
// сигнал перегенерить ИМЕННО плохую секцию, не трогая удачные. Консервативен:
// нормальные CTA («связаться», «оставить заявку») и легитимный заголовок «О
// нас» не штрафуются — ловим только то, что почти всегда вода.

export type SectionValidation = { ok: boolean; issues: string[] };

const STAMP_PATTERNS: RegExp[] = [
  /lorem ipsum/i,
  /\byour (text|content|title|heading) here\b/i,
  /(ваш|введите) текст(\s+здесь)?/i,
  /текст здесь/i,
  /добро пожаловать на наш (сайт|веб-сайт)/i,
  /почему выбирают (именно )?нас/i,
  /почему стоит выбрать нас/i,
  /наши преимущества(?!\s*[:—-]\s*\S)/i, // «Наши преимущества» без двоеточия+контента
  /welcome to our (website|site)/i,
  /why choose us/i,
  /\bplaceholder\b/i,
  /example\.com/i,
];

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateSectionHtml(
  html: string,
  params: { name: string; language?: Plan["language"] },
): SectionValidation {
  const issues: string[] = [];
  const text = stripTags(html);

  if (!html.trim() || !html.includes("<")) {
    issues.push(`секция «${params.name}»: пустой или не-HTML вывод`);
  } else if (text.length < 40) {
    issues.push(`секция «${params.name}»: почти нет текста (${text.length} симв.)`);
  }

  for (const re of STAMP_PATTERNS) {
    if (re.test(html)) {
      issues.push(`секция «${params.name}»: generic-штамп/плейсхолдер (${re.source.slice(0, 32)}…)`);
      break; // одного сигнала достаточно — не засоряем список
    }
  }

  // Содержательная секция почти всегда имеет заголовок. Hero — обязательно.
  const hasHeading = /<h[1-3][\s>]/i.test(html);
  if (!hasHeading && params.name.toLowerCase().includes("hero")) {
    issues.push(`секция «${params.name}»: нет заголовка (h1/h2)`);
  }

  return { ok: issues.length === 0, issues };
}

// ─── Промпт генерации одной секции ───
//
// Компактный промпт под слабую модель: одна секция за вызов. Несёт только
// релевантный для секции копирайт из плана + дизайн-контракт (переменные и
// классы общей системы, на которые секция ссылается вместо изобретения своих
// цветов). Выход жёстко ограничен одним <section> без обвязки документа —
// сшивкой займётся assembleSections.

function joinBenefits(plan: Plan): string {
  return (plan.key_benefits ?? [])
    .map((b) => `  - ${b.title}: ${b.description}`)
    .join("\n");
}

function joinPricing(plan: Plan): string {
  return (plan.pricing_tiers ?? [])
    .map((t) => {
      const period = t.period ? ` ${t.period}` : "";
      const mark = t.highlighted ? " (рекомендуемый)" : "";
      return `  - ${t.name} — ${t.price}${period}${mark}: ${t.features.join(", ")}`;
    })
    .join("\n");
}

function joinFaq(plan: Plan): string {
  return (plan.faq ?? []).map((f) => `  - ${f.question} → ${f.answer}`).join("\n");
}

function joinContacts(plan: Plan): string {
  const parts: string[] = [];
  if (plan.contact_phone) parts.push(`телефон ${plan.contact_phone}`);
  if (plan.contact_email) parts.push(`email ${plan.contact_email}`);
  if (plan.contact_address) parts.push(`адрес ${plan.contact_address}`);
  if (plan.hours_text) parts.push(`часы работы: ${plan.hours_text}`);
  return parts.map((p) => `  - ${p}`).join("\n");
}

/** Релевантный для секции бриф из плана (или инструкция, если данных нет). */
function sectionBrief(plan: Plan, name: string): string {
  const n = name.toLowerCase();

  if (/hero|главн|первый экран/.test(n)) {
    const lines = [
      plan.hero_headline
        ? `Заголовок: ${plan.hero_headline}`
        : `Заголовок: краткий и конкретный про «${plan.business_type}».`,
      plan.hero_subheadline
        ? `Подзаголовок: ${plan.hero_subheadline}`
        : `Подзаголовок: одно предложение о пользе.`,
      `Кнопка (CTA): ${plan.cta_primary}.`,
    ];
    if (plan.cta_microcopy) lines.push(`Микрокопия под кнопкой: ${plan.cta_microcopy}`);
    if (plan.social_proof_line) lines.push(`Линия доверия: ${plan.social_proof_line}`);
    return lines.join("\n");
  }

  if (/feature|benefit|преимущ|услуг|возможност|выгод/.test(n)) {
    const b = joinBenefits(plan);
    return b
      ? `Преимущества (каждое — карточка .card):\n${b}`
      : `3-4 конкретных преимущества «${plan.business_type}», каждое карточкой .card с заголовком и пояснением. Без общих слов.`;
  }

  if (/pricing|price|тариф|цен|стоимост|прайс/.test(n)) {
    const p = joinPricing(plan);
    return p
      ? `Тарифы (каждый — карточка .card, рекомендуемый выделить акцентом):\n${p}`
      : `Тарифы/цены «${plan.business_type}» карточками .card. Если точных цен нет — опиши пакеты по ценности.`;
  }

  if (/faq|вопрос|q&a|часто задава/.test(n)) {
    const f = joinFaq(plan);
    return f
      ? `Вопросы и ответы:\n${f}`
      : `4-5 реальных вопросов клиента «${plan.business_type}» с короткими ответами.`;
  }

  if (/contact|контакт|связ/.test(n)) {
    const c = joinContacts(plan);
    return c
      ? `Контакты:\n${c}\nКнопка действия: ${plan.cta_primary}.`
      : `Блок контактов с кнопкой «${plan.cta_primary}». Если данных нет — форма заявки (имя, телефон).`;
  }

  if (/about|о нас|о компании|о студии|истори/.test(n)) {
    return `Коротко о «${plan.business_type}»${plan.target_audience ? ` для аудитории: ${plan.target_audience}` : ""}. Конкретика, без воды и штампов.`;
  }

  return `Конкретный осмысленный контент секции по теме «${plan.business_type}». Без воды и общих фраз.`;
}

/**
 * Строит промпт для генерации ОДНОЙ секции. Дизайн-контракт ссылается на
 * переменные и классы общей системы (buildSectionDesignSystem), поэтому секция
 * наследует палитру/шрифты, а не изобретает свои. Выход — только <section>.
 */
export function buildSectionPrompt(
  plan: Plan,
  sectionName: string,
  design: SectionDesignSystem,
): string {
  const langName =
    plan.language === "en" ? "English" : plan.language === "by" ? "беларуская мова" : "русский";
  const p = design.palette;

  return `Сгенерируй ОДНУ секцию сайта. Тип бизнеса: «${plan.business_type}».${plan.target_audience ? ` Аудитория: ${plan.target_audience}.` : ""} Тон: ${plan.tone}. Язык контента: ${langName}.

СЕКЦИЯ: «${sectionName}».
${sectionBrief(plan, sectionName)}

ДИЗАЙН-КОНТРАКТ (общая система уже подключена — НЕ дублируй её):
  - НЕ пиши <!DOCTYPE>, <html>, <head>, <body> и не подключай шрифты — только сама секция.
  - Используй готовые CSS-переменные вместо своих цветов: var(--primary) (акцент/CTA), var(--bg), var(--fg), var(--accent), var(--muted).
  - Опирайся на готовые классы: .section (внешний отступ), .container (центровка), .cards + .card (сетка карточек), .btn (кнопка).
  - Палитра для справки: фон ${p.background}, текст ${p.foreground}, акцент ${p.primary}. Не вводи чужие цвета.
  - Семантика: оберни в <section class="section"> … <div class="container"> … </div></section>. У содержательной секции должен быть заголовок (h2, у hero — h1).

ЗАПРЕЩЕНО: штампы «Добро пожаловать», «Наши преимущества», «Почему выбирают нас», lorem ipsum, плейсхолдеры, выдуманные цифры и отзывы.

ВЫВОД: только один блок <section>…</section> на языке «${langName}». Без markdown-ограждений, без пояснений до или после.`;
}

// ─── Редьюсер посекционной генерации (SectionFlow) ───
//
// Машина состояний как ЧИСТАЯ функция: оркестратор (tunnelRegistry) держит
// state в pending-запросе и на каждый ответ модели зовёт advanceSectionFlow,
// получая либо «пошли такой промпт в туннель», либо «готово, вот документ».
// Сам LLM-вызов делает оркестратор тем же туннельным generate, что и фазы
// plan/code/repair — здесь только детерминированная логика, поэтому всё
// покрывается юнит-тестами без реального туннеля.

export type SectionFlowState = {
  plan: Plan;
  design: SectionDesignSystem;
  /** Очередь имён секций (snapshot plan.sections на старте). */
  queue: string[];
  /** Индекс текущей секции в очереди. */
  index: number;
  /** Накопленные готовые блоки. */
  blocks: SectionBlock[];
  /** Ретраи ТЕКУЩЕЙ секции (сбрасывается при переходе к следующей). */
  retries: number;
};

export type SectionFlowStep =
  | { kind: "generate"; system: string; prompt: string; sectionName: string }
  | { kind: "done"; html: string };

/** Системный промпт секционного кодера: одна секция, без обвязки документа. */
export const SECTION_GENERATE_SYSTEM =
  "Ты — опытный HTML/CSS-разработчик. Генерируешь ОДНУ секцию лендинга по брифу. Дизайн-система (CSS-переменные и классы) уже подключена глобально — не дублируй её. Возвращаешь ТОЛЬКО валидный <section>…</section>: без <!DOCTYPE>, <html>, <head>, <body>, без markdown-ограждений и без комментариев.";

/**
 * Вытаскивает один <section> из ответа модели: снимает markdown-ограждения и
 * берёт первый …последний <section>. Если тегов нет — возвращает очищенный
 * текст как есть (валидатор затем решит, годен ли он).
 */
export function extractSectionHtml(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
  const m = s.match(/<section[\s\S]*<\/section>/i);
  return m ? m[0] : s;
}

export function initSectionFlow(plan: Plan, design: SectionDesignSystem): SectionFlowState {
  return { plan, design, queue: [...plan.sections], index: 0, blocks: [], retries: 0 };
}

/** Шаг для текущего индекса: generate очередной секции либо done (всё готово). */
function nextSectionStep(state: SectionFlowState): SectionFlowStep {
  if (state.index >= state.queue.length) {
    return {
      kind: "done",
      html: assembleSections(state.blocks, { plan: state.plan, design: state.design }),
    };
  }
  const name = state.queue[state.index]!;
  return {
    kind: "generate",
    system: SECTION_GENERATE_SYSTEM,
    prompt: buildSectionPrompt(state.plan, name, state.design),
    sectionName: name,
  };
}

/** Первый шаг потока (generate первой секции, либо done если секций нет). */
export function startSectionFlow(state: SectionFlowState): SectionFlowStep {
  return nextSectionStep(state);
}

/**
 * Принимает ответ модели на текущую секцию и возвращает новое состояние +
 * следующий шаг. Секция принимается, если прошла валидатор и не оборвана по
 * длине; иначе ретраится, пока не исчерпан лимит (после лимита берём что есть,
 * чтобы не зациклиться). Чистая функция — старое состояние не мутируется.
 */
export function advanceSectionFlow(
  state: SectionFlowState,
  output: string,
  opts: { maxRetries: number; truncated?: boolean },
): { state: SectionFlowState; step: SectionFlowStep } {
  const name = state.queue[state.index] ?? "section";
  const html = extractSectionHtml(output);
  const valid = validateSectionHtml(html, { name, language: state.plan.language });
  const accept = (valid.ok && !opts.truncated) || state.retries >= opts.maxRetries;

  if (accept) {
    const next: SectionFlowState = {
      ...state,
      blocks: [...state.blocks, { name, html }],
      index: state.index + 1,
      retries: 0,
    };
    return { state: next, step: nextSectionStep(next) };
  }

  const next: SectionFlowState = { ...state, retries: state.retries + 1 };
  return { state: next, step: nextSectionStep(next) };
}
