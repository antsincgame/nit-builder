<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/store.php';
require_once __DIR__ . '/lib/csrf.php';
nit_require_auth();

/**
 * Данные (Tier 6): табличный браузер коллекций.
 *
 * Режимы:
 *   data.php                  — список коллекций
 *   data.php?c=<id>           — таблица записей коллекции
 *   data.php?c=<id>&csv=1     — экспорт CSV (BOM + ';' под русский Excel)
 *   data.php?c=<id>&row=new   — форма новой записи
 *   data.php?c=<id>&row=<N>   — форма редактирования записи N
 *
 * POST: action=save (row=new|N) | action=delete (row=N), всё под CSRF.
 * Схема колонок — fields из data/collections.json (кладёт baker из плана);
 * чужие ключи в запись попасть не могут: поля собираются строго по схеме.
 */

const NIT_MAX_ROWS = 200;          // guard от распухания JSON
const NIT_TEXT_LIMIT = 500;        // как у зон type=text
const NIT_RICHTEXT_LIMIT = 10000;  // как у зон type=richtext

/**
 * Копия sanitize-логики richtext из edit.php (вынести в lib при третьем
 * использовании): whitelist тегов + срез on*-атрибутов + нейтрализация
 * javascript:/vbscript:/data: схем в href/src.
 */
function nit_sanitize_richtext(string $raw): string {
    $clean = strip_tags($raw, '<p><br><strong><em><b><i><u><a><ul><ol><li><h2><h3><h4><blockquote>');
    $clean = preg_replace('/\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $clean) ?? $clean;
    $clean = preg_replace(
        '/\b(href|src)\s*=\s*("|\')\s*[\s\x00-\x20]*(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|v\s*b\s*s\s*c\s*r\s*i\s*p\s*t|d\s*a\s*t\s*a)\s*:[^"\']*\2/i',
        '$1="#"',
        $clean,
    ) ?? $clean;
    return $clean;
}

/** Сохранить загруженную картинку (логика edit.php), вернуть url или null+ошибку. */
function nit_handle_image_upload(array $file, ?string &$err): ?string {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        $err = 'Файл не получен или ошибка загрузки.';
        return null;
    }
    $tmp = (string)$file['tmp_name'];
    $size = (int)$file['size'];
    if ($size > 5 * 1024 * 1024) {
        $err = 'Файл больше 5 МБ — слишком большой.';
        return null;
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmp) ?: '';
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    if (!isset($allowed[$mime])) {
        $err = 'Недопустимый тип файла. Только JPEG, PNG, WebP, GIF.';
        return null;
    }
    $name = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
    $uploadDir = nit_root() . '/assets/uploads';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }
    $target = $uploadDir . '/' . $name;
    if (!@move_uploaded_file($tmp, $target)) {
        $err = 'Не удалось переместить загруженный файл. Проверь права на assets/uploads/.';
        return null;
    }
    @chmod($target, 0644);
    return 'assets/uploads/' . $name;
}

/** Усечь строку для ячейки таблицы. */
function nit_cell_preview(string $v, int $len = 80): string {
    $flat = trim(preg_replace('/\s+/u', ' ', strip_tags($v)) ?? $v);
    return mb_strlen($flat) > $len ? mb_substr($flat, 0, $len - 1) . '…' : $flat;
}

$all = nit_load_collections();
$cid = (string)($_GET['c'] ?? '');
$col = ($cid !== '' && isset($all[$cid]) && is_array($all[$cid])) ? $all[$cid] : null;
$fields = ($col && is_array($col['fields'] ?? null)) ? $col['fields'] : [];
$rows = ($col && is_array($col['rows'] ?? null)) ? $col['rows'] : [];
$label = (string)($col['label'] ?? $cid);
$hasImage = false;
foreach ($fields as $f) {
    if (is_array($f) && ($f['type'] ?? '') === 'image') { $hasImage = true; }
}

$msg = null;
$err = null;

// ─── CSV-экспорт ───
if ($col && isset($_GET['csv'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . rawurlencode($cid) . '.csv"');
    echo "\xEF\xBB\xBF"; // BOM — Excel-ru
    $out = fopen('php://output', 'w');
    $head = [];
    foreach ($fields as $f) { $head[] = (string)($f['label'] ?? $f['id'] ?? ''); }
    fputcsv($out, $head, ';');
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $line = [];
        foreach ($fields as $f) {
            $k = (string)($f['id'] ?? '');
            $v = $row[$k] ?? '';
            $line[] = is_scalar($v) ? (string)$v : '';
        }
        fputcsv($out, $line, ';');
    }
    fclose($out);
    exit;
}

