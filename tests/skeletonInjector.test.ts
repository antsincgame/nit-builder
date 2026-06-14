import { describe, it, expect, beforeEach } from "vitest";
import { injectPlanIntoTemplate } from "~/lib/services/skeletonInjector";
import { loadTemplateHtml } from "~/lib/config/htmlTemplates.server";
import type { Plan } from "~/lib/utils/planSchema";

const BASE_TEMPLATE = `<!DOCTYPE html>
<html><head><title>Default title</title></head><body>
<section id="hero">
  <h1>Default headline</h1>
  <p>Default subheadline text.</p>
  <a href="#">CTA</a>
</section>
<section id="features">
  <h2>Features title</h2>
  <div class="grid">
    <div class="card">
      <h3>Default benefit 1</h3>
      <p>Default description 1.</p>
    </div>
    <div class="card">
      <h3>Default benefit 2</h3>
      <p>Default description 2.</p>
    </div>
    <div class="card">
      <h3>Default benefit 3</h3>
      <p>Default description 3.</p>
    </div>
  </div>
</section>
<section id="testimonials">
  <p>Default social proof line.</p>
</section>
</body></html>`;

const FULL_PLAN: Plan = {
  business_type: "кофейня",
  target_audience: "офисные",
  tone: "тёплый",
  style_hints: "",
  color_mood: "warm-pastel",
  sections: ["hero", "features"],
  keywords: [],
  cta_primary: "Смотреть",
  language: "ru",
  suggested_template_id: "coffee-shop",
  hero_headline: "Кофе варят те, кто им живёт",
  hero_subheadline: "Обжарка каждую пятницу из Колумбии.",
  key_benefits: [
    { title: "Свежесть", description: "Зерно в помол через 7 дней." },
    { title: "Бариста", description: "3 месяца стажировки." },
    { title: "V60", description: "Альтернативные методы." },
  ],
  social_proof_line: "500+ гостей",
  cta_microcopy: "Первая чашка бесплатно",
};

beforeEach(() => {
  delete process.env.NIT_SKELETON_INJECT_ENABLED;
});

