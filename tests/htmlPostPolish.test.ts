// Verifies deterministic post-polish fixes common generated HTML failures.
import { describe, expect, it } from "vitest";
import {
  applySeoHead,
  applyWowLayer,
  ensureClosedHtml,
  fixBrokenImages,
  postPolishHtml,
} from "~/lib/services/htmlPostPolish";
import type { Plan } from "~/lib/utils/planSchema";

const PLAN: Plan = {
  business_type: "AI студия",
  target_audience: "предприниматели",
  tone: "премиум",
  style_hints: "warm premium",
  color_mood: "warm-pastel",
  sections: ["hero", "features", "contact"],
  keywords: ["локальный AI"],
  cta_primary: "Собрать сайт",
  language: "ru",
  suggested_template_id: "saas-landing",
};

describe("postPolishHtml", () => {
  it("заменяет boilerplate copy на русский осмысленный текст", () => {
    const result = postPolishHtml({
      html: "<p>A dedicated narrative block for локальный AI, connected to the main conversion path.</p>",
      presetId: "warm-premium",
      plan: PLAN,
    });

    expect(result.fixes).toContain("boilerplate-copy");
    expect(result.html).toContain("Практический блок про локальный AI");
    expect(result.html).not.toContain("A dedicated narrative block");
  });

  it("добавляет light override если светлый preset получил neon leak", () => {
    const result = postPolishHtml({
      html: "<html><head></head><body><h1 class=\"glitch\">Title</h1><style>.x{color:#ff2e93}</style></body></html>",
      presetId: "clean-saas",
      plan: PLAN,
    });

    expect(result.fixes).toContain("light-style-override");
    expect(result.fixes).toContain("neon-token-rewrite");
    expect(result.html).toContain("nit-post-polish-style");
    expect(result.html).toContain("--nit-polish-bg:#f8fafc");
    expect(result.html).not.toContain("#ff2e93");
  });

  it("не триггерит light override на слово 'cybersecurity' в копирайте без реальных neon-токенов", () => {
    const result = postPolishHtml({
      html: "<html><head></head><body><h1>Cybersecurity для бизнеса</h1><p>Надёжная защита без лишней суеты.</p></body></html>",
      presetId: "clean-saas",
      plan: PLAN,
    });

    expect(result.fixes).not.toContain("light-style-override");
    expect(result.fixes).not.toContain("neon-token-rewrite");
    expect(result.html).not.toContain("nit-post-polish-style");
  });
});

const SEO_PLAN: Plan = {
  ...PLAN,
  business_type: "Кофейня в Гродно",
  hero_headline: "Свежая обжарка каждое утро",
  hero_subheadline: "Спешелти-кофейня в центре Гродно: своя обжарка, сезонное меню, уютный зал.",
  keywords: ["кофейня гродно", "спешелти кофе"],
  contact_phone: "+375 (29) 123-45-67",
  contact_address: "Гродно, ул. Советская 10",
  faq: [
    { question: "Есть ли веранда?", answer: "Да, открыта с мая по сентябрь." },
    { question: "Можно с ноутбуком?", answer: "Конечно, есть розетки и быстрый Wi-Fi." },
    { question: "Делаете навынос?", answer: "Да, весь ассортимент доступен навынос." },
  ],
};

describe("applySeoHead", () => {
  it("вставляет description, OpenGraph и JSON-LD из плана", () => {
    const html = "<html><head><title>Кофейня</title></head><body><h1>Привет</h1></body></html>";
    const out = applySeoHead(html, SEO_PLAN);
    expect(out).toContain('name="description"');
    expect(out).toContain('property="og:title"');
    expect(out).toContain("application/ld+json");
    expect(out).toContain('"@type":"Organization"');
  });

  it("включает FAQPage и LocalBusiness когда есть faq и адрес", () => {
    const html = "<html><head><title>X</title></head><body></body></html>";
    const out = applySeoHead(html, SEO_PLAN);
    expect(out).toContain('"@type":"FAQPage"');
    expect(out).toContain('"@type":"LocalBusiness"');
  });

  it("идемпотентен — повторный вызов не дублирует SEO-голову", () => {
    const html = "<html><head><title>X</title></head><body></body></html>";
    const once = applySeoHead(html, SEO_PLAN);
    const twice = applySeoHead(once, SEO_PLAN);
    expect(twice).toBe(once);
  });

  it("не перетирает description, который уже задан моделью", () => {
    const html =
      '<html><head><title>X</title><meta name="description" content="ручное описание"></head><body></body></html>';
    const out = applySeoHead(html, SEO_PLAN);
    expect(out).toContain("ручное описание");
    expect(out.match(/name="description"/g)?.length).toBe(1);
  });

  it("заполняет пустой alt бизнес-контекстом, не трогая непустые", () => {
    const html =
      '<html><head><title>X</title></head><body><img src="a.jpg" alt=""><img src="b.jpg" alt="готовый"></body></html>';
    const out = applySeoHead(html, SEO_PLAN);
    expect(out).toContain('alt="Кофейня в Гродно"');
    expect(out).toContain('alt="готовый"');
  });
});

describe("applyWowLayer", () => {
  it("вставляет вау-слой по маркеру", () => {
    const html = "<html><head></head><body></body></html>";
    const out = applyWowLayer(html);
    expect(out).toContain('id="nit-wow-layer"');
  });

  it("идемпотентен — повторный вызов не дублирует слой", () => {
    const html = "<html><head></head><body></body></html>";
    const once = applyWowLayer(html);
    const twice = applyWowLayer(once);
    expect(twice).toBe(once);
  });
});

describe("ensureClosedHtml", () => {
  it("отрезает оборванный хвостовой тег и закрывает документ", () => {
    const broken = '<html><head></head><body><section><div class="bg-[#1a1a24] p-8 rounded-2';
    const out = ensureClosedHtml(broken);
    expect(out).not.toContain("rounded-2");
    expect(out).toMatch(/<\/body>\s*<\/html>\s*$/);
  });

  it("не трогает уже закрытый валидный HTML", () => {
    const ok = "<html><head></head><body><h1>Привет</h1></body></html>";
    expect(ensureClosedHtml(ok)).toBe(ok);
  });

  it("дописывает </body></html> если их нет", () => {
    const out = ensureClosedHtml("<html><head></head><body><p>текст</p>");
    expect(out).toContain("</body>");
    expect(out).toContain("</html>");
  });
});

describe("fixBrokenImages", () => {
  it("меняет unsplash на picsum, сохраняя размеры", () => {
    const html =
      '<img src="https://images.unsplash.com/photo-1635070041078-c33e5db362d9?q=80&w=1000&h=500&auto=format">';
    const out = fixBrokenImages(html);
    expect(out).toContain("picsum.photos");
    expect(out).not.toContain("images.unsplash.com");
    expect(out).toContain("/1000/500");
  });

  it("детерминирован — повторный прогон даёт тот же результат", () => {
    const html = '<img src="https://images.unsplash.com/photo-abc123?w=400">';
    expect(fixBrokenImages(html)).toBe(fixBrokenImages(html));
  });

  it("не трогает не-unsplash картинки", () => {
    const html = '<img src="https://picsum.photos/seed/x/800/600"><img src="/local.png">';
    expect(fixBrokenImages(html)).toBe(html);
  });
});
