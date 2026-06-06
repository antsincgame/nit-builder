import { describe, it, expect } from "vitest";
import { auditAdminMarkup } from "~/lib/bake/auditMarkup";
import { extractCollectionsFromHtml } from "~/lib/bake/extractCollections.server";
import { acceptTunnelRepair } from "~/lib/services/tunnelPipeline.server";
import type {
  Plan,
  PlanCollection,
  PlanEditableZone,
} from "~/lib/utils/planSchema";

// ─── Фикстуры ───

const ZONE: PlanEditableZone = {
  id: "hero_title",
  type: "text",
  label: "Заголовок",
  section: "hero",
};

const COLLECTION: PlanCollection = {
  id: "cakes",
  label: "Торты",
  section: "catalog",
  fields: [
    { id: "photo", label: "Фото", type: "image" },
    { id: "name", label: "Название", type: "text" },
    { id: "price", label: "Цена", type: "price" },
  ],
};

/** Полная самодостаточная разметка — зона + коллекция со всеми атрибутами. */
const FULL_MARKUP = `<!DOCTYPE html><html><body>
<h1 data-edit="hero_title" data-edit-type="text" data-edit-label="Заголовок">Торты на заказ</h1>
<div data-collection="cakes" data-collection-label="Торты" class="grid">
  <article data-item class="card">
    <img data-field="photo" data-field-type="image" data-field-label="Фото" src="x.jpg" alt="">
    <h3 data-field="name" data-field-type="text" data-field-label="Название">Торт «Минск»</h3>
    <span data-field="price" data-field-type="price" data-field-label="Цена">₽2 900</span>
  </article>
</div>
</body></html>`;

const NO_MARKUP = `<!DOCTYPE html><html><body><div>пусто</div></body></html>`;

const ADMIN_PLAN: Plan = {
  business_type: "кондитерская",
  target_audience: "",
  tone: "тёплый",
  style_hints: "",
  color_mood: "warm-pastel",
  sections: ["hero", "catalog"],
  keywords: ["торты"],
  cta_primary: "Заказать",
  language: "ru",
  suggested_template_id: "blank-landing",
  needs_admin: true,
  admin_intent_confidence: "explicit",
  editable_zones: [ZONE],
  collections: [COLLECTION],
};

const STATIC_PLAN: Plan = {
  ...ADMIN_PLAN,
  needs_admin: false,
  admin_intent_confidence: "none",
  editable_zones: [],
  collections: [],
};

// ─── auditAdminMarkup ───

describe("auditAdminMarkup", () => {
  it("ok при пустых декларациях (статичный сайт)", () => {
    const audit = auditAdminMarkup(NO_MARKUP, [], []);
    expect(audit.ok).toBe(true);
  });

  it("ok на полной разметке", () => {
    const audit = auditAdminMarkup(FULL_MARKUP, [ZONE], [COLLECTION]);
    expect(audit.ok).toBe(true);
    expect(audit.missingZones).toHaveLength(0);
    expect(audit.missingCollections).toHaveLength(0);
    expect(audit.missingFields).toHaveLength(0);
  });

  it("ловит отсутствующую зону", () => {
    const audit = auditAdminMarkup(NO_MARKUP, [ZONE], []);
    expect(audit.ok).toBe(false);
    expect(audit.missingZones.map((z) => z.id)).toEqual(["hero_title"]);
  });

  it("коллекция без контейнера → missingCollections", () => {
    const audit = auditAdminMarkup(NO_MARKUP, [], [COLLECTION]);
    expect(audit.missingCollections.map((c) => c.id)).toEqual(["cakes"]);
  });

  it("контейнер без карточки data-item → missingCollections", () => {
    const html = `<html><body><div data-collection="cakes"><p>нет карточки</p></div></body></html>`;
    const audit = auditAdminMarkup(html, [], [COLLECTION]);
    expect(audit.missingCollections.map((c) => c.id)).toEqual(["cakes"]);
  });

  it("отсутствующее поле образца → missingFields", () => {
    const html = `<html><body><div data-collection="cakes"><article data-item>
      <img data-field="photo" data-field-type="image" src="x.jpg">
      <h3 data-field="name" data-field-type="text">Минск</h3>
    </article></div></body></html>`;
    const audit = auditAdminMarkup(html, [], [COLLECTION]);
    expect(audit.ok).toBe(false);
    expect(audit.missingFields.map((m) => m.field.id)).toEqual(["price"]);
  });

  it("image-поле не на <img> → missingFields", () => {
    const html = `<html><body><div data-collection="cakes"><article data-item>
      <div data-field="photo" data-field-type="image"></div>
      <h3 data-field="name" data-field-type="text">Минск</h3>
      <span data-field="price" data-field-type="price">₽1</span>
    </article></div></body></html>`;
    const audit = auditAdminMarkup(html, [], [COLLECTION]);
    expect(audit.missingFields.map((m) => m.field.id)).toEqual(["photo"]);
  });

  it("поле без валидного data-field-type → missingFields (самодостаточность)", () => {
    const html = `<html><body><div data-collection="cakes"><article data-item>
      <img data-field="photo" data-field-type="image" src="x.jpg">
      <h3 data-field="name">Минск</h3>
      <span data-field="price" data-field-type="wrong">₽1</span>
    </article></div></body></html>`;
    const audit = auditAdminMarkup(html, [], [COLLECTION]);
    expect(audit.missingFields.map((m) => m.field.id).sort()).toEqual(["name", "price"]);
  });
});

