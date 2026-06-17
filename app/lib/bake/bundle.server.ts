/**
 * Сборка ZIP-бандла «standalone HTML + PHP-админка».
 *
 * Flow:
 *   1. compileTailwindForHtml — компилим Tailwind на исходном HTML (до PHP-вставок,
 *      иначе сканер увидит '<?= e($c[...]) ?>' как мусор и не извлечёт классы).
 *   2. inlineCompiledCss — встраиваем <style> в <head>, убираем CDN-скрипт.
 *   3. bakeCollections — заменяем размеченные коллекции (data-collection /
 *      data-item / data-field) на текстовые МАРКЕРЫ цикла и полей, собираем
 *      стартовые данные для data/collections.json. Маркеры, не живой PHP —
 *      следующий шаг парсит HTML повторно.
 *   4. bakeHtmlToPhp — заменяем размеченные зоны (data-edit) на PHP-подстановки,
 *      возвращает дефолты для data/defaults.json.
 *   5. applyCollectionMarkers — подставляем PHP-выражения коллекций в финальный
 *      текст (HTML больше не парсится — живой PHP безопасен).
 *   6. readDirRecursive(app/templates/admin-php/) — читаем статичный PHP-template.
 *   7. JSZip — собираем итоговый архив, переименовывая setup.php в setup-<nonce>.php.
 *
 * РАНДОМИЗАЦИЯ setup-ФАЙЛА (защита от first-come-first-served race на свежем деплое):
 * setup.php имеет окно «файла data/users.json ещё нет → любой POST создаст админа».
 * При фиксированном имени файла атакующий с быстрым ботом, обнаружив свежий
 * домен с /setup.php, мог зарегистрироваться раньше владельца. Теперь имя
 * генерируется как `setup-<8hex>.php` через CSPRNG (4.3 млрд комбинаций),
 * атакующий не угадает за реалистичное время. Юзер получает имя в
 * response header X-Bundle-Setup-File и видит его в toast после download.
 * В архиве README.md и сам setup-файл переписываются с новым именем.
 *
 * Модуль .server.ts — только для server-side контекста (route loaders/actions).
 */
import JSZip from "jszip";
import fs from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bakeHtmlToPhp } from "./htmlToPhp.server";
import { bakeCollections, applyCollectionMarkers } from "./bakeCollections.server";
import {
  bakeStandaloneHtml,
  compileTailwindForHtml,
  inlineCompiledCss,
} from "./compileTailwind.server";
import { localizeImagesToAssets } from "./localizeImages.server";
import type { PlanCollection, PlanEditableZone } from "~/lib/utils/planSchema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Двойной путь как в htmlTemplates.server.ts — dev и prod build могут
// дать разные относительные пути; берём первый существующий.
const ADMIN_TEMPLATE_CANDIDATES = [
  path.resolve(__dirname, "../../templates/admin-php"),
  path.resolve(process.cwd(), "app/templates/admin-php"),
];

function resolveAdminTemplateDir(): string {
  for (const candidate of ADMIN_TEMPLATE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `admin-php template not found in any of: ${ADMIN_TEMPLATE_CANDIDATES.join(", ")}`,
  );
}

/**
 * Сгенерировать рандомное имя setup-файла. 8 hex-символов из CSPRNG.
 * Формат: setup-a3f8b9c2.php
 */
export function generateSetupFilename(): string {
  return `setup-${randomBytes(4).toString("hex")}.php`;
}

export type BundlePhpInput = {
  html: string;
  zones: PlanEditableZone[];
  /** Коллекции из плана (Tier 6). Опционально — старые вызовы без них. */
  collections?: PlanCollection[];
};

export type BundlePhpResult = {
  zip: Uint8Array;
  matchedZones: PlanEditableZone[];
  missingZones: PlanEditableZone[];
  /** Коллекции, найденные и обёрнутые в PHP-цикл. */
  matchedCollections: PlanCollection[];
  /** Коллекции из плана, не размеченные Coder-ом (контейнер/образец не найден). */
  missingCollections: PlanCollection[];
  /** Поля коллекций, не найденные в образце (останутся статикой). */
  missingCollectionFields: Array<{ collection: string; field: string }>;
  sizeBytes: number;
  /** Имя setup-файла в архиве (рандомизировано, см. doc сверху модуля). */
  setupFilename: string;
  /** Сколько внешних картинок скачано в assets/images/. */
  imagesEmbedded: number;
  /** Сколько картинок остались внешними ссылками. */
  imagesFailed: number;
};

export type BundleStaticSiteResult = {
  zip: Uint8Array;
  sizeBytes: number;
  imagesEmbedded: number;
  imagesFailed: number;
};

/**
 * Рекурсивный обход директории — собирает относительные пути и содержимое всех файлов.
 * Игнорирует символические ссылки (защита от циклов).
 */