describe("injectPlanIntoTemplate", () => {
  it("подставляет hero_headline в h1 секции hero", () => {
    const r = injectPlanIntoTemplate(BASE_TEMPLATE, FULL_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Кофе варят те, кто им живёт");
      expect(r.html).not.toContain("Default headline");
    }
  });

  it("подставляет hero_subheadline в первый p после h1", () => {
    const r = injectPlanIntoTemplate(BASE_TEMPLATE, FULL_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Обжарка каждую пятницу");
      expect(r.html).not.toContain("Default subheadline");
    }
  });

  it("подставляет cta_primary в первую hero-кнопку", () => {
    const r = injectPlanIntoTemplate(BASE_TEMPLATE, {
      ...FULL_PLAN,
      cta_primary: "Забронировать столик",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain(">Забронировать столик</a>");
      expect(r.html).not.toContain(">CTA</a>");
    }
  });

  it("подставляет все 3 benefits в features-секцию", () => {
    const r = injectPlanIntoTemplate(BASE_TEMPLATE, FULL_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Свежесть");
      expect(r.html).toContain("Зерно в помол через 7 дней");
      expect(r.html).toContain("V60");
      expect(r.html).toContain("Альтернативные методы");
      expect(r.html).not.toContain("Default benefit 1");
    }
  });

  it("DOM-aware: не перетирает trailing-CTA и находит описание за иконкой (#7)", () => {
    const tpl = `<!DOCTYPE html><html><head><title>x</title></head><body>
<section id="hero"><h1>old</h1><p>old</p><a>cta</a></section>
<section id="features">
  <div class="grid">
    <div class="card"><h3>Default 1</h3><p>Default description 1.</p></div>
    <div class="card"><h3>Default 2</h3><div class="icon"><svg viewBox="0 0 24 24"><path d="M1 1h22v22H1z"></path></svg></div><p>Default description 2.</p></div>
    <div class="card"><h3>Default 3 без описания</h3></div>
  </div>
  <p class="cta-note">Звоните нам в любое время — ответим быстро.</p>
</section>
</body></html>`;
    const r = injectPlanIntoTemplate(tpl, FULL_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Заголовки всех 3 карточек подставлены.
      expect(r.html).toContain("Свежесть");
      expect(r.html).toContain("Бариста");
      expect(r.html).toContain("V60");
      // Описание 2-й карточки найдено ЗА иконкой-svg (регекс-окно бы сломалось).
      expect(r.html).toContain("3 месяца стажировки.");
      expect(r.html).not.toContain("Default description 2");
      // 3-я карточка без своего <p>: trailing-CTA НЕ перетёрт описанием benefit 3.
      expect(r.html).toContain("Звоните нам в любое время");
      expect(r.html).not.toContain("Альтернативные методы.");
    }
  });

  it("экранирует HTML-спецсимволы в копирайте", () => {
    const planWithHtml: Plan = {
      ...FULL_PLAN,
      hero_headline: "Кафе <b>premium</b> & co",
    };
    const r = injectPlanIntoTemplate(BASE_TEMPLATE, planWithHtml);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("&lt;b&gt;premium&lt;/b&gt;");
      expect(r.html).toContain("&amp;");
    }
  });

  it("возвращает ok:false без hero_headline (legacy plan)", () => {
    const legacyPlan: Plan = { ...FULL_PLAN, hero_headline: undefined };
    const r = injectPlanIntoTemplate(BASE_TEMPLATE, legacyPlan);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/missing_required/);
  });

  it("отключается через ENV", () => {
    process.env.NIT_SKELETON_INJECT_ENABLED = "0";
    const r = injectPlanIntoTemplate(BASE_TEMPLATE, FULL_PLAN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("disabled");
  });

  it("возвращает low_fill_ratio если шаблон без hero/features", () => {
    const minimalTemplate = `<html><body><section id="contact"><h1>X</h1></section></body></html>`;
    const r = injectPlanIntoTemplate(minimalTemplate, FULL_PLAN);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/low_fill_ratio/);
    }
  });

  it("fallback на about если features/benefits отсутствуют", () => {
    // Шаблон должен содержать достаточно слотов для прохождения SLOT_FILL_THRESHOLD=0.6:
    // title + h1 + p + benefits(about) + social_proof + cta_microcopy = 6/6
    const aboutTemplate = `<html><head><title>X</title></head><body>
      <section id="hero"><h1>X</h1><p>Y</p><a href="#">CTA</a></section>
      <section id="about">
        <h3>Card 1</h3><p>Desc 1</p>
        <h3>Card 2</h3><p>Desc 2</p>
        <h3>Card 3</h3><p>Desc 3</p>
      </section>
      <section id="testimonials"><p>Old</p></section>
    </body></html>`;
    const r = injectPlanIntoTemplate(aboutTemplate, FULL_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Свежесть");
      expect(r.html).not.toContain("Card 1");
    }
  });

  it("не затирает услуги в #services дефолтными выгодами (нишевый шаблон)", () => {
    // У beauty-master/автосервиса секция #services — курированные услуги,
    // а не прайс, поэтому looksLikePriceSection её не защищал. Раньше services
    // был в benefitsSectionIds и replaceBenefitCards затирал первые карточки
    // выгодами. Теперь услуги шаблона остаются нетронутыми.
    const servicesTemplate = `<html><head><title>X</title></head><body>
      <section id="hero"><h1>X</h1><p>Y</p><a href="#">CTA</a></section>
      <section id="services">
        <h3>Маникюр</h3><p>Классический маникюр.</p>
        <h3>Дизайн</h3><p>Френч и роспись.</p>
        <h3>Укрепление</h3><p>Гель и акрил.</p>
      </section>
      <section id="testimonials"><p>Old</p></section>
    </body></html>`;
    const r = injectPlanIntoTemplate(servicesTemplate, FULL_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Маникюр");
      expect(r.html).toContain("Дизайн");
      expect(r.html).toContain("Укрепление");
      // benefit-заголовок из FULL_PLAN НЕ должен влезть в услуги
      expect(r.html).not.toContain("Свежесть");
    }
  });

  it("заменяет hero-eyebrow (кикер над h1) на business_type", () => {
    const tpl = `<html><head><title>x</title></head><body>
      <section id="hero"><p>Мастер маникюра · Минск</p><h1>old</h1><p>old sub</p><a href="#">cta</a></section>
      <section id="features"><h3>b1</h3><p>d1</p><h3>b2</h3><p>d2</p><h3>b3</h3><p>d3</p></section>
      <section id="testimonials"><p>old</p></section>
    </body></html>`;
    const r = injectPlanIntoTemplate(tpl, {
      ...FULL_PLAN,
      business_type: "студия наращивания ресниц",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("студия наращивания ресниц");
      expect(r.html).not.toContain("Мастер маникюра");
    }
  });

  it("заполняет #services из plan.services (а не из key_benefits)", () => {
    const tpl = `<html><head><title>x</title></head><body>
      <section id="hero"><h1>old</h1><p>old sub</p><a href="#">cta</a></section>
      <section id="services">
        <h3>Маникюр</h3><p>Классический маникюр.</p>
        <h3>Дизайн</h3><p>Френч и роспись.</p>
        <h3>Укрепление</h3><p>Гель и акрил.</p>
      </section>
      <section id="testimonials"><p>old</p></section>
    </body></html>`;
    const r = injectPlanIntoTemplate(tpl, {
      ...FULL_PLAN,
      services: [
        { title: "Наращивание ресниц", description: "Классика, 2D и 3D объём." },
        { title: "Ламинирование", description: "Изгиб и блеск без туши на 6 недель." },
        { title: "Ботокс ресниц", description: "Восстановление и питание." },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Наращивание ресниц");
      expect(r.html).toContain("Ламинирование");
      expect(r.html).toContain("Ботокс ресниц");
      // дефолтные услуги шаблона заменены
      expect(r.html).not.toContain("Маникюр");
      // benefit из FULL_PLAN не должен попасть в секцию услуг
      expect(r.html).not.toContain("Свежесть");
    }
  });

  it("не рвёт структуру HTML", () => {
    const r = injectPlanIntoTemplate(BASE_TEMPLATE, FULL_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Проверяем что все тэги остались закрытыми
      const openH1 = (r.html.match(/<h1\b/g) ?? []).length;
      const closeH1 = (r.html.match(/<\/h1>/g) ?? []).length;
      expect(openH1).toBe(closeH1);
      const openSection = (r.html.match(/<section\b/g) ?? []).length;
      const closeSection = (r.html.match(/<\/section>/g) ?? []).length;
      expect(openSection).toBe(closeSection);
    }
  });
});

const NICHE_TEMPLATE = `<!DOCTYPE html>
<html><head><title>OLD BRAND — студия</title></head><body>
<nav>
  <a href="#" class="logo">💈 OLD BRAND</a>
  <a href="#masters">Мастера</a>
  <a href="#booking" class="btn">Записаться</a>
</nav>
<section id="hero">
  <p>Эйбров</p>
  <h1>Старый заголовок</h1>
  <p>Старый подзаголовок.</p>
  <a href="#booking" class="cta">Записаться</a>
</section>
<section id="masters">
  <h2>Наши мастера</h2>
  <div class="card"><h3>СТАРЫЙ ОДИН</h3><p>Роль один</p></div>
  <div class="card"><h3>СТАРЫЙ ДВА</h3><p>Роль два</p></div>
  <div class="card"><h3>СТАРЫЙ ТРИ</h3><p>Роль три</p></div>
</section>
<section id="booking">
  <a href="tel:+375290000000" class="btn-phone">📞 +375 29 000-00-00</a>
  <p><address class="addr">ул. Старая 1, Минск</address> · Пн-Вс</p>
</section>
<footer><p class="brand">💈 OLD BRAND</p></footer>
</body></html>`;

const NICHE_PLAN: Plan = {
  ...FULL_PLAN,
  business_type: "барбершоп",
  suggested_template_id: "barbershop",
  brand_name: "BroDude",
  team: [
    { name: "Иван Петров", role: "Топ-мастер" },
    { name: "Пётр Сидоров", role: "Барбер" },
  ],
  contact_phone: "+375 (33) 765-43-21",
  contact_address: "Минск, ул. Немига 5",
};

describe("injectPlanIntoTemplate — бренд/команда/контакт", () => {
  it("подставляет brand_name в nav и footer, сохраняя эмодзи", () => {
    const r = injectPlanIntoTemplate(NICHE_TEMPLATE, NICHE_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).not.toContain("OLD BRAND");
      expect(r.html).toContain("💈 BroDude");
      const hits = (r.html.match(/BroDude/g) ?? []).length;
      expect(hits).toBeGreaterThanOrEqual(2);
    }
  });

  it("подставляет имена и роли команды в секцию masters", () => {
    const r = injectPlanIntoTemplate(NICHE_TEMPLATE, NICHE_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Иван Петров");
      expect(r.html).toContain("Топ-мастер");
      expect(r.html).toContain("Пётр Сидоров");
      expect(r.html).not.toContain("СТАРЫЙ ОДИН");
      // третья карточка не затронута (в плане 2 мастера)
      expect(r.html).toContain("СТАРЫЙ ТРИ");
    }
  });

  it("заменяет телефон, сохраняя класс кнопки", () => {
    const r = injectPlanIntoTemplate(NICHE_TEMPLATE, NICHE_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain('class="btn-phone"');
      expect(r.html).toContain("+375 (33) 765-43-21");
      expect(r.html).toContain('href="tel:+375337654321"');
    }
  });

  it("заменяет адрес в <address>", () => {
    const r = injectPlanIntoTemplate(NICHE_TEMPLATE, NICHE_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Минск, ул. Немига 5");
      expect(r.html).not.toContain("ул. Старая 1");
    }
  });

  it("extended-слоты не штрафуют fillRatio и не ломают структуру", () => {
    const r = injectPlanIntoTemplate(NICHE_TEMPLATE, NICHE_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.extendedSlotsFilled).toBeGreaterThanOrEqual(3);
      const openH3 = (r.html.match(/<h3\b/g) ?? []).length;
      const closeH3 = (r.html.match(/<\/h3>/g) ?? []).length;
      expect(openH3).toBe(closeH3);
    }
  });
});

