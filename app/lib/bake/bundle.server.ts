/**
 * Сборка ZIP-бандла «standalone HTML + PHP-админка».
 *
 * Flow:
 *   1. compileTailwindForHtml — компилим Tailwind на исходном HTML (до PHP-вставок,
 *      иначе сканер увидит '<?= e($c[...]) ?>' как мусор и не извлечёт классы).
 *   2. inlineCompiledCss — встраиваем <style> в <head>, убираем CDN-скрипт.
 *   3. bakeHtmlToPhp — заменяем размеченные зоны (data-edit) на PHP-подстановки,
 *      возвращает дефолты для data/defaults.json.
 *   4. readDirRecursive(app/templates/admin-php/) — читаем статичный PHP-template.
 *   5. JSZip — собираем итоговый архив; setup.php кладём под СЛУЧАЙНЫМ именем.
 *
 * Модуль .server.ts — только для server-side контекста (route loaders/actions).
 *
 * ─── Про рандомизацию имени setup.php ──────────────────────────────────────
 *
 * setup.php создаёт первый аккаунт администратора при условии что data/users.json
 * пустой или не существует. После деплоя ZIP'а на хостинг между моментом
 * «файлы залиты» и «юзер открыл setup.php у себя в браузере» есть окно, в которое
 * любой случайный посетитель (или таргетированный бот) может перехватить POST
 * и стать админом — это первый-пришёл-первый-получил race.
 *
 * Раньше имя файла было фиксированным `setup.php` — атакующему достаточно знать
 * домен жертвы и проверять `/setup.php` периодически. Теперь имя содержит
 * 8 hex-символов энтропии (`setup-<8hex>.php`, 2^32 вариантов) и известно только
 * тому, кто реально открывал ZIP. При rate-limit shared hosting'а (десятки
 * запросов/сек) brute-force нереалистичен.
 *
 * 8 hex выбраны как баланс: достаточно для защиты от не-таргетированного скана,
 * не настолько длинно чтобы пугать в имени файла. Если когда-то понадобится
 * больше — поднять SETUP_TOKEN_BYTES.
 */
import { randomBytes } from "node:crypto";
import JSZip from "jszip";
import fs from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bakeHtmlToPhp } from "./htmlToPhp.server";
import { compileTailwindForHtml, inlineCompiledCss } from "./compileTailwind.server";
import type { PlanEditableZone } from "~/lib/utils/planSchema";

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

const SETUP_TOKEN_BYTES = 4; // 8 hex chars = 32 bits of entropy

/** Базовое имя setup-файла в шаблоне — переименовывается на лету в ZIP. */
const SETUP_TEMPLATE_NAME = "setup.php";

/**
 * Сгенерировать имя setup-файла с криптографически случайным токеном.
 *
 * Формат: `setup-<8hex>.php`. Только [a-f0-9] — безопасно во всех файловых
 * системах, URL-encoding не требуется, и regex sanitize в Content-Disposition
 * не тронет.
 */
export function generateSetupFilename(): string {
  const token = randomBytes(SETUP_TOKEN_BYTES).toString("hex");
  return `setup-${token}.php`;
}

export type BundlePhpInput = {
  html: string;
  zones: PlanEditableZone[];
};

export type BundlePhpResult = {
  zip: Uint8Array;
  matchedZones: PlanEditableZone[];
  missingZones: PlanEditableZone[];
  sizeBytes: number;
  /**
   * Имя файла setup'а внутри ZIP. Юзер должен открыть `https://сайт/<setupFilename>`
   * один раз для создания админа, потом удалить файл с сервера.
   * Возвращается клиенту через заголовок `X-Bundle-Setup-File` чтобы UI показал в toast.
   */
  setupFilename: string;
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
 * Главная функция: собрать ZIP с PHP-админкой по сгенерированному HTML и зонам из плана.
 */
export async function bundlePhp(
  input: BundlePhpInput,
): Promise<BundlePhpResult> {
  // 1+2. Tailwind compile + inline.
  const css = await compileTailwindForHtml(input.html);
  const htmlWithCss = inlineCompiledCss(input.html, css);

  // 3. PHP baker (понимает уже встроенный CSS, не трогает <style>).
  const baked = bakeHtmlToPhp(htmlWithCss, input.zones);

  // 4. Admin template — статичные файлы.
  const templateDir = resolveAdminTemplateDir();
  const adminFiles = await readDirRecursive(templateDir);

  // 5. Уникальное имя setup-файла на каждый бандл.
  const setupFilename = generateSetupFilename();

  // 6. Собираем ZIP.
  const zip = new JSZip();
  zip.file("index.php", baked.phpIndex);
  for (const f of adminFiles) {
    // setup.php в шаблоне переименовываем на лету. Содержимое не трогаем —
    // setup.php сам определяет своё имя через basename(__FILE__) при выводе
    // сообщений «удали этот файл».
    const targetPath = f.relPath === SETUP_TEMPLATE_NAME ? setupFilename : f.relPath;
    zip.file(targetPath, f.content);
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
  // Пустой assets/uploads/ создаём с .htaccess (уже есть в template) + .gitkeep
  // на случай если в шаблоне путь без файлов — JSZip не создаёт пустые папки.

  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    zip: buffer,
    matchedZones: baked.matchedZones,
    missingZones: baked.missingZones,
    sizeBytes: buffer.length,
    setupFilename,
  };
}