// ─── POST: save / delete ───
if ($col && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!nit_csrf_check($_POST['_csrf'] ?? null)) {
        $err = 'CSRF-токен не совпал. Обнови страницу.';
    } else {
        $action = (string)($_POST['action'] ?? '');
        if ($action === 'delete') {
            $n = (int)($_POST['row'] ?? -1);
            if ($n < 0 || $n >= count($rows)) {
                $err = 'Запись не найдена.';
            } else {
                array_splice($rows, $n, 1);
                $all[$cid]['rows'] = array_values($rows);
                if (nit_save_collections($all)) {
                    $rows = $all[$cid]['rows'];
                    $msg = 'Запись удалена.';
                } else {
                    $err = 'Не удалось записать data/collections.json. Проверь права на папку data/.';
                }
            }
        } elseif ($action === 'save') {
            $rowKey = (string)($_POST['row'] ?? '');
            $isNew = $rowKey === 'new';
            $n = $isNew ? -1 : (int)$rowKey;
            if (!$isNew && ($n < 0 || $n >= count($rows))) {
                $err = 'Запись не найдена.';
            } elseif ($isNew && count($rows) >= NIT_MAX_ROWS) {
                $err = 'Достигнут лимит ' . NIT_MAX_ROWS . ' записей в коллекции.';
            } else {
                $old = $isNew ? [] : (is_array($rows[$n]) ? $rows[$n] : []);
                $new = [];
                foreach ($fields as $f) {
                    if (!is_array($f)) continue;
                    $k = (string)($f['id'] ?? '');
                    if ($k === '') continue;
                    $t = (string)($f['type'] ?? 'text');
                    if ($t === 'image') {
                        $cur = is_string($old[$k] ?? null) ? $old[$k] : '';
                        $file = $_FILES['field_' . $k] ?? null;
                        if (is_array($file) && ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                            $upErr = null;
                            $url = nit_handle_image_upload($file, $upErr);
                            if ($url === null) { $err = $upErr; break; }
                            $new[$k] = $url;
                        } else {
                            $new[$k] = $cur; // файл не выбран — оставляем как было
                        }
                    } elseif ($t === 'richtext') {
                        $clean = nit_sanitize_richtext((string)($_POST['field_' . $k] ?? ''));
                        if (mb_strlen($clean) > NIT_RICHTEXT_LIMIT) {
                            $err = 'Поле «' . ($f['label'] ?? $k) . '» длиннее ' . NIT_RICHTEXT_LIMIT . ' символов.';
                            break;
                        }
                        $new[$k] = $clean;
                    } else { // text | price | number
                        $val = trim((string)($_POST['field_' . $k] ?? ''));
                        if (mb_strlen($val) > NIT_TEXT_LIMIT) {
                            $err = 'Поле «' . ($f['label'] ?? $k) . '» длиннее ' . NIT_TEXT_LIMIT . ' символов.';
                            break;
                        }
                        $new[$k] = $val;
                    }
                }
                if ($err === null) {
                    if ($isNew) { $rows[] = $new; } else { $rows[$n] = $new; }
                    $all[$cid]['rows'] = array_values($rows);
                    if (nit_save_collections($all)) {
                        $rows = $all[$cid]['rows'];
                        $msg = $isNew ? 'Запись добавлена.' : 'Сохранено.';
                    } else {
                        $err = 'Не удалось записать data/collections.json. Проверь права на папку data/.';
                    }
                }
            }
        }
    }
}

