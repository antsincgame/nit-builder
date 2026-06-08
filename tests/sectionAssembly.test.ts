import { describe, it, expect } from "vitest";
import {
  buildSectionDesignSystem,
  assembleSections,
  validateSectionHtml,
  buildSectionPrompt,
  type SectionBlock,
} from "~/lib/services/sectionAssembly";
import type { Plan } from "~/lib/utils/planSchema";

const basePlan: Plan = {
  business_type: "Кофейня",
  target_audience: "",
  tone: "тёплый",
  style_hints: "",
  color_mood: "warm-pastel",
  sections: ["hero", "features", "contact"],
  keywords: [],
  cta_primary: "Забронировать",
  language: "ru",
  suggested_template_id: "tpl-1",
  hero_headline: "Лучший кофе в городе",
} as Plan;

describe("buildSectionDesignSystem", () => {
  it("берёт палитру и шрифты из color_mood", () => {
    const ds = buildSectionDesignSystem(basePlan);
    expect(ds.palette.mood).toBe("warm-pastel");
    expect(ds.palette.primary).toBe("#d97757");
    expect(ds.fonts.display).toBe("Fraunces");
  });

  it("baseCss содержит CSS-переменные палитры, fontLinks — cdn шрифтов", () => {
    const ds = buildSectionDesignSystem(basePlan);
    expect(ds.baseCss).toContain("--primary:#d97757");
    expect(ds.baseCss).toContain("--bg:#fdf6ec");
    expect(ds.baseCss).toContain(".container");
    expect(ds.fontLinks).toContain("fonts.googleapis.com");
    expect(ds.fontLinks).toContain("Fraunces");
  });

  it("неизвестный mood → light-minimal fallback", () => {
    const ds = buildSectionDesignSystem({ ...basePlan, color_mood: "wat" as Plan["color_mood"] });
    expect(ds.palette.mood).toBe("light-minimal");
  });
});

describe("assembleSections", () => {
  const ds = buildSectionDesignSystem(basePlan);
  const blocks: SectionBlock[] = [
    { name: "hero", html: "<section id='hero'><h1>Кофе</h1></section>" },
    { name: "features", html: "<section id='features'><h2>Меню</h2></section>" },
    { name: "empty", html: "   " },
  ];

  it("собирает валидный документ с lang, шрифтами и базовым CSS в head", () => {
    const out = assembleSections(blocks, { plan: basePlan, design: ds });
    expect(out.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(out).toContain('<html lang="ru">');
    expect(out).toContain("nit-section-base");
    expect(out).toContain("Fraunces");
    expect(out).toContain("<title>Лучший кофе в городе</title>");
  });

  it("вставляет блоки по порядку и отбрасывает пустые", () => {
    const out = assembleSections(blocks, { plan: basePlan, design: ds });
    expect(out.indexOf("id='hero'")).toBeLessThan(out.indexOf("id='features'"));
    expect(out).not.toContain("<section>   </section>");
    const body = out.slice(out.indexOf("<body>"), out.indexOf("</body>"));
    expect(body).toContain("id='hero'");
    expect(body).toContain("id='features'");
  });

  it("by → lang=be, экранирует title", () => {
    const out = assembleSections([blocks[0]], {
      plan: { ...basePlan, language: "by", hero_headline: 'Кава & "смак"' },
      design: ds,
    });
    expect(out).toContain('<html lang="be">');
    expect(out).toContain("&quot;");
  });
});

describe("validateSectionHtml", () => {
  it("нормальная содержательная секция — ok", () => {
    const v = validateSectionHtml(
      "<section><h2>Свежая обжарка</h2><p>Зёрна из Эфиопии, обжарка каждое утро, помол под заказ.</p></section>",
      { name: "features", language: "ru" },
    );
    expect(v.ok).toBe(true);
    expect(v.issues).toEqual([]);
  });

  it("пустой / не-HTML вывод — issue", () => {
    expect(validateSectionHtml("   ", { name: "hero" }).ok).toBe(false);
    expect(validateSectionHtml("просто текст", { name: "hero" }).ok).toBe(false);
  });

  it("почти нет текста — issue", () => {
    const v = validateSectionHtml("<section><span>!</span></section>", { name: "about" });
    expect(v.ok).toBe(false);
    expect(v.issues[0]).toContain("почти нет текста");
  });

  it("ловит generic-штампы и плейсхолдеры", () => {
    const stamps = [
      "<section><h2>Почему выбирают нас</h2><p>Мы лучшие на рынке услуг сегодня.</p></section>",
      "<section><p>Lorem ipsum dolor sit amet consectetur adipiscing elit today.</p></section>",
      "<section><p>Your text here goes in this particular content block area.</p></section>",
    ];
    for (const s of stamps) {
      expect(validateSectionHtml(s, { name: "x", language: "ru" }).ok).toBe(false);
    }
  });

  it("нормальный CTA «связаться/заявка» НЕ штрафуется", () => {
    const v = validateSectionHtml(
      "<section><h2>Свяжитесь с нами</h2><p>Оставьте заявку и менеджер перезвонит в течение часа.</p></section>",
      { name: "contact", language: "ru" },
    );
    expect(v.ok).toBe(true);
  });

  it("hero без заголовка — issue", () => {
    const v = validateSectionHtml(
      "<section><p>Большой осмысленный подзаголовок без настоящего заголовка над ним совсем.</p></section>",
      { name: "hero", language: "ru" },
    );
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.includes("нет заголовка"))).toBe(true);
  });
});

