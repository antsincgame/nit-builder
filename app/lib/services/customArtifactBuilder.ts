import type { Plan } from "~/lib/utils/planSchema";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "artifact";
}

function hasTechMood(plan: Plan, userMessage: string): boolean {
  const text = `${userMessage} ${plan.business_type} ${plan.keywords.join(" ")}`.toLowerCase();
  return /ton|web3|crypto|крипт|saas|game|игр|studio|marketplace|protocol|app|developer|steam|wishlist/.test(text);
}

function pick(items: string[], fallback: string): string[] {
  return items.length > 0 ? items : [fallback];
}

function benefitItems(plan: Plan): Array<{ title: string; description: string }> {
  return plan.key_benefits?.length
    ? plan.key_benefits
    : [
        { title: "Signal first", description: "A clear first screen explains the offer in under 7 seconds." },
        { title: "Conversion path", description: "Every section leads toward one primary action without visual noise." },
        { title: "Proof built in", description: "Numbers, process and trust blocks are visible before the final CTA." },
      ];
}

function cleanTitle(text: string, fallback: string): string {
  const cleaned = text
    .replace(/\b(сделай|нужен|нужна|как в примерах|не шаблон|шедевральный|single-file|html|artifact)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[.,:;–—-]+\s*$/g, "")
    .trim();
  return cleaned || fallback;
}

function isRu(plan: Plan): boolean {
  return plan.language === "ru";
}

