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
  return /glitch|scanline|#ff2e93|#d4ff00|acid|cyber|hud|JetBrains Mono/i.test(html);
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