// ─── extractCollectionsFromHtml ───

describe("extractCollectionsFromHtml", () => {
  it("восстанавливает схему из полной разметки", () => {
    const cols = extractCollectionsFromHtml(FULL_MARKUP);
    expect(cols).toHaveLength(1);
    const c = cols[0]!;
    expect(c.id).toBe("cakes");
    expect(c.label).toBe("Торты");
    expect(c.fields).toEqual([
      { id: "photo", type: "image", label: "Фото" },
      { id: "name", type: "text", label: "Название" },
      { id: "price", type: "price", label: "Цена" },
    ]);
  });

  it("мягкие дефолты: label → id, битый type → text", () => {
    const html = `<html><body><div data-collection="items"><div data-item>
      <span data-field="name">x</span>
      <span data-field="weight" data-field-type="kilograms">1</span>
    </div></div></body></html>`;
    const cols = extractCollectionsFromHtml(html);
    expect(cols).toHaveLength(1);
    expect(cols[0]!.label).toBe("items");
    expect(cols[0]!.fields).toEqual([
      { id: "name", type: "text", label: "name" },
      { id: "weight", type: "text", label: "weight" },
    ]);
  });

  it("скипает битые id и контейнеры без data-item", () => {
    const html = `<html><body>
      <div data-collection="Bad-Id!"><div data-item><span data-field="a_x">1</span></div></div>
      <div data-collection="no_item"><p>пусто</p></div>
      <div data-collection="good"><div data-item><span data-field="name" data-field-type="text">x</span></div></div>
    </body></html>`;
    const cols = extractCollectionsFromHtml(html);
    expect(cols.map((c) => c.id)).toEqual(["good"]);
  });

  it("дедупит повторные id коллекций и полей", () => {
    const html = `<html><body>
      <div data-collection="cakes"><div data-item>
        <span data-field="name" data-field-type="text">a</span>
        <span data-field="name" data-field-type="text">дубль</span>
      </div></div>
      <div data-collection="cakes"><div data-item><span data-field="other" data-field-type="text">b</span></div></div>
    </body></html>`;
    const cols = extractCollectionsFromHtml(html);
    expect(cols).toHaveLength(1);
    expect(cols[0]!.fields.map((f) => f.id)).toEqual(["name"]);
  });

  it("пустой результат на HTML без разметки", () => {
    expect(extractCollectionsFromHtml(NO_MARKUP)).toEqual([]);
  });
});

// ─── acceptTunnelRepair ───

describe("acceptTunnelRepair", () => {
  it("план без админки → всегда исходный (быстрый путь)", () => {
    expect(acceptTunnelRepair(NO_MARKUP, FULL_MARKUP, STATIC_PLAN)).toBe(NO_MARKUP);
  });

  it("принимает починенный HTML, когда промахов стало меньше", () => {
    const result = acceptTunnelRepair(NO_MARKUP, FULL_MARKUP, ADMIN_PLAN);
    expect(result).toContain('data-collection="cakes"');
    expect(result).toContain('data-edit="hero_title"');
  });

  it("отбраковывает обрезанный repair (нет </html>)", () => {
    const truncated = FULL_MARKUP.replace("</html>", "");
    expect(acceptTunnelRepair(NO_MARKUP, truncated, ADMIN_PLAN)).toBe(NO_MARKUP);
  });

  it("откатывается, если repair не улучшил разметку", () => {
    // repair вернул такой же пустой HTML — промахов столько же.
    const stillEmpty = `<!DOCTYPE html><html><body><p>всё ещё пусто</p></body></html>`;
    expect(acceptTunnelRepair(NO_MARKUP, stillEmpty, ADMIN_PLAN)).toBe(NO_MARKUP);
  });

  it("частичное улучшение тоже принимается (меньше промахов, но не ноль)", () => {
    // Зона размечена, коллекция всё ещё отсутствует: 4 промаха → 1.
    const partial = `<!DOCTYPE html><html><body>
      <h1 data-edit="hero_title" data-edit-type="text" data-edit-label="Заголовок">Торты</h1>
    </body></html>`;
    const result = acceptTunnelRepair(NO_MARKUP, partial, ADMIN_PLAN);
    expect(result).toContain('data-edit="hero_title"');
  });
});
