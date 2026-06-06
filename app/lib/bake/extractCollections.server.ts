/**
 * extractCollectionsFromHtml — восстановление схемы коллекций из самодостаточной
 * разметки (Tier 6). Зеркало extractZones: фронт шлёт в бандл-роут только
 * html (туннельный WS-протокол план в браузер не передаёт), поэтому label
 * контейнера и type/label полей живут в самих data-атрибутах.
 *
 * Формат разметки (расставляет Coder по buildCollectionsHint):
 *   <div data-collection="cakes" data-collection-label="Торты">
 *     <article data-item>
 *       <img data-field="photo" data-field-type="image" data-field-label="Фото" ...>
 *       <h3 data-field="name" data-field-type="text" data-field-label="Название">…</h3>
 *
 * Дефолты при неполной разметке: label контейнера/поля → id; невалидный
 * или отсутствующий data-field-type → "text" (мягко: лучше текстовая колонка,
 * чем потерянная; аудит+repair в пайплайне стараются этого не допускать, но
 * extract — фоллбек последней мили и не имеет права ронять бандл).
 *
 * section в разметке не живёт и бейкеру не нужен (контейнер ищется по id
 * в DOM) — заполняем плейсхолдером "auto" ради совместимости с PlanCollection.
 *
 * Валидация id — те же регэкспы, что в CollectionSchema: битые id и дубли
 * скипаются молча, бейкер их всё равно не смог бы обработать.
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { PlanCollection, PlanCollectionField } from "~/lib/utils/planSchema";

const ID_RE = /^[a-z][a-z0-9_]{1,39}$/;
const FIELD_TYPES = new Set(["text", "richtext", "image", "price", "number"]);
const MAX_COLLECTIONS = 5;
const MAX_FIELDS = 10;

function clampLabel(raw: string | undefined, fallback: string): string {
  const v = (raw ?? "").trim();
  if (v.length < 2) return fallback;
  return v.slice(0, 80);
}

export function extractCollectionsFromHtml(html: string): PlanCollection[] {
  const root = parse(html);
  const containers = root.querySelectorAll("[data-collection]");
  const out: PlanCollection[] = [];
  const seen = new Set<string>();

  for (const container of containers) {
    if (out.length >= MAX_COLLECTIONS) break;
    const id = container.getAttribute("data-collection") ?? "";
    if (!ID_RE.test(id) || seen.has(id)) continue;
    const item = container.querySelector("[data-item]") as HTMLElement | null;
    if (!item) continue;

    const fields: PlanCollectionField[] = [];
    const seenFields = new Set<string>();
    for (const node of item.querySelectorAll("[data-field]")) {
      if (fields.length >= MAX_FIELDS) break;
      const fieldId = node.getAttribute("data-field") ?? "";
      if (!ID_RE.test(fieldId) || seenFields.has(fieldId)) continue;
      const rawType = node.getAttribute("data-field-type") ?? "";
      const type = (FIELD_TYPES.has(rawType) ? rawType : "text") as PlanCollectionField["type"];
      fields.push({
        id: fieldId,
        type,
        label: clampLabel(node.getAttribute("data-field-label") ?? undefined, fieldId),
      });
      seenFields.add(fieldId);
    }
    if (fields.length === 0) continue;

    out.push({
      id,
      label: clampLabel(container.getAttribute("data-collection-label") ?? undefined, id),
      section: "auto",
      fields,
    });
    seen.add(id);
  }

  return out;
}