// ─── Режим формы ───
$rowParam = isset($_GET['row']) ? (string)$_GET['row'] : null;
$formRow = null;     // данные в форму
$formIndex = null;   // 'new' | int
if ($col && $rowParam !== null && $msg === null) {
    if ($rowParam === 'new') {
        $formIndex = 'new';
        $formRow = [];
    } else {
        $n = (int)$rowParam;
        if ($n >= 0 && $n < count($rows) && is_array($rows[$n])) {
            $formIndex = $n;
            $formRow = $rows[$n];
        }
    }
}
?><!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Данные<?= $col ? ' · ' . e($label) : '' ?></title>
<style>
body{font:14px system-ui,-apple-system,sans-serif;background:#0a0d18;color:#e6e9f0;margin:0}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 32px;border-bottom:1px solid #2a3149;background:#141826;gap:16px;flex-wrap:wrap}
h1{font-size:16px;color:#00d4ff;margin:0;font-weight:600}
.meta{color:#7d8499;font-size:11px;text-transform:uppercase;letter-spacing:.15em}
main{max-width:1000px;margin:0 auto;padding:32px}
a{color:#00d4ff}
.back{color:#7d8499;text-decoration:none;font-size:11px;text-transform:uppercase;letter-spacing:.15em}
.back:hover{color:#e6e9f0}
.msg{background:rgba(212,255,0,.08);border:1px solid #d4ff00;padding:10px 14px;color:#d4ff00;font-size:13px;margin-bottom:20px}
.err{background:rgba(255,46,147,.1);border:1px solid #ff2e93;padding:10px 14px;color:#ff2e93;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border-bottom:1px solid #2a3149;padding:10px 12px;text-align:left;vertical-align:middle}
th{font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#7d8499;font-weight:600}
tr:hover td{background:#141826}
.thumb{width:48px;height:48px;object-fit:cover;display:block;background:#141826}
.actions{white-space:nowrap;text-align:right}
.actions a,.actions button{font:inherit;font-size:12px}
.btn{display:inline-block;padding:10px 20px;background:#00d4ff;color:#0a0d18;border:0;font:bold 11px/1 system-ui;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;text-decoration:none}
.btn:hover{background:#33dfff}
.btn.ghost{background:transparent;color:#7d8499;border:1px solid #2a3149}
.btn.ghost:hover{color:#e6e9f0;border-color:#7d8499}
.btn.danger{background:transparent;color:#ff2e93;border:1px solid #ff2e93;padding:6px 12px}
.btn.danger:hover{background:rgba(255,46,147,.1)}
.toolbar{display:flex;gap:12px;margin:20px 0;flex-wrap:wrap}
label{display:block;margin:20px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#7d8499}
input[type=text],textarea{width:100%;box-sizing:border-box;padding:10px 12px;background:#0a0d18;border:1px solid #2a3149;color:#e6e9f0;font:inherit}
input:focus,textarea:focus{outline:none;border-color:#00d4ff}
textarea{min-height:160px;resize:vertical;font:13px/1.5 ui-monospace,SFMono-Regular,monospace}
input[type=file]{font:inherit;color:#a5acc0;padding:0}
.hint{font-size:11px;color:#7d8499;margin-top:6px;line-height:1.5}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:8px}
.card{display:block;padding:20px;background:#141826;border:1px solid #2a3149;text-decoration:none;color:#e6e9f0}
.card:hover{border-color:#00d4ff}
.card .name{font-size:15px;font-weight:600;color:#00d4ff}
.card .sub{font-size:12px;color:#7d8499;margin-top:6px}
.empty{color:#7d8499;padding:32px 0;font-size:13px;line-height:1.6}
.preview{margin-top:8px;padding:12px;background:#141826;border:1px solid #2a3149;max-width:280px}
.preview img{max-width:100%;height:auto;display:block}
</style>
</head><body>
<header>
  <h1>// данные<?= $col ? ' · ' . e($label) : '' ?> <?php if ($col): ?><span class="meta">[<?= count($rows) ?> зап.]</span><?php endif; ?></h1>
  <a class="back" href="<?= $col ? 'data.php' : 'index.php' ?>">← <?= $col ? 'К коллекциям' : 'К зонам' ?></a>
</header>
<main>
<?php if ($msg): ?><div class="msg">✓ <?= e($msg) ?></div><?php endif; ?>
<?php if ($err): ?><div class="err">✗ <?= e($err) ?></div><?php endif; ?>

<?php if (!$col): ?>
  <?php if ($all === []): ?>
    <div class="empty">Коллекций нет. Этот сайт собран без табличных данных —
    редактируемые тексты и картинки живут в разделе <a href="index.php">«Зоны»</a>.</div>
  <?php else: ?>
    <div class="cards">
    <?php foreach ($all as $id => $c): if (!is_array($c)) continue;
        $cnt = is_array($c['rows'] ?? null) ? count($c['rows']) : 0;
        $fcnt = is_array($c['fields'] ?? null) ? count($c['fields']) : 0; ?>
      <a class="card" href="data.php?c=<?= e(rawurlencode((string)$id)) ?>">
        <div class="name"><?= e((string)($c['label'] ?? $id)) ?></div>
        <div class="sub"><?= $cnt ?> записей · <?= $fcnt ?> колонок</div>
      </a>
    <?php endforeach; ?>
    </div>
  <?php endif; ?>

<?php elseif ($formRow !== null): ?>
  <form method="post"<?= $hasImage ? ' enctype="multipart/form-data"' : '' ?>>
  <?= nit_csrf_field() ?>
  <input type="hidden" name="action" value="save">
  <input type="hidden" name="row" value="<?= e(is_int($formIndex) ? (string)$formIndex : 'new') ?>">
  <?php foreach ($fields as $f): if (!is_array($f)) continue;
      $k = (string)($f['id'] ?? ''); if ($k === '') continue;
      $t = (string)($f['type'] ?? 'text');
      $fl = (string)($f['label'] ?? $k);
      $cur = is_string($formRow[$k] ?? null) ? $formRow[$k] : ''; ?>
    <label><?= e($fl) ?></label>
    <?php if ($t === 'richtext'): ?>
      <textarea name="field_<?= e($k) ?>" maxlength="<?= NIT_RICHTEXT_LIMIT ?>"><?= e($cur) ?></textarea>
      <div class="hint">Разрешённые теги: <code>p, br, strong, em, b, i, u, a, ul, ol, li, h2, h3, h4, blockquote</code>.</div>
    <?php elseif ($t === 'image'): ?>
      <?php if ($cur !== ''): ?>
      <div class="preview"><img src="../<?= e($cur) ?>" alt="" loading="lazy"></div>
      <?php endif; ?>
      <input type="file" name="field_<?= e($k) ?>" accept="image/jpeg,image/png,image/webp,image/gif">
      <div class="hint">JPEG / PNG / WebP / GIF, до 5 МБ. Не выберешь файл — останется текущая картинка.</div>
    <?php else: ?>
      <input type="text" name="field_<?= e($k) ?>" value="<?= e($cur) ?>" maxlength="<?= NIT_TEXT_LIMIT ?>"<?= $t === 'number' ? ' inputmode="decimal"' : '' ?>>
      <?php if ($t === 'price'): ?><div class="hint">Цена с валютой как на сайте: «₽2 900», «от 1 500 ₽».</div><?php endif; ?>
    <?php endif; ?>
  <?php endforeach; ?>
  <div class="toolbar">
    <button class="btn" type="submit">Сохранить</button>
    <a class="btn ghost" href="data.php?c=<?= e(rawurlencode($cid)) ?>">Отмена</a>
  </div>
  </form>

<?php else: ?>
  <div class="toolbar">
    <a class="btn" href="data.php?c=<?= e(rawurlencode($cid)) ?>&amp;row=new">+ Добавить запись</a>
    <a class="btn ghost" href="data.php?c=<?= e(rawurlencode($cid)) ?>&amp;csv=1">Экспорт CSV</a>
  </div>
  <?php if ($rows === []): ?>
    <div class="empty">Записей пока нет — добавь первую кнопкой выше.</div>
  <?php else: ?>
  <table>
    <thead><tr>
      <th>#</th>
      <?php foreach ($fields as $f): if (!is_array($f)) continue; ?>
        <th><?= e((string)($f['label'] ?? $f['id'] ?? '')) ?></th>
      <?php endforeach; ?>
      <th></th>
    </tr></thead>
    <tbody>
    <?php foreach ($rows as $i => $row): if (!is_array($row)) continue; ?>
      <tr>
        <td class="meta"><?= $i + 1 ?></td>
        <?php foreach ($fields as $f): if (!is_array($f)) continue;
            $k = (string)($f['id'] ?? '');
            $t = (string)($f['type'] ?? 'text');
            $v = is_string($row[$k] ?? null) ? $row[$k] : ''; ?>
          <td>
          <?php if ($t === 'image' && $v !== ''): ?>
            <img class="thumb" src="../<?= e($v) ?>" alt="" loading="lazy">
          <?php else: ?>
            <?= e(nit_cell_preview($v)) ?>
          <?php endif; ?>
          </td>
        <?php endforeach; ?>
        <td class="actions">
          <a href="data.php?c=<?= e(rawurlencode($cid)) ?>&amp;row=<?= $i ?>">Изменить</a>
          <form method="post" style="display:inline" onsubmit="return confirm('Удалить запись #<?= $i + 1 ?>?')">
            <?= nit_csrf_field() ?>
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="row" value="<?= $i ?>">
            <button class="btn danger" type="submit">Удалить</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <?php endif; ?>
<?php endif; ?>
</main>
</body></html>
