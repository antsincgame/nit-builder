// Covers PHP+SQLite storefront generation, including niche-specific food output.
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  buildPhpSqliteArtifact,
  renderPhpSqliteArtifactPreview,
} from "~/lib/services/phpSqliteArtifactBuilder";
import type { Plan } from "~/lib/utils/planSchema";

const PLAN: Plan = {
  business_type: "магазин аксессуаров",
  target_audience: "покупатели городских аксессуаров",
  tone: "премиальный и понятный",
  style_hints: "тёмная палитра, аккуратные карточки",
  color_mood: "dark-premium",
  sections: ["hero", "products", "cart", "checkout", "admin"],
  keywords: ["товары", "корзина", "заказы", "админка"],
  cta_primary: "Добавить в корзину",
  language: "ru",
  suggested_template_id: "blank-landing",
  hero_headline: "Аксессуары с быстрой доставкой",
  hero_subheadline: "Каталог, корзина и админка в одном PHP-проекте.",
  key_benefits: [
    { title: "Быстрый каталог", description: "Товары загружаются из SQLite через PDO." },
    { title: "Админка", description: "Можно редактировать цены и описания." },
    { title: "Заказы", description: "Checkout сохраняет заявки в базе." },
  ],
  social_proof_line: "MVP backend artifact",
  cta_microcopy: "Оплаты подключаются через hosted checkout.",
  pricing_tiers: [
    { name: "Сумка", price: "4900 ₽", period: "разово", features: ["Кожа", "Гарантия"] },
    { name: "Рюкзак", price: "8900 ₽", period: "разово", features: ["Ноутбук 15", "Доставка"], highlighted: true },
  ],
};

const COFFEE_PLAN: Plan = {
  ...PLAN,
  business_type: "кофейня",
  color_mood: "warm-pastel",
  keywords: ["кофе", "кофейня Bean & Byte", "десерты", "меню", "заказы"],
  hero_headline: "Кофейня Bean & Byte — уютный уголок в центре города",
  hero_subheadline: "Свежие кофе и сладкие десерты каждый день.",
  cta_primary: "Оформить заказ",
  pricing_tiers: [
    { name: "Старт", price: "4900", features: ["Базовая комплектация"] },
    { name: "Премиум", price: "14900", features: ["Расширенная комплектация"], highlighted: true },
  ],
};