const SCAFFOLD_PLAN: Plan = {
  business_type: "студия наращивания ресниц",
  target_audience: "девушки 20-40",
  tone: "тёплый, уютный",
  style_hints: "",
  color_mood: "warm-pastel",
  sections: ["hero", "features", "services", "pricing", "testimonials", "faq", "contact"],
  keywords: ["ресницы", "наращивание", "ламинирование"],
  cta_primary: "Записаться",
  language: "ru",
  suggested_template_id: "service-studio",
  hero_headline: "Взгляд, который говорит за вас",
  hero_subheadline: "Наращивание и ламинирование ресниц в уютной студии в центре Минска.",
  key_benefits: [
    { title: "Гипоаллергенные материалы", description: "Премиум-клей и изгибы без вреда." },
    { title: "Стойкий результат", description: "Носка 4-5 недель при должном уходе." },
    { title: "Без боли и стресса", description: "Комфортная процедура лёжа, можно поспать." },
  ],
  services: [
    { title: "Наращивание ресниц", description: "Классика, 2D, 3D и голливудский объём." },
    { title: "Ламинирование", description: "Изгиб, подкручивание и блеск без туши." },
    { title: "Ботокс и уход", description: "Восстановление и питание ослабленных ресниц." },
  ],
  pricing_tiers: [
    { name: "Классика", price: "от 45 ₽", features: ["Натуральный объём", "Коррекция формы"] },
    { name: "Объём 2D-3D", price: "от 60 ₽", features: ["Пышный объём", "Подбор изгиба", "Уход в подарок"], highlighted: true },
    { name: "Ламинирование", price: "от 50 ₽", features: ["Изгиб и блеск", "Питание"] },
  ],
  social_proof_line: "Более 1200 довольных клиенток за 3 года",
  cta_microcopy: "Первая коррекция со скидкой",
  brand_name: "Lash Bar",
  contact_phone: "+375 (29) 765-43-21",
  contact_email: "hello@lashbar.by",
  contact_address: "Минск, ул. Немига 5",
  faq: [
    { question: "Сколько держится наращивание?", answer: "4-5 недель, далее коррекция." },
    { question: "Это вредно для своих ресниц?", answer: "Нет, при правильной технике и уходе." },
    { question: "Как записаться?", answer: "Онлайн или по телефону, подберём время." },
  ],
};

