// Adds deterministic post-polish guards for style leaks and boilerplate copy.
import type { StylePresetId } from "~/lib/llm/style-presets";
import type { Plan } from "~/lib/utils/planSchema";

export type HtmlPostPolishResult = {
  html: string;
  fixes: string[];
};

type HtmlPostPolishParams = {
  html: string;
  presetId: StylePresetId;
  plan: Plan;
};

const PLACEHOLDER_RE =
  /A dedicated narrative block for ([^,.<]+), connected to the main conversion path\./gi;

function insertBeforeHeadEnd(html: string, style: string): string {
  if (html.includes("</head>")) return html.replace("</head>", `${style}\n</head>`);
  return `${style}\n${html}`;
}

function hasNeonLeak(html: string): boolean {
  // glitch/scanline/#ff2e93/#d4ff00/JetBrains Mono — реальные сигнатуры neon-cyber
  // пресета (классы, @keyframes, палитра, шрифт). acid/cyber/hud огораживаем \b:
  // как CSS-идентификаторы они стоят отдельным словом (acid-text, cyber, HUD), но
  // внутри прозы (cybersecurity, Hudson, acidic) матчиться не должны — иначе
  // светлый пресет ловит ложный "leak" и получает лишний override.
  return /glitch|scanline|#ff2e93|#d4ff00|\bacid\b|\bcyber\b|\bhud\b|JetBrains Mono/i.test(html);
}

function isLightPreset(id: StylePresetId): boolean {
  return id === "clean-saas" || id === "warm-premium" || id === "editorial";
}

function polishBoilerplateCopy(html: string, language: Plan["language"]): HtmlPostPolishResult {
  let fixed = html.replace(PLACEHOLDER_RE, (_, rawKeyword: string) => {
    const keyword = String(rawKeyword).trim();
    return language === "ru"
      ? `Практический блок про ${keyword}: зачем это важно, как работает и куда ведёт пользователя.`
      : `A practical ${keyword} block explains value, flow, and the next user action.`;
  });
  fixed = fixed.replace(/\bExplore system\b/g, language === "ru" ? "Посмотреть процесс" : "Explore process");
  fixed = fixed.replace(/\bexample\.com\b/g, "localgpu.lab");
  return {
    html: fixed,
    fixes: fixed === html ? [] : ["boilerplate-copy"],
  };
}

function lightStyleOverride(id: StylePresetId): string {
  const warm = id === "warm-premium";
  const bg = warm ? "#fbf7ef" : "#f8fafc";
  const panel = warm ? "rgba(255,255,255,.76)" : "#ffffff";
  const accent = warm ? "#7c3aed" : "#2563eb";
  return `<style id="nit-post-polish-style">
:root{--nit-polish-bg:${bg};--nit-polish-panel:${panel};--nit-polish-ink:#0f172a;--nit-polish-muted:#64748b;--nit-polish-accent:${accent}}
body{background:var(--nit-polish-bg)!important;color:var(--nit-polish-ink)!important}
.glitch,[class*="glitch"],[class*="scanline"],[class*="hud"]{animation:none!important;text-shadow:none!important}
a[class*="btn"],button[class*="btn"],.cta{border-radius:999px!important;letter-spacing:normal!important;text-transform:none!important}
section,article,.card,.panel{border-color:rgba(15,23,42,.10)!important}
.card,.panel,.price,.faq details{background:var(--nit-polish-panel)!important;box-shadow:0 18px 45px rgba(15,23,42,.08)!important}
</style>`;
}