describe("phpSqliteArtifactBuilder", () => {
  it("builds a deterministic PHP + SQLite project manifest", () => {
    const artifact = buildPhpSqliteArtifact({
      plan: PLAN,
      userMessage: "нужен магазин на php sqlite с товарами и оплатой",
    });

    expect(artifact.kind).toBe("php-sqlite-app");
    expect(artifact.entrypoint).toBe("public/index.php");
    expect(artifact.files.map((f) => f.path)).toEqual([
      "README.md",
      "router.php",
      "app/config.php",
      "app/db.php",
      "app/security.php",
      "app/auth.php",
      "app/payments.php",
      "database/schema.sqlite.sql",
      "database/schema.mysql.sql",
      "public/index.php",
      "public/.htaccess",
      "public/assets/style.css",
      "storage/.gitkeep",
    ]);
  });

  it("includes backend essentials in generated files", () => {
    const artifact = buildPhpSqliteArtifact({
      plan: PLAN,
      userMessage: "нужен магазин на php sqlite с товарами и оплатой",
    });
    const file = (path: string) => artifact.files.find((f) => f.path === path)?.content ?? "";

    expect(file("public/index.php")).toContain("require_csrf()");
    expect(file("public/index.php")).toContain("login_admin");
    expect(file("public/index.php")).toContain("INSERT INTO orders");
    expect(file("public/index.php")).toContain("admin-stats");
    expect(file("public/index.php")).toContain("Управление проектом");
    expect(file("public/index.php")).toContain("store-hero");
    expect(file("public/index.php")).toContain("$themeClass =");
    expect(file("public/index.php")).toContain("topbar-inner");
    expect(file("public/index.php")).toContain("runtime-chip");
    expect(file("public/index.php")).toContain("Ответим в течение дня");
    expect(file("public/index.php")).toContain("global $appName, $htmlLang, $path, $brandTagline, $contactLine");
    expect(file("public/index.php")).toContain("function render_footer(): void { global $appName, $themeClass;");
    expect(file("public/index.php")).toContain("$isAdminRoute = strpos($path, '/admin') === 0;");
    expect(file("public/index.php")).toContain("admin-nav");
    expect(file("public/index.php")).not.toContain("|| current_admin()");
    expect(file("public/index.php")).not.toContain("commerce backend");
    expect(file("public/index.php")).not.toContain("PDO + CSRF");
    expect(file("public/index.php")).not.toContain("Commercial catalog");
    expect(file("public/index.php")).not.toContain("Открыть админку");
    expect(file("public/index.php")).toContain("trust-strip");
    expect(file("public/index.php")).toContain("benefits-section");
    expect(file("public/index.php")).toContain("reviews-section");
    expect(file("public/index.php")).toContain("showcase-section");
    expect(file("public/index.php")).toContain("proof-section");
    expect(file("public/index.php")).toContain("$faqItems");
    expect(file("public/index.php")).toContain("$reviews");
    expect(file("public/index.php")).toContain("$showcaseItems");
    expect(file("public/index.php")).toContain("product-art");
    expect(file("public/index.php")).toContain("product-row");
    expect(file("public/index.php")).toContain("product-editor");
    expect(file("public/index.php")).toContain("product-summary");
    expect(file("public/index.php")).toContain("order-card");
    expect(file("public/index.php")).toContain("/admin/order/status");
    expect(file("public/index.php")).toContain("is_active = ?");
    expect(file("public/index.php")).toContain("create_checkout_session");
    expect(file("app/payments.php")).toContain("handle_payment_webhook");
    expect(file("app/payments.php")).toContain("'completed'");
    expect(file("router.php")).toContain("readfile($file)");
    expect(file("router.php")).toContain("return true");
    expect(file("router.php")).toContain("'css' => 'text/css; charset=UTF-8'");
    expect(file("public/.htaccess")).toContain("RewriteRule ^ index.php [L]");
    expect(file("app/db.php")).toContain("new PDO('sqlite:'");
    expect(file("app/db.php")).toContain("schema.mysql.sql");
    expect(file("database/schema.sqlite.sql")).toContain("AUTOINCREMENT");
    expect(file("database/schema.mysql.sql")).toContain("ENGINE=InnoDB");
    expect(file("database/schema.sqlite.sql")).toContain("CREATE TABLE IF NOT EXISTS orders");
    expect(file("public/assets/style.css")).toContain(".admin-grid");
    expect(file("public/assets/style.css")).toContain(".status-paid");
    expect(file("public/assets/style.css")).toContain(".hero-visual");
    expect(file("public/assets/style.css")).toContain(".product-art");
    expect(file("public/assets/style.css")).toContain(".theme-beauty");
    expect(file("public/assets/style.css")).toContain(".benefit-grid");
    expect(file("public/assets/style.css")).toContain(".review-grid");
    expect(file("public/assets/style.css")).toContain(".showcase-grid");
    expect(file("public/assets/style.css")).toContain(".faq-grid");
  });

  it("uses niche-specific menu seeds and warm food theme for coffee projects", () => {
    const artifact = buildPhpSqliteArtifact({
      plan: COFFEE_PLAN,
      userMessage: "кофейня с товарами, корзиной, оплатой и админкой",
    });
    const file = (path: string) => artifact.files.find((f) => f.path === path)?.content ?? "";

    expect(file("database/schema.sqlite.sql")).toContain("Капучино");
    expect(file("database/schema.sqlite.sql")).toContain("Чизкейк Сан-Себастьян");
    expect(file("database/schema.sqlite.sql")).not.toContain("SELECT 'Старт'");
    expect(file("public/index.php")).toContain("кофе · десерты · заказы");
    expect(file("public/index.php")).toContain("Меню напитков и десертов");
    expect(file("public/assets/style.css")).toContain(".theme-food");
    expect(file("public/assets/style.css")).toContain("#b45309");
  });

  it("keeps generated PHP compatible with PHP 7.4 syntax", () => {
    const artifact = buildPhpSqliteArtifact({
      plan: PLAN,
      userMessage: "нужен магазин на php sqlite с товарами и оплатой",
    });
    const phpFiles = artifact.files.filter((file) => file.path.endsWith(".php"));
    const allPhp = phpFiles.map((file) => file.content).join("\n");

    expect(allPhp).not.toContain(": never");
    expect(allPhp).not.toContain("str_contains(");
    expect(allPhp).not.toContain("str_starts_with(");
    expect(allPhp).not.toContain("execute([...$data");
    expect(allPhp).toContain("strpos($checkoutBase, '?') === false");
    expect(allPhp).toContain('<html lang="<?= h($htmlLang) ?>">');
    expect(artifact.files.find((file) => file.path === "README.md")?.content).toContain("PHP 7.4+");
  });

  it("sanitizes developer terms from public storefront copy", () => {
    const artifact = buildPhpSqliteArtifact({
      plan: {
        ...PLAN,
        hero_headline: "Салон красоты PHP SQLite backend",
        hero_subheadline: "Checkout и webhook для заявок",
        cta_primary: "Checkout now",
        cta_microcopy: "PDO + CSRF + backend",
        key_benefits: [
          { title: "PHP backend", description: "Checkout stores request in SQLite" },
          { title: "Webhook", description: "PDO saves status" },
          { title: "CRUD", description: "Admin backend controls products" },
        ],
      },
      userMessage: "backend test",
    });
    const index = artifact.files.find((file) => file.path === "public/index.php")?.content ?? "";

    expect(index).not.toContain("Салон красоты PHP SQLite backend");
    expect(index).not.toContain("Checkout и webhook");
    expect(index).not.toContain("PDO + CSRF");
    expect(index).not.toContain("Checkout now");
    expect(index).not.toContain("из через");
  });

  it("renders an HTML preview with embedded manifest JSON", () => {
    const artifact = buildPhpSqliteArtifact({
      plan: PLAN,
      userMessage: "нужен магазин на php sqlite с товарами и оплатой",
    });
    const html = renderPhpSqliteArtifactPreview({
      artifact,
      plan: PLAN,
      userMessage: "нужен магазин на php sqlite с товарами и оплатой",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('id="nit-artifact-manifest"');
    expect(html).toContain("php-sqlite-app");
    expect(html).toContain("магазин аксессуаров: PHP + SQLite backend");
    expect(html).not.toContain("<h1>Аксессуары с быстрой доставкой</h1>");
    expect(html).toContain("public/index.php");
  });

  it("can materialize the generated project as real files on disk", async () => {
    const artifact = buildPhpSqliteArtifact({
      plan: PLAN,
      userMessage: "нужен магазин на php sqlite с товарами и оплатой",
    });
    const root = await mkdtemp(join(tmpdir(), "nit-php-artifact-"));

    for (const file of artifact.files) {
      const target = join(root, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content);
    }

    const indexPhp = await readFile(join(root, "public/index.php"), "utf8");
    const paymentsPhp = await readFile(join(root, "app/payments.php"), "utf8");
    const sqliteSchema = await readFile(join(root, "database/schema.sqlite.sql"), "utf8");
    const mysqlSchema = await readFile(join(root, "database/schema.mysql.sql"), "utf8");
    const htaccess = await readFile(join(root, "public/.htaccess"), "utf8");

    expect(indexPhp).toContain("function products(): array");
    expect(indexPhp).toContain("/admin/product/save");
    expect(indexPhp).toContain("/admin/order/status");
    expect(paymentsPhp).toContain("create_checkout_session");
    expect(paymentsPhp).toContain("handle_payment_webhook");
    expect(sqliteSchema).toContain("CREATE TABLE IF NOT EXISTS order_items");
    expect(mysqlSchema).toContain("ENGINE=InnoDB");
    expect(htaccess).toContain("RewriteEngine On");
  });
});
