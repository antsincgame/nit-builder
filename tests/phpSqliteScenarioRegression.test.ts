// Regression matrix for generated PHP+SQLite MVP scenarios.
import { describe, expect, it } from "vitest";
import { buildPhpSqliteArtifact } from "~/lib/services/phpSqliteArtifactBuilder";
import type { Plan } from "~/lib/utils/planSchema";

const BASE_PLAN: Plan = {
  business_type: "MVP",
  target_audience: "клиенты",
  tone: "понятный",
  style_hints: "аккуратный",
  color_mood: "light-minimal",
  sections: ["hero", "products", "cart", "checkout", "admin"],
  keywords: ["каталог", "заказы", "админка"],
  cta_primary: "Оформить заказ",
  language: "ru",
  suggested_template_id: "blank-landing",
  pricing_tiers: [
    { name: "Старт", price: "4900", features: ["Базовая комплектация"] },
    { name: "Премиум", price: "14900", features: ["Расширенная комплектация"], highlighted: true },
  ],
};

const SCENARIOS: Array<{
  name: string;
  plan: Plan;
  expectedSeeds: string[];
  expectedThemeClass: string;
}> = [
  {
    name: "coffee storefront",
    plan: {
      ...BASE_PLAN,
      business_type: "кофейня Bean & Byte",
      color_mood: "warm-pastel",
      keywords: ["кофе", "кофейня", "десерты", "меню", "корзина"],
      hero_headline: "Кофейня Bean & Byte",
    },
    expectedSeeds: ["Капучино", "Флэт уайт", "Чизкейк Сан-Себастьян"],
    expectedThemeClass: "theme-food",
  },
  {
    name: "beauty booking",
    plan: {
      ...BASE_PLAN,
      business_type: "салон красоты",
      keywords: ["салон", "красота", "маникюр", "запись"],
      hero_headline: "Салон красоты рядом с домом",
    },
    expectedSeeds: ["Маникюр", "Педикюр", "Брови"],
    expectedThemeClass: "theme-beauty",
  },
  {
    name: "online courses",
    plan: {
      ...BASE_PLAN,
      business_type: "школа английского",
      keywords: ["курсы", "школа", "занятия", "образование"],
      hero_headline: "Английский с практикой",
    },
    expectedSeeds: ["Основы", "Практикум", "Индивидуально"],
    expectedThemeClass: "theme-courses",
  },
  {
    name: "real estate catalog",
    plan: {
      ...BASE_PLAN,
      business_type: "агентство недвижимости",
      keywords: ["недвижимость", "объекты", "квартиры", "дом"],
      hero_headline: "Объекты для жизни и инвестиций",
    },
    expectedSeeds: ["Студия у метро", "Двухкомнатная с видом", "Дом у леса"],
    expectedThemeClass: "theme-real-estate",
  },
  {
    name: "auto service",
    plan: {
      ...BASE_PLAN,
      business_type: "СТО и автосервис",
      keywords: ["авто", "машины", "ремонт", "запчасти"],
      hero_headline: "Сервис для вашего авто",
    },
    expectedSeeds: ["Диагностика авто", "Замена масла", "Тормозная система"],
    expectedThemeClass: "theme-auto",
  },
];

function fileOf(artifact: ReturnType<typeof buildPhpSqliteArtifact>, path: string): string {
  return artifact.files.find((file) => file.path === path)?.content ?? "";
}

describe("php-sqlite scenario regression", () => {
  for (const scenario of SCENARIOS) {
    it(`generates niche-specific MVP output for ${scenario.name}`, () => {
      const artifact = buildPhpSqliteArtifact({
        plan: scenario.plan,
        userMessage: `${scenario.name} с каталогом, корзиной, заказами и админкой`,
      });
      const sqlite = fileOf(artifact, "database/schema.sqlite.sql");
      const index = fileOf(artifact, "public/index.php");
      const css = fileOf(artifact, "public/assets/style.css");

      for (const seed of scenario.expectedSeeds) {
        expect(sqlite).toContain(seed);
      }
      expect(sqlite).not.toContain("SELECT 'Старт'");
      expect(sqlite).not.toContain("SELECT 'Премиум'");
      expect(index).toContain("product-editor");
      expect(index).toContain("product-summary");
      expect(index).toContain("cart_total");
      expect(index).toContain("create_checkout_session");
      expect(index).toContain(scenario.expectedThemeClass);
      expect(css).toContain(".product-editor:not([open])>.product-row");
    });
  }
});