function rewriteNeonTokens(html: string, id: StylePresetId): HtmlPostPolishResult {
  const warm = id === "warm-premium";
  const replacements: Array<[RegExp, string]> = [
    [/#33c7ff/gi, warm ? "#2563eb" : "#2563eb"],
    [/#ff2e93/gi, warm ? "#f97316" : "#7c3aed"],
    [/#d4ff00/gi, warm ? "#f59e0b" : "#38bdf8"],
    [/glitchOne/g, "softShiftOne"],
    [/glitchTwo/g, "softShiftTwo"],
    [/scanlines/gi, "soft-texture"],
  ];
  const fixed = replacements.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    html,
  );
  return {
    html: fixed,
    fixes: fixed === html ? [] : ["neon-token-rewrite"],
  };
}

export function postPolishHtml(params: HtmlPostPolishParams): HtmlPostPolishResult {
  const fixes: string[] = [];
  let html = params.html;

  const copy = polishBoilerplateCopy(html, params.plan.language);
  html = copy.html;
  fixes.push(...copy.fixes);

  if (isLightPreset(params.presetId) && hasNeonLeak(html)) {
    const rewritten = rewriteNeonTokens(html, params.presetId);
    html = rewritten.html;
    fixes.push(...rewritten.fixes);
    html = insertBeforeHeadEnd(html, lightStyleOverride(params.presetId));
    fixes.push("light-style-override");
  }

  return { html, fixes: Array.from(new Set(fixes)) };
}

// ─── SEO из коробки (детерминированный, из плана) ──────────────────
//
// Слабая модель почти не ставит SEO-голову (description, OpenGraph, JSON-LD).
// Делаем это детерминированно из полей плана — не завися от модели. Идемпотентно:
// маркер data-nit-seo + проверка уже стоящих тегов исключают дубли.

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escJsonLd(s: string): string {
  // Безопасная вставка JSON в <script>: гасим угловые скобки и амперсанд.
  return s.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function ogLocale(lang: Plan["language"]): string {
  return lang === "en" ? "en_US" : lang === "by" ? "be_BY" : "ru_RU";
}

function seoDescription(plan: Plan): string {
  const raw =
    plan.hero_subheadline?.trim() ||
    plan.social_proof_line?.trim() ||
    `${plan.business_type}. ${plan.target_audience ?? ""}`.trim();
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 157).trimEnd()}…` : flat;
}

function buildJsonLd(plan: Plan, desc: string): string {
  const graph: Record<string, unknown>[] = [];

  const org: Record<string, unknown> = {
    "@type": "Organization",
    name: plan.business_type,
    description: desc,
  };
  const contactPoint: Record<string, unknown> = {};
  if (plan.contact_phone) contactPoint.telephone = plan.contact_phone;
  if (plan.contact_email) contactPoint.email = plan.contact_email;
  if (Object.keys(contactPoint).length > 0) {
    contactPoint["@type"] = "ContactPoint";
    contactPoint.contactType = "customer service";
    org.contactPoint = contactPoint;
  }
  graph.push(org);

  if (plan.contact_address) {
    const lb: Record<string, unknown> = {
      "@type": "LocalBusiness",
      name: plan.business_type,
      description: desc,
      address: { "@type": "PostalAddress", streetAddress: plan.contact_address },
    };
    if (plan.contact_phone) lb.telephone = plan.contact_phone;
    if (plan.hours_text) lb.openingHours = plan.hours_text;
    graph.push(lb);
  }

  if (plan.faq && plan.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: plan.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  const doc = { "@context": "https://schema.org", "@graph": graph };
  return `<script type="application/ld+json">${escJsonLd(JSON.stringify(doc))}</script>`;
}

const SEO_MARKER = "data-nit-seo";

/**
 * Внедряет SEO-голову из плана. Идемпотентно. Не перетирает теги, которые
 * модель уже поставила сама (description/og/twitter/json-ld) — только дополняет
 * отсутствующее. Пустые alt у картинок заполняет бизнес-контекстом.
 */
export function applySeoHead(html: string, plan: Plan): string {
  if (html.includes(SEO_MARKER)) return html;

  const desc = seoDescription(plan);
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = (titleMatch?.[1]?.trim() || plan.hero_headline || plan.business_type).replace(
    /\s+/g,
    " ",
  );
  const locale = ogLocale(plan.language);

  const tags: string[] = [`<meta ${SEO_MARKER}="1" name="robots" content="index, follow">`];

  if (!/<meta\s+name=["']description["']/i.test(html)) {
    tags.push(`<meta name="description" content="${escAttr(desc)}">`);
  }
  if (plan.keywords && plan.keywords.length > 0 && !/<meta\s+name=["']keywords["']/i.test(html)) {
    tags.push(`<meta name="keywords" content="${escAttr(plan.keywords.slice(0, 12).join(", "))}">`);
  }
  if (!/property=["']og:title["']/i.test(html)) {
    tags.push(
      `<meta property="og:type" content="website">`,
      `<meta property="og:locale" content="${locale}">`,
      `<meta property="og:title" content="${escAttr(title)}">`,
      `<meta property="og:description" content="${escAttr(desc)}">`,
    );
  }
  if (!/name=["']twitter:card["']/i.test(html)) {
    tags.push(
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escAttr(title)}">`,
      `<meta name="twitter:description" content="${escAttr(desc)}">`,
    );
  }
  if (!/application\/ld\+json/i.test(html)) {
    tags.push(buildJsonLd(plan, desc));
  }

  const head = tags.join("\n");
  let out = html.includes("</head>")
    ? html.replace("</head>", `${head}\n</head>`)
    : `${head}\n${html}`;

  // Пустые alt → бизнес-контекст (непустые не трогаем).
  out = out.replace(
    /<img((?:[^>]*?\s)?)alt=""([^>]*)>/gi,
    (_m, pre: string, post: string) => `<img${pre}alt="${escAttr(plan.business_type)}"${post}>`,
  );

  return out;
}

