import { describe, expect, it } from "vitest";
import {
  artifactDownloadName,
  buildStoredZipBlob,
  extractPhpSqliteArtifact,
  isPhpSqliteArtifactHtml,
} from "~/lib/utils/artifactExport";
import {
  buildPhpSqliteArtifact,
  renderPhpSqliteArtifactPreview,
} from "~/lib/services/phpSqliteArtifactBuilder";
import type { Plan } from "~/lib/utils/planSchema";

const PLAN: Plan = {
  business_type: "магазин сумок",
  target_audience: "покупатели",
  tone: "строгий",
  style_hints: "",
  color_mood: "light-minimal",
  sections: ["hero", "products", "admin"],
  keywords: ["товары", "корзина"],
  cta_primary: "Купить",
  language: "ru",
  suggested_template_id: "blank-landing",
};

describe("artifactExport", () => {
  it("extracts php-sqlite manifest from preview HTML", () => {
    const artifact = buildPhpSqliteArtifact({ plan: PLAN, userMessage: "магазин php sqlite" });
    const html = renderPhpSqliteArtifactPreview({
      artifact,
      plan: PLAN,
      userMessage: "магазин php sqlite",
    });

    expect(isPhpSqliteArtifactHtml(html)).toBe(true);
    expect(extractPhpSqliteArtifact(html)?.kind).toBe("php-sqlite-app");
    expect(extractPhpSqliteArtifact("<html></html>")).toBeNull();
  });

  it("builds a stored zip blob with expected signatures", async () => {
    const artifact = buildPhpSqliteArtifact({ plan: PLAN, userMessage: "магазин php sqlite" });
    const blob = buildStoredZipBlob(artifact.files, new Date("2026-01-01T00:00:00Z"));
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toBe("application/zip");
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    expect(new TextDecoder().decode(bytes)).toContain("router.php");
    expect(new TextDecoder().decode(bytes)).toContain("public/index.php");
    expect(new TextDecoder().decode(bytes)).toContain("public/.htaccess");
    expect(new TextDecoder().decode(bytes)).toContain("database/schema.sqlite.sql");
    expect(new TextDecoder().decode(bytes)).toContain("database/schema.mysql.sql");
  });

  it("uses project title in zip filename", () => {
    const artifact = buildPhpSqliteArtifact({ plan: PLAN, userMessage: "магазин php sqlite" });
    expect(artifactDownloadName(artifact)).toContain("магазин-сумок");
    expect(artifactDownloadName(artifact)).toMatch(/\.zip$/);
  });
});
