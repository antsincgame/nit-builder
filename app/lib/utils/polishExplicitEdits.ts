// Deterministic post-polish pass: brand/headline/SEO edits the LLM often misses.
import { parseExplicitPolishEdits } from "~/lib/utils/polishRequestParse";

export type PolishEditResult = {
  html: string;
  applied: string[];
  missed: string[];
};

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detectBrandCandidates(html: string): string[] {
  const out: string[] = [];
  const push = (v: string | undefined) => {
    const t = v?.trim();
    if (t && t.length >= 2 && !out.includes(t)) out.push(t);
  };

  push(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]);
  push(
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1],
  );
  push(
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1],
  );

  const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/i)?.[1];
  if (header) {
    const logo =
      header.match(/<a[^>]*class=["'][^"']*logo[^"']*["'][^>]*>([^<]{2,80})</i)?.[1] ??
      header.match(/<a[^>]*>([^<]{2,60})<\/a>/i)?.[1];
    push(logo);
  }

  return out;
}

function replaceAllLiteral(html: string, from: string, to: string): string {
  if (!from || from === to) return html;
  return html.split(from).join(to);
}

function replaceCaseInsensitive(html: string, from: string, to: string): string {
  if (!from || from === to) return html;
  const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return html.replace(re, to);
}

function applyBrandName(html: string, brandName: string): { html: string; changed: boolean } {
  let out = html;
  let changed = false;
  const candidates = detectBrandCandidates(out);

  for (const old of candidates) {
    if (old.toLowerCase() === brandName.toLowerCase()) continue;
    const next = replaceCaseInsensitive(out, old, brandName);
    if (next !== out) {
      out = next;
      changed = true;
    }
  }

  if (!out.includes(brandName)) {
    out = out.replace(/<title[^>]*>[^<]*<\/title>/i, `<title>${escAttr(brandName)}</title>`);
    changed = true;
  }

  return { html: out, changed };
}

function applyHeadline(html: string, headline: string): { html: string; changed: boolean } {
  const h1Re = /<h1(\b[^>]*)>([\s\S]*?)<\/h1>/i;
  const m = html.match(h1Re);
  if (!m) return { html, changed: false };

  const inner = m[2]!.replace(/<[^>]+>/g, "").trim();
  if (inner.toLowerCase() === headline.toLowerCase()) return { html, changed: false };

  const next = html.replace(h1Re, `<h1$1>${headline}</h1>`);
  return { html: next, changed: next !== html };
}

function headSlice(html: string): string {
  const m = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1]! : html;
}

function updateMetaContent(
  html: string,
  attr: "name" | "property",
  key: string,
  value: string,
): string {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const escaped = escAttr(value);
  if (re.test(html)) {
    return html.replace(re, (m) =>
      m.replace(/content=["'][^"']*["']/i, `content="${escaped}"`),
    );
  }
  if (re2.test(html)) {
    return html.replace(re2, (m) =>
      m.replace(/content=["'][^"']*["']/i, `content="${escaped}"`),
    );
  }
  return html;
}