// ─── Детерминированный премиум-слой (база красоты для слабых моделей) ───
//
// Цель: «навести красоту» на ЛЮБОЙ вывод, не завися от вкуса модели. Все
// правила завёрнуты в :where() — специфичность 0, поэтому слой только
// ЗАПОЛНЯЕТ пустоту: любой стиль, который модель задала сама, перебивает наш
// дефолт. Сломать чужую вёрстку он физически не может. Добавляет лоск,
// который слабая 7-9B обычно забывает: сглаживание шрифтов, smooth-scroll,
// тонкую типографику заголовков, плавные transition, focus-visible, корректный
// reduced-motion и адаптивные медиа.

const PREMIUM_BASE_STYLE = `<style id="nit-premium-base">
:where(html){scroll-behavior:smooth;-webkit-text-size-adjust:100%}
:where(body){-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
:where(h1,h2,h3,h4){letter-spacing:-.02em;line-height:1.12;text-wrap:balance}
:where(p,li){text-wrap:pretty}
:where(a,button,.btn,[role="button"]){transition:color .2s ease,background-color .2s ease,border-color .2s ease,transform .15s ease,box-shadow .2s ease}
:where(img,svg,video){max-width:100%;height:auto}
:where(::selection){background:rgba(99,102,241,.18)}
:where(:focus-visible){outline:2px solid currentColor;outline-offset:2px}
@media (prefers-reduced-motion:reduce){:where(html){scroll-behavior:auto}*,*::before,*::after{animation-duration:.001ms!important;transition-duration:.001ms!important}}
@media (prefers-reduced-motion:no-preference){.nit-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}.nit-reveal.nit-vis{opacity:1;transform:none}}
</style>`;

const INTER_FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

// Scroll-reveal: плавное появление секций при скролле — приём, который слабая
// модель почти никогда не делает сама. Полностью graceful: первый экран НИКОГДА
// не прячется (анимируются только элементы ниже 85% вьюпорта), всё в try/catch,
// уважается prefers-reduced-motion, а fallback-таймер через 2.5s показывает всё
// принудительно — контент не останется скрытым, даже если IntersectionObserver
// не сработает. Завёрнут в IIFE, идемпотентность обеспечивает applyPremiumBaseLayer.
const REVEAL_SCRIPT = `<script id="nit-reveal">
(function(){try{
if(!("IntersectionObserver" in window))return;
if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
var run=function(){try{
var els=document.querySelectorAll('section,article,.card,[class*="card"],.feature,.pricing,.step,footer');
var vh=window.innerHeight||800;
var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.classList.add("nit-vis");io.unobserve(e.target);}});},{threshold:.12,rootMargin:"0px 0px -8% 0px"});
els.forEach(function(el){try{var r=el.getBoundingClientRect();if(r.top<vh*0.85)return;el.classList.add("nit-reveal");io.observe(el);}catch(_){}});
setTimeout(function(){try{var n=document.querySelectorAll(".nit-reveal");for(var i=0;i<n.length;i++)n[i].classList.add("nit-vis");}catch(_){}},2500);
}catch(_){}};
if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);
}catch(_){}})();
</script>`;

/**
 * Внедряет премиум-базу. Идемпотентно (повторный вызов — no-op). Шрифт Inter
 * подключаем только если страница ещё не тянет Google Fonts (иначе уважаем
 * выбор модели). :where(body) с Inter всё равно не перебьёт явный font-family.
 */