export function buildCustomArtifactHtml(params: {
  plan: Plan;
  userMessage: string;
}): string {
  const { plan, userMessage } = params;
  const tech = hasTechMood(plan, userMessage);
  const title = cleanTitle(plan.hero_headline || plan.business_type, plan.business_type);
  const subtitle = cleanTitle(
    plan.hero_subheadline || `${plan.business_type}: ${plan.target_audience}`,
    isRu(plan)
      ? "Авторский лендинг с выразительной визуальной системой, понятной структурой и сильным первым экраном."
      : "A bespoke landing page with a strong visual system, clear structure, and a memorable first screen.",
  );
  const cta = plan.cta_primary || "Start";
  const artifactId = slug(plan.business_type);
  const keywords = pick(plan.keywords, plan.business_type);
  const benefits = benefitItems(plan);
  const tiers = plan.pricing_tiers?.length
    ? plan.pricing_tiers
    : [
        { name: "Launch", price: "from $0", period: "starter", features: ["Core access", "Public profile", "Basic support"], highlighted: false },
        { name: "Forge", price: "custom", period: "growth", features: ["Priority onboarding", "Analytics", "Custom integrations"], highlighted: true },
      ];
  const faqs = plan.faq?.length
    ? plan.faq
    : isRu(plan) ? [
        { question: "Как быстро можно запуститься?", answer: "Первую версию можно собрать быстро: смысл, CTA и визуальная система формируются в одном потоке." },
        { question: "Это шаблон?", answer: "Нет. Страница собирается как отдельный HTML-артефакт с кастомным CSS, SVG и собственной композицией." },
        { question: "Можно поменять стиль позже?", answer: "Да. Палитра, ритм и секции вынесены в CSS-переменные и независимые блоки." },
      ] : [
        { question: "How fast can we start?", answer: "The first version can be launched quickly: content, CTA and visual system are prepared in one flow." },
        { question: "Can the style change later?", answer: "Yes. The artifact uses CSS variables, so the palette, spacing and mood can be evolved without rewriting the structure." },
        { question: "Is this a template?", answer: "No. The page is generated as a single bespoke HTML artifact with custom CSS and inline visual systems." },
      ];
  const contact = [plan.contact_phone, plan.contact_email, plan.contact_address].filter(Boolean).join(" · ");
  const proof = plan.social_proof_line || "Designed as a high-signal landing artifact, not a generic template.";

  const palette = tech
    ? {
        bg: "#05060a",
        bg2: "#0a1020",
        ink: "#e8ecff",
        muted: "#8590bd",
        primary: "#33c7ff",
        accent: "#ff2e93",
        acid: "#d4ff00",
      }
    : {
        bg: "#f2ebde",
        bg2: "#e7dcc8",
        ink: "#111111",
        muted: "#5e574f",
        primary: "#1d3fd8",
        accent: "#ff4d1c",
        acid: "#d4ff00",
      };

  const panels = [
    ...benefits.map((b, i) => ({ k: `0${i + 1}`, title: b.title, body: b.description })),
    ...keywords.slice(0, 6).map((k, i) => ({ k: `K${i + 1}`, title: k, body: `A dedicated narrative block for ${k}, connected to the main conversion path.` })),
  ].slice(0, 12);
  while (panels.length < 12) {
    panels.push({
      k: `P${panels.length + 1}`,
      title: ["Trust", "Flow", "Signal", "Proof"][panels.length % 4] ?? "Proof",
      body: isRu(plan)
        ? "Плотный информационный блок добавляет ритм, доверие и ощущение ручной сборки."
        : "A compact panel adds density, rhythm and product-grade information architecture.",
    });
  }

  const labels = isRu(plan)
    ? {
        live: "живой артефакт",
        mode: "режим",
        single: "один файл",
        panels: "панелей",
        rhythm: "ритм запуска",
        explore: "Смотреть систему",
        why: "Зачем эта страница",
        whyText: "Первый экран должен быстро объяснить смысл, создать ощущение бренда и привести к действию.",
        features: "Не блоки, а визуальная система",
        featuresText: "Карточки, ритм, доказательства и CTA собраны как цельный лендинг, а не набор секций.",
        proof: "Доверие и рабочий ритм",
        path: "Путь от первого взгляда к заявке",
        pathText: "Страница ведёт пользователя через смысл, детали, доказательства и финальный CTA.",
        offer: "Коммерческая архитектура",
        offerText: "Тарифы или пакеты делают страницу похожей на настоящий продукт, а не на презентацию.",
        questions: "Вопросы перед заявкой",
        questionsText: "Короткие ответы снимают сомнения и не уводят пользователя со страницы.",
        back: "Наверх",
      }
    : {
        live: "live artifact",
        mode: "mode",
        single: "single file",
        panels: "signal panels",
        rhythm: "launch rhythm",
        explore: "Explore system",
        why: "Why this page exists",
        whyText: "The first screen must explain the idea, create brand feeling, and lead to action.",
        features: "System features, not filler blocks",
        featuresText: "Cards, rhythm, proof and CTA are composed as one landing system.",
        proof: "Proof and operating rhythm",
        path: "Path from first look to action",
        pathText: "The page guides the visitor through signal, details, proof and the final CTA.",
        offer: "Offer architecture",
        offerText: "Real packages make the page feel like a product, not a presentation.",
        questions: "Questions before conversion",
        questionsText: "Short answers remove friction without pushing the user away from the page.",
        back: "Back to top",
      };

  return `<!DOCTYPE html>
<html lang="${esc(plan.language || "en")}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — ${esc(plan.business_type)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=JetBrains+Mono:wght@300;400;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:${palette.bg};
  --bg-2:${palette.bg2};
  --ink:${palette.ink};
  --muted:${palette.muted};
  --primary:${palette.primary};
  --accent:${palette.accent};
  --acid:${palette.acid};
  --line:color-mix(in srgb,var(--primary) 24%,transparent);
  --line-soft:color-mix(in srgb,var(--primary) 10%,transparent);
  --shadow:0 40px 120px color-mix(in srgb,var(--primary) 18%,transparent);
  --display:"Unbounded",system-ui,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;background:var(--bg)}
body{min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--mono);overflow-x:hidden;font-size:14px;line-height:1.55}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.12;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");mix-blend-mode:overlay}
body::after{content:"";position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.05;background:repeating-linear-gradient(0deg,transparent 0,transparent 2px,var(--primary) 3px,transparent 4px)}
a{color:inherit;text-decoration:none}
.grid-bg{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(var(--line-soft) 1px,transparent 1px),linear-gradient(90deg,var(--line-soft) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse 80% 70% at 50% 30%,#000 35%,transparent 86%)}
.orb{position:fixed;border-radius:50%;filter:blur(110px);z-index:0;pointer-events:none}
.orb.one{width:620px;height:620px;left:-180px;top:-160px;background:var(--primary);opacity:.28;animation:floatA 20s ease-in-out infinite}
.orb.two{width:540px;height:540px;right:-180px;top:28%;background:var(--accent);opacity:.22;animation:floatB 26s ease-in-out infinite}
.orb.three{width:360px;height:360px;left:40%;bottom:-140px;background:var(--acid);opacity:.12;animation:floatC 24s ease-in-out infinite}
@keyframes floatA{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(70px,50px,0) scale(1.12)}}
@keyframes floatB{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-50px,-80px,0) scale(1.06)}}
@keyframes floatC{0%,100%{transform:translate3d(0,0,0) rotate(0)}50%{transform:translate3d(30px,-60px,0) rotate(20deg)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.78)}}
@keyframes marquee{to{transform:translateX(-50%)}}
@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glitchOne{0%,88%,100%{transform:none}90%{transform:translate(-3px,2px)}92%{transform:translate(4px,-2px)}94%{transform:translate(-2px,-1px)}}
@keyframes glitchTwo{0%,88%,100%{transform:none}90%{transform:translate(3px,-2px)}92%{transform:translate(-4px,2px)}94%{transform:translate(2px,1px)}}
.hud{position:fixed;top:0;left:0;right:0;z-index:20;display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:center;padding:14px 28px;background:color-mix(in srgb,var(--bg) 74%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.brand{font-family:var(--display);font-weight:900;letter-spacing:-.04em;display:flex;gap:10px;align-items:center}
.brand-mark{width:28px;height:28px;border:1px solid var(--primary);position:relative;transform:rotate(45deg);box-shadow:0 0 25px color-mix(in srgb,var(--primary) 40%,transparent)}
.brand-mark::after{content:"";position:absolute;inset:5px;background:var(--primary);box-shadow:0 0 20px var(--primary)}
.hud-mid{display:flex;gap:22px;justify-content:center;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.14em}
.hud-mid b{color:var(--primary);font-weight:700}
.live{display:inline-flex;align-items:center;gap:8px}
.live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--acid);box-shadow:0 0 14px var(--acid);animation:pulse 1.6s infinite}
.hud a.cta{padding:10px 16px;border:1px solid var(--primary);color:var(--primary);font-size:11px;text-transform:uppercase;letter-spacing:.12em;transition:.25s}
.hud a.cta:hover{background:var(--primary);color:var(--bg);box-shadow:0 0 40px color-mix(in srgb,var(--primary) 40%,transparent)}
.wrap{position:relative;z-index:2}
.hero{min-height:100vh;padding:120px 32px 80px;display:grid;grid-template-columns:1.16fr .84fr;gap:48px;align-items:center;max-width:1500px;margin:0 auto;background:radial-gradient(ellipse at 20% 20%,color-mix(in srgb,var(--primary) 16%,transparent),transparent 42%),radial-gradient(ellipse at 80% 70%,color-mix(in srgb,var(--accent) 14%,transparent),transparent 45%)}
.hero-kicker{display:inline-flex;gap:10px;align-items:center;border:1px solid var(--line);padding:8px 14px;color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,transparent);font-size:10px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:28px}
.hero-kicker i{width:7px;height:7px;border-radius:50%;background:var(--acid);box-shadow:0 0 14px var(--acid)}
.hero h1{font-family:var(--display);font-size:clamp(42px,7.6vw,118px);line-height:.9;letter-spacing:-.065em;margin-bottom:28px;text-transform:uppercase;max-width:980px}
.hero h1 span{display:block;position:relative}
.hero h1 .outline{color:transparent;-webkit-text-stroke:2px var(--primary)}
.hero h1 .outline::before,.hero h1 .outline::after{content:attr(data-text);position:absolute;left:0;top:0;-webkit-text-stroke:2px var(--accent);clip-path:inset(0 0 56% 0)}
.hero h1 .outline::before{animation:glitchOne 4s infinite}
.hero h1 .outline::after{clip-path:inset(56% 0 0 0);-webkit-text-stroke-color:var(--acid);animation:glitchTwo 4s infinite}
.lead{font-size:17px;color:var(--muted);max-width:640px;margin-bottom:34px}
.lead b{color:var(--ink);font-weight:400;border-bottom:1px dashed var(--primary)}
.cta-row{display:flex;flex-wrap:wrap;gap:14px;margin:34px 0 42px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:17px 28px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;border:1px solid var(--line);transition:.25s;position:relative;overflow:hidden}
.btn-primary{background:var(--primary);border-color:var(--primary);color:var(--bg);box-shadow:0 0 60px color-mix(in srgb,var(--primary) 35%,transparent)}
.btn-primary:hover{transform:translate(-3px,-3px);box-shadow:8px 8px 0 var(--accent),0 0 70px color-mix(in srgb,var(--primary) 45%,transparent)}
.btn-ghost{color:var(--ink);background:color-mix(in srgb,var(--bg-2) 72%,transparent)}
.btn-ghost:hover{border-color:var(--accent);color:var(--accent)}
.hero-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--line);max-width:720px;background:color-mix(in srgb,var(--bg-2) 72%,transparent)}
.hero-stats .stat{padding:18px 20px;border-right:1px solid var(--line)}
.hero-stats .stat:last-child{border-right:none}
.stat .n{font-family:var(--display);font-size:28px;color:var(--primary)}
.stat .l{font-size:10px;color:var(--muted);letter-spacing:.14em;text-transform:uppercase}
.visual{position:relative;min-height:560px;display:flex;align-items:center;justify-content:center;perspective:1200px}
.device{width:min(460px,100%);min-height:560px;border:1px solid var(--line);background:linear-gradient(135deg,color-mix(in srgb,var(--bg-2) 90%,transparent),color-mix(in srgb,var(--accent) 18%,transparent));box-shadow:var(--shadow);position:relative;overflow:hidden;transform:rotateY(-8deg) rotateX(4deg);animation:tilt 9s ease-in-out infinite}
@keyframes tilt{0%,100%{transform:rotateY(-8deg) rotateX(4deg)}50%{transform:rotateY(8deg) rotateX(-3deg)}}
.device::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,color-mix(in srgb,var(--primary) 34%,transparent),transparent 38%),radial-gradient(circle at 78% 88%,color-mix(in srgb,var(--accent) 25%,transparent),transparent 42%)}
.device::after{content:"";position:absolute;left:0;right:0;height:120px;top:-120px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--primary) 18%,transparent),transparent);animation:scan 5s linear infinite}
.device-top{position:relative;z-index:1;padding:16px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;color:var(--muted);font-size:10px;letter-spacing:.12em}
.scene{position:relative;z-index:1;padding:28px}
.scene svg{width:100%;height:auto;filter:drop-shadow(0 0 24px color-mix(in srgb,var(--primary) 40%,transparent))}
.scene-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:24px}
.mini{border:1px solid var(--line);padding:14px;background:color-mix(in srgb,var(--bg) 44%,transparent)}
.mini .k{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.15em}
.mini .v{font-family:var(--display);font-size:20px;color:var(--primary);margin-top:6px}
.orbit{position:absolute;width:120%;height:120%;border:1px dashed var(--line);border-radius:50%;animation:spin 38s linear infinite;pointer-events:none}
.marquee{position:relative;z-index:2;overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--primary) 16%,var(--bg));padding:22px 0}
.marquee-track{display:inline-block;white-space:nowrap;animation:marquee 32s linear infinite;font-family:var(--display);font-size:40px;text-transform:uppercase;color:var(--ink)}
.marquee-track span{margin:0 22px}
.marquee-track .alt{color:transparent;-webkit-text-stroke:1px var(--ink)}
section{position:relative;z-index:2;max-width:1500px;margin:0 auto;padding:110px 32px}
.section-head{display:grid;grid-template-columns:180px 1fr;gap:42px;align-items:end;margin-bottom:54px;border-bottom:1px solid var(--line);padding-bottom:30px}
.num{font-family:var(--display);font-size:80px;color:var(--accent);line-height:.8}
.section-head h2{font-family:var(--display);font-size:clamp(34px,5vw,72px);line-height:.95;letter-spacing:-.04em}
.section-head p{color:var(--muted);max-width:720px;margin-top:16px}
.panel-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:18px}
.panel{border:1px solid var(--line);background:color-mix(in srgb,var(--bg-2) 72%,transparent);padding:26px;position:relative;min-height:210px;overflow:hidden;transition:.25s}
.panel:hover{transform:translateY(-4px);border-color:var(--primary);box-shadow:0 20px 70px color-mix(in srgb,var(--primary) 14%,transparent)}
.panel::before{content:"";position:absolute;inset:auto -30% -45% -30%;height:130px;background:radial-gradient(ellipse,var(--primary),transparent 62%);opacity:.12}
.panel.wide{grid-column:span 6}
.panel.third{grid-column:span 4}
.panel.full{grid-column:span 12}
.panel .tag{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:var(--primary);margin-bottom:24px}
.panel h3{font-family:var(--display);font-size:24px;line-height:1.05;margin-bottom:14px}
.panel p{color:var(--muted)}
.metric-row{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.metric{border:1px solid var(--line);padding:28px;background:color-mix(in srgb,var(--bg-2) 76%,transparent)}
.metric b{font-family:var(--display);font-size:42px;color:var(--primary);display:block}
.metric span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em}
.timeline{display:grid;gap:14px}
.step{display:grid;grid-template-columns:120px 1fr;gap:20px;border:1px solid var(--line);background:color-mix(in srgb,var(--bg-2) 70%,transparent);padding:20px}
.step .time{color:var(--acid);font-weight:700}
.price-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.price{border:1px solid var(--line);padding:28px;background:color-mix(in srgb,var(--bg-2) 70%,transparent)}
.price.hot{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent),0 30px 90px color-mix(in srgb,var(--accent) 14%,transparent)}
.price h3{font-family:var(--display);font-size:28px;margin-bottom:8px}
.price .amount{font-family:var(--display);font-size:42px;color:var(--primary);margin-bottom:18px}
.price ul{list-style:none;display:grid;gap:10px;color:var(--muted)}
.price li::before{content:"//";color:var(--acid);margin-right:8px}
.faq{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.faq-item{border:1px solid var(--line);padding:24px;background:color-mix(in srgb,var(--bg-2) 68%,transparent)}
.faq-item h3{font-size:16px;margin-bottom:12px;color:var(--primary)}
.final{padding:110px 32px 140px;text-align:center;background:radial-gradient(ellipse at center,color-mix(in srgb,var(--primary) 14%,transparent),transparent 64%)}
.final h2{font-family:var(--display);font-size:clamp(42px,7vw,110px);line-height:.9;letter-spacing:-.06em;margin-bottom:28px}
.contact-line{margin-top:26px;color:var(--muted)}
footer{position:relative;z-index:2;border-top:1px solid var(--line);padding:30px 32px;color:var(--muted);display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
@media (max-width:900px){
  .hud{grid-template-columns:1fr auto}.hud-mid{display:none}.hero{grid-template-columns:1fr;padding-top:100px}.visual{min-height:420px}.device{min-height:420px;transform:none}.section-head{grid-template-columns:1fr}.panel.wide,.panel.third,.panel.full{grid-column:span 12}.metric-row,.price-grid,.faq{grid-template-columns:1fr}.hero-stats{grid-template-columns:1fr}.hero-stats .stat{border-right:none;border-bottom:1px solid var(--line)}.step{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div class="grid-bg"></div>
<div class="orb one"></div><div class="orb two"></div><div class="orb three"></div>
<nav class="hud">
  <a class="brand" href="#hero"><span class="brand-mark"></span>${esc(plan.business_type)}</a>
  <div class="hud-mid"><span class="live">${labels.live}</span><span>${labels.mode} <b>${tech ? "cyber" : "editorial"}</b></span><span>id <b>${artifactId}</b></span></div>
  <a class="cta" href="#contact">${esc(cta)}</a>
</nav>
<main class="wrap">
<section class="hero" id="hero" data-nit-section="hero">
  <div>
    <div class="hero-kicker"><i></i>${esc(keywords.slice(0, 3).join(" / "))}</div>
    <h1><span>${esc(title.split(" ").slice(0, 3).join(" "))}</span><span class="outline" data-text="${esc(title.split(" ").slice(3).join(" ") || plan.business_type)}">${esc(title.split(" ").slice(3).join(" ") || plan.business_type)}</span></h1>
    <p class="lead">${esc(subtitle)} <b>${esc(proof)}</b></p>
    <div class="cta-row"><a class="btn btn-primary" href="#contact">${esc(cta)}</a><a class="btn btn-ghost" href="#features">Explore system</a></div>
    <div class="hero-stats">
      <div class="stat"><div class="n">01</div><div class="l">${labels.single}</div></div>
      <div class="stat"><div class="n">${esc(String(panels.length))}</div><div class="l">${labels.panels}</div></div>
      <div class="stat"><div class="n">24h</div><div class="l">${labels.rhythm}</div></div>
    </div>
  </div>
  <div class="visual" aria-hidden="true">
    <div class="orbit"></div>
    <div class="device">
      <div class="device-top"><span>// ${esc(artifactId)}</span><span>ON-LINE</span></div>
      <div class="scene">
        <svg viewBox="0 0 520 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="custom visual system">
          <defs>
            <linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${palette.primary}"/><stop offset=".55" stop-color="${palette.accent}"/><stop offset="1" stop-color="${palette.acid}"/></linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <rect x="24" y="24" width="472" height="312" rx="26" fill="none" stroke="url(#g)" stroke-width="2"/>
          <circle cx="260" cy="180" r="92" fill="url(#g)" opacity=".22" filter="url(#glow)"/>
          <path d="M120 230 C180 70 340 70 400 230" fill="none" stroke="${palette.primary}" stroke-width="3" filter="url(#glow)"/>
          <path d="M120 130 C210 250 310 250 400 130" fill="none" stroke="${palette.accent}" stroke-width="3" filter="url(#glow)"/>
          ${keywords.slice(0, 6).map((k, i) => {
            const x = 90 + (i % 3) * 170;
            const y = 74 + Math.floor(i / 3) * 210;
            return `<g><rect x="${x}" y="${y}" width="120" height="44" rx="12" fill="${palette.bg2}" stroke="${palette.primary}" opacity=".88"/><text x="${x + 60}" y="${y + 28}" text-anchor="middle" fill="${palette.ink}" font-size="11" font-family="monospace">${esc(k.slice(0, 16))}</text></g>`;
          }).join("")}
        </svg>
        <div class="scene-grid">
          <div class="mini"><div class="k">conversion</div><div class="v">${esc(cta.split(" ")[0] ?? "CTA")}</div></div>
          <div class="mini"><div class="k">proof</div><div class="v">verified</div></div>
        </div>
      </div>
    </div>
  </div>
</section>
<div class="marquee"><div class="marquee-track">${[...keywords, ...keywords].map((k, i) => `<span class="${i % 2 ? "alt" : ""}">${esc(k)}</span>`).join("")}</div></div>
<section id="problem" data-nit-section="problem">
  <div class="section-head"><div class="num">01</div><div><h2>${labels.why}</h2><p>${esc(plan.target_audience || labels.whyText)}</p></div></div>
  <div class="panel-grid">
    ${panels.slice(0, 4).map((p, i) => `<article class="panel ${i < 2 ? "wide" : "third"}"><div class="tag">${esc(p.k)}</div><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></article>`).join("")}
  </div>
</section>
<section id="features" data-nit-section="features">
  <div class="section-head"><div class="num">02</div><div><h2>${labels.features}</h2><p>${labels.featuresText}</p></div></div>
  <div class="panel-grid">
    ${panels.slice(4, 12).map((p, i) => `<article class="panel third"><div class="tag">feature ${i + 1}</div><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></article>`).join("")}
  </div>
</section>
<section id="proof" data-nit-section="proof">
  <div class="section-head"><div class="num">03</div><div><h2>${labels.proof}</h2><p>${esc(proof)}</p></div></div>
  <div class="metric-row">
    <div class="metric"><b>4.9</b><span>trust score</span></div>
    <div class="metric"><b>12+</b><span>content modules</span></div>
    <div class="metric"><b>6</b><span>sections</span></div>
    <div class="metric"><b>1</b><span>primary CTA</span></div>
  </div>
</section>
<section id="roadmap" data-nit-section="roadmap">
  <div class="section-head"><div class="num">04</div><div><h2>${labels.path}</h2><p>${labels.pathText}</p></div></div>
  <div class="timeline">
    <div class="step"><div class="time">00:00</div><div><b>Hero lock-in.</b> The visitor understands the category and action immediately.</div></div>
    <div class="step"><div class="time">00:07</div><div><b>Feature density.</b> Panels provide enough specificity to avoid generic AI-site feel.</div></div>
    <div class="step"><div class="time">00:21</div><div><b>Trust check.</b> Proof, counters and process reduce hesitation.</div></div>
    <div class="step"><div class="time">00:45</div><div><b>CTA repeat.</b> The final block makes the next step obvious.</div></div>
  </div>
</section>
<section id="pricing" data-nit-section="pricing">
  <div class="section-head"><div class="num">05</div><div><h2>${labels.offer}</h2><p>${labels.offerText}</p></div></div>
  <div class="price-grid">
    ${tiers.map((t) => `<article class="price ${t.highlighted ? "hot" : ""}"><h3>${esc(t.name)}</h3><div class="amount">${esc(t.price)}</div><ul>${t.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></article>`).join("")}
  </div>
</section>
<section id="faq" data-nit-section="faq">
  <div class="section-head"><div class="num">06</div><div><h2>${labels.questions}</h2><p>${labels.questionsText}</p></div></div>
  <div class="faq">
    ${faqs.slice(0, 6).map((f) => `<article class="faq-item"><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></article>`).join("")}
  </div>
</section>
<section class="final" id="contact" data-nit-section="contact">
  <h2>${esc(cta)}</h2>
  <p class="lead" style="margin-inline:auto">${esc(plan.cta_microcopy || "No pressure. One clear next step.")}</p>
  <div class="cta-row" style="justify-content:center"><a class="btn btn-primary" href="mailto:${esc(plan.contact_email || "hello@example.com")}">${esc(cta)}</a><a class="btn btn-ghost" href="#hero">${labels.back}</a></div>
  <div class="contact-line">${esc(contact || "hello@example.com · Telegram · demo call")}</div>
</section>
</main>
<footer><span>${esc(plan.business_type)}</span><span>single-file artifact · generated locally</span></footer>
</body>
</html>`;
}