function applySeoBoost(
  html: string,
  brandName?: string,
  headline?: string,
  forceRefresh = false,
): { html: string; added: string[] } {
  const added: string[] = [];
  const scope = headSlice(html);
  const title =
    headline ??
    html.match(/<h1[^>]*>([^<]+)</i)?.[1]?.trim() ??
    brandName ??
    "Сайт";
  const descSource =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<p[^>]*>([^<]{20,200})</i)?.[1] ??
    `${title}. Узнайте подробности и свяжитесь с нами.`;
  const desc = descSource.replace(/\s+/g, " ").trim().slice(0, 160);

  let out = html;

  const hasDesc = /<meta\s+name=["']description["']/i.test(scope);
  if (!hasDesc) {
    const tags = [`<meta name="description" content="${escAttr(desc)}">`];
    const block = tags.join("\n");
    out = out.includes("</head>") ? out.replace("</head>", `${block}\n</head>`) : `${block}\n${out}`;
    added.push("meta description");
  } else if (forceRefresh) {
    out = updateMetaContent(out, "name", "description", desc);
    added.push("meta description обновлён");
  }

  const hasOg = /property=["']og:title["']/i.test(scope);
  if (!hasOg) {
    const tags = [
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${escAttr(title)}">`,
      `<meta property="og:description" content="${escAttr(desc)}">`,
    ];
    const block = tags.join("\n");
    out = out.includes("</head>") ? out.replace("</head>", `${block}\n</head>`) : `${block}\n${out}`;
    added.push("Open Graph");
  } else if (forceRefresh) {
    out = updateMetaContent(out, "property", "og:title", title);
    out = updateMetaContent(out, "property", "og:description", desc);
    added.push("Open Graph обновлён");
  }

  const hasTwitter = /name=["']twitter:card["']/i.test(scope);
  if (!hasTwitter) {
    const tags = [
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escAttr(title)}">`,
      `<meta name="twitter:description" content="${escAttr(desc)}">`,
    ];
    const block = tags.join("\n");
    out = out.includes("</head>") ? out.replace("</head>", `${block}\n</head>`) : `${block}\n${out}`;
    added.push("Twitter Card");
  } else if (forceRefresh) {
    out = updateMetaContent(out, "name", "twitter:title", title);
    out = updateMetaContent(out, "name", "twitter:description", desc);
    added.push("Twitter Card обновлён");
  }

  const tags: string[] = [];
  if (!/application\/ld\+json/i.test(scope)) {
    const orgName = brandName ?? title;
    const json = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: orgName,
      description: desc,
    });
    tags.push(`<script type="application/ld+json">${json.replace(/</g, "\\u003c")}</script>`);
    added.push("JSON-LD");
  }

  if (tags.length > 0) {
    const block = tags.join("\n");
    out = out.includes("</head>") ? out.replace("</head>", `${block}\n</head>`) : `${block}\n${out}`;
  }

  if (!/data-nit-section=["']faq["']/i.test(out) && !/<section[^>]*id=["']faq["']/i.test(out)) {
    const faq = `
<section data-nit-section="faq" class="py-16 px-6 bg-slate-50">
  <div class="max-w-3xl mx-auto">
    <h2 class="text-3xl font-bold mb-8">Частые вопросы</h2>
    <div class="space-y-4">
      <details class="rounded-xl border border-slate-200 bg-white p-4"><summary class="font-semibold cursor-pointer">Как записаться?</summary><p class="mt-2 text-slate-600">Напишите в чат или позвоните — подберём удобное время.</p></details>
      <details class="rounded-xl border border-slate-200 bg-white p-4"><summary class="font-semibold cursor-pointer">Сколько длится процедура?</summary><p class="mt-2 text-slate-600">Обычно 1–2 часа в зависимости от выбранной услуги.</p></details>
      <details class="rounded-xl border border-slate-200 bg-white p-4"><summary class="font-semibold cursor-pointer">Где вы находитесь?</summary><p class="mt-2 text-slate-600">Адрес и карта — в блоке контактов ниже.</p></details>
    </div>
  </div>
</section>`;
    if (out.includes("</body>")) {
      out = out.replace(/<\/body>/i, `${faq}\n</body>`);
      added.push("блок FAQ");
    }
  }

  return { html: out, added };
}

/** Детерминированно дополняет вывод полировщика явными правками из запроса. */
export function applyExplicitPolishEdits(html: string, userRequest: string): PolishEditResult {
  const edits = parseExplicitPolishEdits(userRequest);
  const applied: string[] = [];
  const missed: string[] = [];
  let out = html;

  if (edits.brandName) {
    const { html: branded, changed } = applyBrandName(out, edits.brandName);
    out = branded;
    if (changed && out.toLowerCase().includes(edits.brandName.toLowerCase())) {
      applied.push(`название → «${edits.brandName}»`);
    } else {
      missed.push(`название «${edits.brandName}»`);
    }
  }

  if (edits.headline) {
    const { html: headed, changed } = applyHeadline(out, edits.headline);
    out = headed;
    if (changed) {
      applied.push(`заголовок → «${edits.headline}»`);
    } else {
      missed.push(`заголовок «${edits.headline}»`);
    }
  }

  if (edits.wantsSeo) {
    const forceRefresh = Boolean(edits.brandName || edits.headline);
    const { html: seoed, added } = applySeoBoost(out, edits.brandName, edits.headline, forceRefresh);
    out = seoed;
    if (added.length > 0) {
      applied.push(`SEO: ${added.join(", ")}`);
    } else {
      applied.push("SEO: теги уже были на месте");
    }
  }

  const nicheHint =
    /маникюр|ногт|nail|lashes|ресниц|lash/i.test(userRequest) ||
    /маникюр|ногт|nail|lashes|ресниц|lash/i.test(html);
  if ((edits.headline || edits.brandName) && nicheHint) {
    const nicheFixes: Array<[RegExp, string]> = [
      [/ресниц[а-яё]*/giu, "ногт"],
      [/lashes/gi, "nails"],
      [/lash/gi, "nail"],
    ];
    for (const [re, rep] of nicheFixes) {
      const hero = out.match(/<(?:header|section)[^>]*(?:hero|data-nit-section=["']hero["'])[^>]*>[\s\S]*?<\/(?:header|section)>/i)?.[0];
      if (hero && re.test(hero)) {
        out = replaceAllLiteral(out, hero, hero.replace(re, rep));
      }
    }
  }

  return { html: out, applied, missed };
}