async function readDirRecursive(
  root: string,
): Promise<Array<{ relPath: string; content: Buffer }>> {
  const out: Array<{ relPath: string; content: Buffer }> = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        const relPath = path.relative(root, full).replaceAll("\\", "/");
        const content = await readFile(full);
        out.push({ relPath, content });
      }
    }
  }
  await walk(root);
  return out;
}

/**
 * Главная функция: собрать ZIP с PHP-админкой по сгенерированному HTML,
 * зонам и коллекциям из плана.
 */
export async function bundleStaticSiteZip(html: string): Promise<BundleStaticSiteResult> {
  const baked = await bakeStandaloneHtml(html);
  const localized = await localizeImagesToAssets(baked);

  const zip = new JSZip();
  zip.file("index.html", localized.html);
  for (const file of localized.files) {
    zip.file(file.path, file.content);
  }

  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    zip: buffer,
    sizeBytes: buffer.length,
    imagesEmbedded: localized.embedded,
    imagesFailed: localized.failed,
  };
}

export async function bundlePhp(
  input: BundlePhpInput,
): Promise<BundlePhpResult> {
  // 1+2. Tailwind compile + inline (на исходном HTML — классы образцов
  // коллекций сканируются до любых маркерных замен).
  const css = await compileTailwindForHtml(input.html);
  const htmlWithCss = inlineCompiledCss(input.html, css);

  // 2b. Внешние картинки → assets/images/* до PHP-bake, чтобы defaults/content.json
  //     и src в index.php ссылались на локальные файлы, а не Unsplash.
  const localized = await localizeImagesToAssets(htmlWithCss);
  const htmlForBake = localized.html;

  // 3. Коллекции → маркеры цикла/полей + стартовые данные. Идёт ДО зон:
  // выход снова парсится в bakeHtmlToPhp, текстовые маркеры это переживают.
  const colBake = bakeCollections(htmlForBake, input.collections ?? []);

  // 4. PHP baker зон (понимает уже встроенный CSS, не трогает <style>).
  const baked = bakeHtmlToPhp(colBake.html, input.zones);

  // 5. Финальная подстановка PHP-выражений коллекций — HTML дальше не парсится.
  const phpIndex = applyCollectionMarkers(baked.phpIndex, colBake.markers);

  // 6. Admin template — статичные файлы.
  const templateDir = resolveAdminTemplateDir();
  const adminFiles = await readDirRecursive(templateDir);

  // Рандомизация имени setup-файла — защита от race-окна на свежем деплое.
  // Файлы где надо подменить упоминание "setup.php":
  //   - setup.php (его самого) — текстовые подсказки юзеру внутри HTML/PHP
  //   - README.md — инструкции по установке и описание структуры архива
  // Подмена через .replaceAll — литеральная, в коде admin-php "setup.php"
  // встречается только в user-facing строках, не в server-side путях.
  const setupFilename = generateSetupFilename();
  const rewriteSetupRefs = (content: Buffer): Buffer =>
    Buffer.from(content.toString("utf8").replaceAll("setup.php", setupFilename), "utf8");

  // 7. Собираем ZIP.
  const zip = new JSZip();
  zip.file("index.php", phpIndex);
  for (const f of adminFiles) {
    if (f.relPath === "setup.php") {
      // Кладём под рандомным именем, content переписываем тоже.
      zip.file(setupFilename, rewriteSetupRefs(f.content));
    } else if (f.relPath === "README.md") {
      zip.file(f.relPath, rewriteSetupRefs(f.content));
    } else {
      zip.file(f.relPath, f.content);
    }
  }
  // Дефолтный контент идёт в оба файла:
  //   - defaults.json (read-only reference, не трогать)
  //   - content.json (стартовое состояние, потом мутируется через админку)
  const defaultsJson = JSON.stringify(baked.defaults, null, 2);
  zip.file("data/defaults.json", defaultsJson);
  zip.file("data/content.json", defaultsJson);
  // zones.json — только те зоны, которые baker реально нашёл в HTML.
  // Зоны из плана, но не размеченные Coder-ом, попадают в логи, но не в админку:
  // юзер не сможет редактировать то, чего нет.
  zip.file(
    "data/zones.json",
    JSON.stringify(baked.matchedZones, null, 2),
  );
  // collections.json — схема колонок + стартовая запись из образца на каждую
  // найденную коллекцию. Пишем всегда (пустой объект если коллекций нет):
  // admin/data.php по нему решает, показывать ли раздел «Данные».
  zip.file(
    "data/collections.json",
    JSON.stringify(colBake.collectionsData, null, 2),
  );
  for (const file of localized.files) {
    zip.file(file.path, file.content);
  }

  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    zip: buffer,
    matchedZones: baked.matchedZones,
    missingZones: baked.missingZones,
    matchedCollections: colBake.matchedCollections,
    missingCollections: colBake.missingCollections,
    missingCollectionFields: colBake.missingFields,
    sizeBytes: buffer.length,
    setupFilename,
    imagesEmbedded: localized.embedded,
    imagesFailed: localized.failed,
  };
}