export function applyPremiumBaseLayer(html: string): string {
  if (html.includes('id="nit-premium-base"')) return html;
  const hasGoogleFonts = /fonts\.googleapis\.com/i.test(html);
  const headInject = `${hasGoogleFonts ? "" : INTER_FONT_LINK}${PREMIUM_BASE_STYLE}`;
  let out = html.includes("</head>")
    ? html.replace("</head>", `${headInject}\n</head>`)
    : `${headInject}\n${html}`;
  // Reveal-скрипт — в конец body (graceful, не блокирует рендер).
  out = out.includes("</body>")
    ? out.replace("</body>", `${REVEAL_SCRIPT}\n</body>`)
    : `${out}\n${REVEAL_SCRIPT}`;
  return out;
}

// ─── Вау-слой (фирменный характер для нейтральной ветки generic/clean-saas) ───
//
// Нейтральные пресеты намеренно монохромны, и слабая модель рисует пресный ч/б.
// Этот слой добавляет фирменный характер по СТАБИЛЬНЫМ якорям, которые движок
// ставит единообразно: data-nit-section (скелет), h1, eyebrow'ы (.text-accent),
// скругления карточек, капсулы иконок. Применять ТОЛЬКО для нейтральной ветки —
// тематические пресеты (dark-luxe/neon/bold-pop) имеют свой характер и вызваны
// юзером явно. Идемпотентно. Перекраски токенов (#0a0a0a/bg-primary) самогасятся,
// если промпт уже заставил модель задать акцентный primary нативно.

const WOW_LAYER_STYLE = `<style id="nit-wow-layer">
:root{--wow-a1:#6366f1;--wow-a2:#8b5cf6;--wow-a3:#d946ef;--wow-grad:linear-gradient(120deg,var(--wow-a1) 0%,var(--wow-a2) 52%,var(--wow-a3) 100%)}
[data-nit-section="hero"]{background:radial-gradient(58% 52% at 12% -8%,rgba(99,102,241,.20),transparent 60%),radial-gradient(50% 46% at 104% 0%,rgba(217,70,239,.16),transparent 58%),radial-gradient(60% 60% at 50% 120%,rgba(139,92,246,.12),transparent 60%),#fbfbff !important}
[data-nit-section="hero"] h1{background:linear-gradient(118deg,#0b1020 0%,#4338ca 48%,#7c3aed 78%,#c026d3 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
p.text-accent{color:var(--wow-a1) !important}
p.text-accent::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--wow-grad);margin-right:9px;vertical-align:middle;transform:translateY(-1px)}
a.group:hover .text-accent,a:hover .text-accent{color:rgba(255,255,255,.92) !important}
.text-primary{color:var(--wow-a1) !important}
[class~="bg-black/5"]{background:var(--wow-grad) !important;color:#fff !important;box-shadow:0 10px 24px -8px rgba(99,102,241,.6) !important}
[class~="bg-[#0a0a0a]"],[class~="bg-primary"]{background:var(--wow-grad) !important;border:none !important;color:#fff !important;box-shadow:0 14px 30px -10px rgba(99,102,241,.55) !important}
[class~="bg-[#0a0a0a]"]:hover,[class~="bg-primary"]:hover{transform:translateY(-2px);box-shadow:0 20px 40px -10px rgba(124,58,237,.6) !important}
.border-slate-200{border-color:rgba(99,102,241,.35) !important}
.rounded-3xl{box-shadow:0 24px 60px -22px rgba(79,70,229,.40) !important;transition:transform .2s ease,box-shadow .25s ease}
.rounded-3xl:hover{transform:translateY(-4px);box-shadow:0 34px 80px -22px rgba(124,58,237,.5) !important}
.bg-muted{background:linear-gradient(180deg,#f6f5ff 0%,#fdfcff 100%) !important}
[data-nit-section="programs"] .grid > *:nth-child(2){outline:2px solid rgba(124,58,237,.55);outline-offset:-2px;border-radius:24px;transform:translateY(-8px);box-shadow:0 40px 90px -30px rgba(124,58,237,.55) !important}
::selection{background:rgba(124,58,237,.22)}
</style>`;

/**
 * Накладывает вау-слой. Идемпотентно (повторный вызов — no-op). Вызывать ТОЛЬКО
 * для нейтральных пресетов — решает caller (finalizeTunnelHtml).
 */
export function applyWowLayer(html: string): string {
  if (html.includes('id="nit-wow-layer"')) return html;
  return html.includes("</head>")
    ? html.replace("</head>", `${WOW_LAYER_STYLE}\n</head>`)
    : `${WOW_LAYER_STYLE}\n${html}`;
}