describe("service-studio: реальный каркас заполняется планом (Б)", () => {
  it("инжектит все слоты в service-studio.html", () => {
    const tpl = loadTemplateHtml("service-studio");
    const r = injectPlanIntoTemplate(tpl, SCAFFOLD_PLAN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // hero headline + subheadline
      expect(r.html).toContain("Взгляд, который говорит за вас");
      expect(r.html).toContain("Наращивание и ламинирование ресниц");
      // eyebrow ← business_type, дефолтный кикер заменён
      expect(r.html).toContain("студия наращивания ресниц");
      expect(r.html).not.toContain("Студия красоты и ухода");
      // key_benefits → #features
      expect(r.html).toContain("Гипоаллергенные материалы");
      expect(r.html).not.toContain("Опытные мастера");
      // services → #services
      expect(r.html).toContain("Наращивание ресниц");
      expect(r.html).not.toContain("Процедура ухода");
      // pricing_tiers → #pricing
      expect(r.html).toContain("Объём 2D-3D");
      expect(r.html).not.toContain("Оптимальный");
      // faq → #faq
      expect(r.html).toContain("Сколько держится наращивание?");
      // contact
      expect(r.html).toContain("+375 (29) 765-43-21");
      expect(r.html).toContain("hello@lashbar.by");
      // brand → nav + footer
      expect(r.html).toContain("Lash Bar");
      // services, pricing, faq, contact, brand, eyebrow
      expect(r.extendedSlotsFilled).toBeGreaterThanOrEqual(5);
    }
  });
});
