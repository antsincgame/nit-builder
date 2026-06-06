<?php
declare(strict_types=1);
require_once __DIR__ . '/e.php';

/**
 * Корень проекта (родитель папки admin/).
 */
function nit_root(): string {
    $r = realpath(__DIR__ . '/../..');
    if ($r === false) {
        throw new RuntimeException('Не удалось определить корень проекта');
    }
    return $r;
}

/**
 * Прочитать актуальный контент.
 *   1) data/content.json (если есть и валиден)
 *   2) data/defaults.json (fallback — то, что выпек baker)
 *   3) пустой массив (последний рубеж)
 */
function nit_load_content(): array {
    $root = nit_root();
    foreach ([$root . '/data/content.json', $root . '/data/defaults.json'] as $path) {
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            if ($raw !== false) {
                $data = json_decode($raw, true);
                if (is_array($data)) return $data;
            }
        }
    }
    return [];
}

/**
 * Атомарная запись контента: пишем в tmp-файл в той же папке, затем rename.
 * rename атомарен на одном FS в POSIX — нет промежуточного состояния разорванного JSON.
 */
function nit_save_content(array $content): bool {
    $root = nit_root();
    $target = $root . '/data/content.json';
    $dir = $root . '/data';
    if (!is_dir($dir) || !is_writable($dir)) return false;
    $tmp = tempnam($dir, '.content_');
    if ($tmp === false) return false;
    $json = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) { @unlink($tmp); return false; }
    if (file_put_contents($tmp, $json) === false) { @unlink($tmp); return false; }
    @chmod($tmp, 0644);
    return @rename($tmp, $target);
}

/**
 * Прочитать список редактируемых зон (id, type, label, section).
 */
function nit_zones(): array {
    $path = nit_root() . '/data/zones.json';
    if (!is_file($path)) return [];
    $raw = @file_get_contents($path);
    if ($raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Найти зону по id. Возвращает массив с ключами id/type/label/section или null.
 */
function nit_zone(string $id): ?array {
    foreach (nit_zones() as $z) {
        if (is_array($z) && (($z['id'] ?? '') === $id)) return $z;
    }
    return null;
}

/* ─── Коллекции (Tier 6): повторяющиеся записи для admin/data.php ───
 *
 * Файл data/collections.json:
 *   { "<collection_id>": { "fields": [{id,label,type}, ...], "rows": [{...}, ...] } }
 *
 * fields — схема колонок из плана (источник правды для форм и таблиц админки);
 * rows — записи, каждая = плоский объект {field_id: строковое значение}.
 * Первую запись кладёт baker из значений элемента-образца.
 *
 * Запись — tempnam+rename, как nit_save_content: атомарность файла гарантирована,
 * read-modify-write гонка двух одновременных админов теоретически возможна
 * (последний выигрывает) — осознанный предел MVP для сайтов с одним владельцем.
 */

/** Прочитать все коллекции. Нет файла / битый JSON → пустой массив. */
function nit_load_collections(): array {
    $path = nit_root() . '/data/collections.json';
    if (!is_file($path)) return [];
    $raw = @file_get_contents($path);
    if ($raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Записи одной коллекции для рендера на сайте (index.php: foreach).
 * Каждая запись гарантированно содержит все ключи схемы (отсутствующие — '');
 * значения приводятся к строкам — PHP-вставки бейкера и e() работают без сюрпризов.
 * Нет коллекции / нет файла (старые бандлы) → пустой массив, секция просто пуста.
 */
function nit_collection(string $id): array {
    $all = nit_load_collections();
    $col = $all[$id] ?? null;
    if (!is_array($col)) return [];
    $rows = is_array($col['rows'] ?? null) ? $col['rows'] : [];
    $fields = is_array($col['fields'] ?? null) ? $col['fields'] : [];
    $keys = [];
    foreach ($fields as $f) {
        if (is_array($f) && is_string($f['id'] ?? null)) $keys[] = $f['id'];
    }
    $out = [];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $clean = [];
        foreach ($keys as $k) {
            $v = $row[$k] ?? '';
            $clean[$k] = is_string($v) ? $v : (is_scalar($v) ? (string)$v : '');
        }
        $out[] = $clean;
    }
    return $out;
}

/**
 * Атомарная запись всех коллекций (tempnam + rename, как nit_save_content).
 */
function nit_save_collections(array $collections): bool {
    $root = nit_root();
    $target = $root . '/data/collections.json';
    $dir = $root . '/data';
    if (!is_dir($dir) || !is_writable($dir)) return false;
    $tmp = tempnam($dir, '.collections_');
    if ($tmp === false) return false;
    $json = json_encode($collections, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) { @unlink($tmp); return false; }
    if (file_put_contents($tmp, $json) === false) { @unlink($tmp); return false; }
    @chmod($tmp, 0644);
    return @rename($tmp, $target);
}
