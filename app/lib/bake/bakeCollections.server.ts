/**
 * bakeCollections — детерминированный пост-процессор коллекций (Tier 6).
 *
 * НА ВХОДЕ: HTML от Coder-а с разметкой коллекций и PlanCollection[] из плана:
 *   - контейнер списка:  data-collection="<id>"
 *   - карточка-образец:  data-item (ровно одна внутри контейнера)
 *   - поля образца:      data-field="<field_id>"
 *
 * НА ВЫХОДЕ:
 *   - html — HTML где содержимое контейнера заменено на текстовые МАРКЕРЫ
 *     цикла и полей (НЕ живой PHP — см. ниже почему)
 *   - markers — словарь маркер → PHP-выражение; bundle подставляет их
 *     string-replace-ом В САМОМ КОНЦЕ, уже после bakeHtmlToPhp
 *   - collectionsData — содержимое для data/collections.json: схема полей +
 *     первая запись, собранная из дефолтных значений образца
 *   - matched/missing — для логов и будущего repair-цикла Coder-а
 *
 * ПОЧЕМУ МАРКЕРЫ, А НЕ ЖИВОЙ PHP:
 * результат этого модуля дальше попадает в bakeHtmlToPhp (зоны), который
 * снова парсит HTML через node-html-parser. Живые `<?php ?>` вставки парсер
 * обрабатывает непредсказуемо (XML processing instruction). Текстовые маркеры
 * переживают повторный parse без потерь — приём идентичен htmlToPhp.server.ts.
 *
 * ДОПУЩЕНИЕ MVP: контейнер data-collection содержит ТОЛЬКО карточку-образец
 * (так требует buildCollectionsHint). Всё содержимое контейнера заменяется
 * циклом; статические соседи образца внутри контейнера не поддерживаются.
 *
 * Поле, не найденное в образце (или image не на <img>), попадает в
 * missingFields: оно останется статикой образца и не будет редактируемым.
 * Коллекция при этом живёт — отсутствие одной колонки не ломает таблицу.
 *
 * Модуль не вызывает LLM, не ходит в сеть, не имеет стохастики.
 * Модуль .server.ts — только для server-side кода.
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { PlanCollection, PlanCollectionField } from "~/lib/utils/planSchema";
import { phpSingleQuote } from "./htmlToPhp.server";

export type CollectionData = {
  /** Схема колонок — копия из плана, для рендера форм в admin/data.php. */
  fields: PlanCollectionField[];
  /** Записи. При бандле — одна, собранная из дефолтов образца. */
  rows: Array<Record<string, string>>;
};

export type CollectionsBakeResult = {
  /** HTML с маркерами цикла/полей вместо размеченных коллекций. */
  html: string;
  /** Маркер → PHP-выражение. Подставлять string-replace-ом после bakeHtmlToPhp. */
  markers: Record<string, string>;
  /** Данные для data/collections.json (key = collection id). */
  collectionsData: Record<string, CollectionData>;
  /** Коллекции, найденные и преобразованные. */
  matchedCollections: PlanCollection[];
  /** Коллекции из плана, для которых Coder не разметил контейнер или образец. */
  missingCollections: PlanCollection[];
  /** Поля, не найденные внутри образца (или image не на <img>). */
  missingFields: Array<{ collection: string; field: string }>;
};

/** Уникальный nonce маркеров на вызов — как bake-id в htmlToPhp. */
function generateBakeId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

/**
 * Основная функция: преобразовать размеченные коллекции в маркеры PHP-цикла
 * и собрать стартовые данные для collections.json.
 */
