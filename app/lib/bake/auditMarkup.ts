/**
 * auditAdminMarkup — статический аудит админ-разметки без преобразований (Tier 6,
 * опора repair-цикла Кодера).
 *
 * Проверяет, что HTML от Кодера содержит всю разметку, которую
 * задекларировал план:
 *   - каждая зона из editable_zones → узел [data-edit="<id>"]
 *   - каждая коллекция → контейнер [data-collection="<id>"] с карточкой
 *     [data-item] внутри
 *   - каждое поле коллекции → [data-field="<id>"] внутри образца
 *     (image-поле — строго на <img>, как требует бейкер)
 *
 * Логика поиска идентична htmlToPhp/bakeCollections — что проходит аудит,
 * то испечётся без missing*. Но в отличие от бейкеров ничего не меняет и
 * не строит PHP — дёшевый чистый проход для пайплайна генерации:
 * сгенерил → audit → если !ok → один repair-раунд Кодера со списком
 * промахов → повторный audit.
 *
 * Без .server-суффикса намеренно: node-html-parser изоморфен, функция
 * чистая — можно дёргать и из пайплайнов, и из тестов, и из eval.
 */
import { parse, type HTMLElement } from "node-html-parser";
import type {
  PlanCollection,
  PlanCollectionField,
  PlanEditableZone,
} from "~/lib/utils/planSchema";

export type MissingCollectionField = {
  collection: PlanCollection;
  field: PlanCollectionField;
};

export type AdminMarkupAudit = {
  /** true — вся задекларированная разметка на месте, repair не нужен. */
  ok: boolean;
  /** Зоны без узла [data-edit]. */
  missingZones: PlanEditableZone[];
  /** Коллекции без контейнера или без карточки-образца внутри. */
  missingCollections: PlanCollection[];
  /** Поля, не найденные в образце найденной коллекции (или image не на <img>). */
  missingFields: MissingCollectionField[];
};

/**
 * Статически проверить админ-разметку HTML против деклараций плана.
 * Пустые zones+collections → всегда ok (статичный сайт, проверять нечего).
 */
export function auditAdminMarkup(
  html: string,
  zones: PlanEditableZone[],
  collections: PlanCollection[],
): AdminMarkupAudit {
  const missingZones: PlanEditableZone[] = [];
  const missingCollections: PlanCollection[] = [];
  const missingFields: MissingCollectionField[] = [];

  if (zones.length === 0 && collections.length === 0) {
    return { ok: true, missingZones, missingCollections, missingFields };
  }

  const root = parse(html);

  for (const zone of zones) {
    // id валидирован Zod-регэкспом [a-z][a-z0-9_]* — безопасен в селекторе.
    const node = root.querySelector(`[data-edit="${zone.id}"]`);
    if (!node) missingZones.push(zone);
  }

  for (const collection of collections) {
    const container = root.querySelector(
      `[data-collection="${collection.id}"]`,
    ) as HTMLElement | null;
    if (!container) {
      missingCollections.push(collection);
      continue;
    }
    const item = container.querySelector("[data-item]") as HTMLElement | null;
    if (!item) {
      missingCollections.push(collection);
      continue;
    }
    for (const field of collection.fields) {
      const node = item.querySelector(
        `[data-field="${field.id}"]`,
      ) as HTMLElement | null;
      if (!node) {
        missingFields.push({ collection, field });
        continue;
      }
      if (field.type === "image" && node.tagName?.toUpperCase() !== "IMG") {
        missingFields.push({ collection, field });
      }
    }
  }

  return {
    ok:
      missingZones.length === 0 &&
      missingCollections.length === 0 &&
      missingFields.length === 0,
    missingZones,
    missingCollections,
    missingFields,
  };
}
