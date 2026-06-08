import { describe, expect, it } from "vitest";
import { inferArtifactModeFromPrompt } from "~/lib/utils/artifactMode";

describe("inferArtifactModeFromPrompt", () => {
  it("detects PHP backend prompts", () => {
    expect(inferArtifactModeFromPrompt("магазин на PHP SQLite с товарами и оплатой")).toBe("php-sqlite");
    expect(inferArtifactModeFromPrompt("backend on PHP MySQL with admin checkout payments")).toBe("php-sqlite");
    expect(inferArtifactModeFromPrompt("бэкенд на пхп с заказами и админкой")).toBe("php-sqlite");
  });

  it("does not force backend mode for regular HTML prompts", () => {
    expect(inferArtifactModeFromPrompt("сделай лендинг для кофейни")).toBeUndefined();
    expect(inferArtifactModeFromPrompt("добавь товары в HTML секцию без backend")).toBeUndefined();
    expect(inferArtifactModeFromPrompt("admin dashboard design in static HTML")).toBeUndefined();
  });

  it("включает бэкенд по смыслу намерения — без слова PHP", () => {
    expect(inferArtifactModeFromPrompt("интернет-магазин с каталогом товаров и корзиной")).toBe("php-sqlite");
    expect(inferArtifactModeFromPrompt("сделай сайт и добавь админку для управления товарами")).toBe("php-sqlite");
    expect(inferArtifactModeFromPrompt("сайт, где можно принимать заказы клиентов")).toBe("php-sqlite");
    expect(inferArtifactModeFromPrompt("нужен личный кабинет для клиентов")).toBe("php-sqlite");
  });

  it("оставляет статический лендинг для промо без серверной логики", () => {
    expect(inferArtifactModeFromPrompt("магазин одежды, красивая витрина")).toBeUndefined();
    expect(inferArtifactModeFromPrompt("лендинг для кофейни с меню")).toBeUndefined();
    expect(inferArtifactModeFromPrompt("портфолио фотографа с галереей")).toBeUndefined();
  });
});