describe("buildSectionPrompt", () => {
  const ds = buildSectionDesignSystem(basePlan);

  it("несёт тип бизнеса, дизайн-контракт и требование вернуть только секцию", () => {
    const out = buildSectionPrompt(basePlan, "hero", ds);
    expect(out).toContain("Кофейня");
    expect(out).toContain("var(--primary)");
    expect(out).toContain("<section");
    expect(out).toContain(".container");
    expect(out.toLowerCase()).toContain("только один");
  });

  it("hero включает заголовок и CTA из плана", () => {
    const out = buildSectionPrompt(basePlan, "hero", ds);
    expect(out).toContain("Лучший кофе в городе");
    expect(out).toContain("Забронировать");
  });

  it("features подставляет key_benefits", () => {
    const plan = {
      ...basePlan,
      key_benefits: [
        { title: "Своя обжарка", description: "Жарим зёрна каждое утро" },
        { title: "Завтраки", description: "С 8 утра" },
        { title: "Wi-Fi", description: "Быстрый интернет для работы" },
      ],
    } as Plan;
    const out = buildSectionPrompt(plan, "features", ds);
    expect(out).toContain("Своя обжарка");
    expect(out).toContain("Жарим зёрна каждое утро");
  });

  it("pricing подставляет тарифы с ценами и метит рекомендуемый", () => {
    const plan = {
      ...basePlan,
      pricing_tiers: [
        { name: "Базовый", price: "₽990", period: "в месяц", features: ["10 чашек"] },
        { name: "Про", price: "₽1990", features: ["безлимит"], highlighted: true },
      ],
    } as Plan;
    const out = buildSectionPrompt(plan, "Тарифы", ds);
    expect(out).toContain("Базовый");
    expect(out).toContain("₽990");
    expect(out).toContain("рекомендуемый");
  });

  it("faq подставляет вопросы", () => {
    const plan = {
      ...basePlan,
      faq: [{ question: "Есть ли веранда?", answer: "Да, открыта летом" }],
    } as Plan;
    const out = buildSectionPrompt(plan, "FAQ", ds);
    expect(out).toContain("Есть ли веранда?");
  });

  it("неизвестная секция → общий бриф по бизнесу, не падает", () => {
    const out = buildSectionPrompt(basePlan, "галерея-чего-то", ds);
    expect(out).toContain("Кофейня");
    expect(out).toContain("<section");
  });

  it("en → язык контента English", () => {
    const out = buildSectionPrompt({ ...basePlan, language: "en" } as Plan, "hero", ds);
    expect(out).toContain("English");
  });
});
