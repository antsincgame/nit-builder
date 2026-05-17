#!/usr/bin/env node
/**
 * sync-version.mjs — синхронизирует version из package.json в shared/src/version.ts.
 *
 * Запускается автоматически через npm-hook "version" при `npm version`:
 *   1. preversion       (если есть)
 *   2. bump version в package.json
 *   3. этот скрипт → обновляет shared/src/version.ts
 *   4. git add shared/src/version.ts (второй chained command в npm script)
 *   5. создаются commit и tag (всё в одном атомарном шаге)
 *   6. postversion      (если есть)
 *
 * Зачем это нужно: NIT_SERVER_VERSION выводится в server log на старте и прописывается
 * в hello-message tunnel-протокола. Раньше синхронизация была ручной (комментарий в
 * version.ts честно признавался в этом), и при забывчивом bumpе package.json
 * версии расходились — клиенты могли получить wrong-version reject не там где
 * надо.
 *
 * NIT_TUNNEL_CLIENT_VERSION живёт по своему циклу (отдельный релиз desktop-клиента) —
 * её не трогаем.
 *
 * .mjs а не .ts — чтобы не зависеть от tsx/typecheck в хуке, который будет
 * вызываться при любом npm version (включая от release-botа в CI без разработчичьего
 * окружения).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const pkgPath = join(rootDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const newVersion = pkg.version;
if (typeof newVersion !== "string" || newVersion.length === 0) {
  console.error("[sync-version] package.json has no version field");
  process.exit(1);
}

const versionFilePath = join(rootDir, "shared/src/version.ts");
const content = readFileSync(versionFilePath, "utf8");

// Не трогаем NIT_TUNNEL_CLIENT_VERSION — у desktop-клиента свой релиз-цикл.
const NIT_SERVER_RE =
  /export const NIT_SERVER_VERSION = "[^"]+" as const;/;

if (!NIT_SERVER_RE.test(content)) {
  console.error(
    "[sync-version] NIT_SERVER_VERSION decl not found in shared/src/version.ts. " +
    "\u0415сли ты переименовал/переформатировал константу — подправь NIT_SERVER_RE здесь.",
  );
  process.exit(1);
}

const updated = content.replace(
  NIT_SERVER_RE,
  `export const NIT_SERVER_VERSION = "${newVersion}" as const;`,
);

if (updated === content) {
  console.log(`[sync-version] уже актуально: ${newVersion}`);
  process.exit(0);
}

writeFileSync(versionFilePath, updated);
console.log(`[sync-version] shared/src/version.ts → ${newVersion}`);
