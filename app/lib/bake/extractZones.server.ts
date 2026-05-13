/**
 * Извлечение PlanEditableZone[] напрямую из HTML по data-edit-* атрибутам.
 *
 * Зачем: useGenerationFlow на клиенте НЕ хранит plan (Coder возвращает только
 * HTML, план остаётся на сервере во время пайплайна). Чтобы /api/bundle/php
 * мог работать с одним только HTML на входе — извлекаем зоны из самой
 * разметки. Coder уже расставил все три атрибута:
 *
 *   <h1 data-edit="hero_title" data-edit-type="text" data-edit-label="Заголовок hero">...</h1>
 *
 * Этого хватит для bakeHtmlToPhp + рендера админки. section извлекаем
 * best-effort из ближайшего родителя с id (или фолбэк "general") —
 * критично только для группировки в dashboard, не для самой выпечки.
 *
 * Невалидные/дубликаты id молча отбрасываются (логгером выше можно посмотреть).
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { PlanEditableZone } from "~/lib/utils/planSchema";

const ID_RE = /^[a-z][a-z0-9_]{1,39}$/;
const VALID_TYPES = new Set(["text", "richtext", "image"] as const);
type ValidType = "text" | "richtext" | "image";

/** Подняться вверх по дереву до ближайшего предка с непустым id. */
function findSectionId(node: HTMLElement): string {
  let cur: HTMLElement | null = node.parentNode as HTMLElement | null;
  while (cur) {
    const id = cur.getAttribute?.("id");
    if (id && id.trim()) return id.trim().slice(0, 50);
    cur = (cur.parentNode as HTMLElement | null) ?? null;
  }
  return "general";
}

/**
 * Извлечь все размеченные зоны из HTML.
 *
 * Возвращает массив с дедупликацией по id (первое вхождение побеждает).
 * Не бросает на невалидном HTML — node-html-parser терпим к ошибкам.
 */
export function extractZonesFromHtml(html: string): PlanEditableZone[] {
  if (!html || !html.includes("data-edit")) return [];

  const root = parse(html, { lowerCaseTagName: false, comment: false });
  const nodes = root.querySelectorAll("[data-edit]");

  const seen = new Set<string>();
  const zones: PlanEditableZone[] = [];

  for (const node of nodes) {
    const id = (node.getAttribute("data-edit") ?? "").trim();
    const typeRaw = (node.getAttribute("data-edit-type") ?? "").trim();
    const label = (node.getAttribute("data-edit-label") ?? "").trim();

    if (!ID_RE.test(id)) continue;
    if (seen.has(id)) continue;
    if (!VALID_TYPES.has(typeRaw as ValidType)) continue;
    if (label.length < 2) continue;

    seen.add(id);
    zones.push({
      id,
      type: typeRaw as ValidType,
      label: label.slice(0, 80),
      section: findSectionId(node),
    });
  }

  return zones;
}