export function bakeCollections(
  html: string,
  collections: PlanCollection[],
): CollectionsBakeResult {
  const root = parse(html, {
    lowerCaseTagName: false,
    comment: true,
    voidTag: {
      tags: [
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
      ],
      closingSlash: true,
    },
  });

  const markers: Record<string, string> = {};
  const collectionsData: Record<string, CollectionData> = {};
  const matchedCollections: PlanCollection[] = [];
  const missingCollections: PlanCollection[] = [];
  const missingFields: Array<{ collection: string; field: string }> = [];

  const bakeId = generateBakeId();
  // Порядковый префикс на каждый маркер. id коллекции и поля состоят из
  // [a-z0-9_], поэтому суффикс "<col>_<field>" сам по себе неоднозначен:
  // collection "menu"+field "item_price" и collection "menu_item"+field "price"
  // дали бы ОДИН маркер → перетёрлись бы в словаре и склеили данные разных
  // коллекций. Счётчик гарантирует уникальность независимо от содержимого id.
  let markerSeq = 0;
  const makeMarker = (kind: string, suffix: string): string =>
    `__NIT_COL_${bakeId}_${markerSeq++}_${kind}_${suffix}__`;

  for (const collection of collections) {
    // id валидирован Zod-регэкспом [a-z][a-z0-9_]* — безопасен и в селекторе,
    // и в PHP single-quoted литерале.
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

    const row: Record<string, string> = {};

    for (const field of collection.fields) {
      const node = item.querySelector(
        `[data-field="${field.id}"]`,
      ) as HTMLElement | null;
      if (!node) {
        missingFields.push({ collection: collection.id, field: field.id });
        continue;
      }

      const marker = makeMarker("F", `${collection.id}_${field.id}`);
      const itemExpr = `$item[${phpSingleQuote(field.id)}]`;

      if (field.type === "image") {
        if (node.tagName !== "IMG") {
          missingFields.push({ collection: collection.id, field: field.id });
          continue;
        }
        const defaultSrc = node.getAttribute("src") ?? "";
        row[field.id] = defaultSrc;
        markers[marker] = `<?= e(${itemExpr} ?? ${phpSingleQuote(defaultSrc)}) ?>`;
        node.setAttribute("src", marker);
      } else if (field.type === "richtext") {
        const defaultHtml = node.innerHTML.trim();
        row[field.id] = defaultHtml;
        // richtext не экранируем — это HTML; sanitize на сохранении в админке.
        markers[marker] = `<?= ${itemExpr} ?? ${phpSingleQuote(defaultHtml)} ?>`;
        node.set_content(marker);
      } else {
        // text | price | number — плоская строка, вложенные теги схлопываются.
        const defaultText = node.text.trim();
        row[field.id] = defaultText;
        markers[marker] = `<?= e(${itemExpr} ?? ${phpSingleQuote(defaultText)}) ?>`;
        node.set_content(marker);
      }
    }

    // Зачистка служебных атрибутов внутри образца (включая поля, которых
    // нет в плане — мусор Coder-а не должен утекать в прод-HTML).
    for (const fieldNode of item.querySelectorAll("[data-field]")) {
      (fieldNode as HTMLElement).removeAttribute("data-field");
    }
    item.removeAttribute("data-item");
    container.removeAttribute("data-collection");

    // Оборачиваем образец в маркеры цикла. set_content парсит строку как HTML:
    // маркеры (plain text) и образец с маркерами полей переживают это без потерь.
    const openMarker = makeMarker("O", collection.id);
    const closeMarker = makeMarker("C", collection.id);
    markers[openMarker] =
      `<?php foreach (nit_collection(${phpSingleQuote(collection.id)}) as $item): ?>`;
    markers[closeMarker] = `<?php endforeach; ?>`;
    container.set_content(`${openMarker}${item.toString()}${closeMarker}`);

    collectionsData[collection.id] = {
      fields: collection.fields,
      rows: [row],
    };
    matchedCollections.push(collection);
  }

  return {
    html: root.toString(),
    markers,
    collectionsData,
    matchedCollections,
    missingCollections,
    missingFields,
  };
}

/**
 * Подставить маркеры коллекций в финальный PHP-текст. Вызывается из bundle
 * ПОСЛЕ bakeHtmlToPhp — когда HTML уже не будет парситься повторно.
 */
export function applyCollectionMarkers(
  phpText: string,
  markers: Record<string, string>,
): string {
  let out = phpText;
  for (const [marker, expr] of Object.entries(markers)) {
    out = out.split(marker).join(expr);
  }
  return out;
}
