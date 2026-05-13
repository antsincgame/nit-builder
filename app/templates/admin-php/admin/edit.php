<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/store.php';
require_once __DIR__ . '/lib/csrf.php';
nit_require_auth();

$id = (string)($_GET['zone'] ?? '');
$zone = nit_zone($id);
if (!$zone) {
    http_response_code(404);
    echo '<!DOCTYPE html><meta charset="utf-8"><title>404</title><h1>Зона не найдена</h1><p><a href="index.php">← к списку</a></p>';
    exit;
}

$type = (string)($zone['type'] ?? 'text');
$label = (string)($zone['label'] ?? $id);
$content = nit_load_content();
$current = $content[$id] ?? '';
$msg = null;
$err = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!nit_csrf_check($_POST['_csrf'] ?? null)) {
        $err = 'CSRF-токен не совпал. Обнови страницу.';
    } else {
        if ($type === 'text') {
            $val = trim((string)($_POST['value'] ?? ''));
            if (mb_strlen($val) > 500) {
                $err = 'Слишком длинный текст (максимум 500 символов).';
            } else {
                $content[$id] = $val;
                if (nit_save_content($content)) {
                    $current = $val;
                    $msg = 'Сохранено.';
                } else {
                    $err = 'Не удалось записать data/content.json. Проверь права на папку data/.';
                }
            }
        } elseif ($type === 'richtext') {
            $raw = (string)($_POST['value'] ?? '');
            // Whitelist разрешённых тегов. strip_tags не удаляет атрибуты,
            // но дальше мы хотя бы блокируем теги script/style/iframe/object.
            // Для полной защиты от XSS на production стоит подключить HTMLPurifier.
            $clean = strip_tags($raw, '<p><br><strong><em><b><i><u><a><ul><ol><li><h2><h3><h4><blockquote>');
            if (mb_strlen($clean) > 10000) {
                $err = 'Слишком длинный контент (максимум 10000 символов).';
            } else {
                $content[$id] = $clean;
                if (nit_save_content($content)) {
                    $current = $clean;
                    $msg = 'Сохранено.';
                } else {
                    $err = 'Не удалось записать data/content.json. Проверь права на папку data/.';
                }
            }
        } elseif ($type === 'image') {
            if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                $err = 'Файл не получен или ошибка загрузки.';
            } else {
                $tmp = (string)$_FILES['file']['tmp_name'];
                $size = (int)$_FILES['file']['size'];
                if ($size > 5 * 1024 * 1024) {
                    $err = 'Файл больше 5 МБ — слишком большой.';
                } else {
                    $finfo = new finfo(FILEINFO_MIME_TYPE);
                    $mime = $finfo->file($tmp) ?: '';
                    $allowed = [
                        'image/jpeg' => 'jpg',
                        'image/png'  => 'png',
                        'image/webp' => 'webp',
                        'image/gif'  => 'gif',
                    ];
                    if (!isset($allowed[$mime])) {
                        $err = 'Недопустимый тип файла. Только JPEG, PNG, WebP, GIF.';
                    } else {
                        $name = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
                        $uploadDir = nit_root() . '/assets/uploads';
                        if (!is_dir($uploadDir)) {
                            @mkdir($uploadDir, 0755, true);
                        }
                        $target = $uploadDir . '/' . $name;
                        if (!@move_uploaded_file($tmp, $target)) {
                            $err = 'Не удалось переместить загруженный файл. Проверь права на assets/uploads/.';
                        } else {
                            @chmod($target, 0644);
                            $url = 'assets/uploads/' . $name;
                            $content[$id] = $url;
                            if (nit_save_content($content)) {
                                $current = $url;
                                $msg = 'Картинка загружена и сохранена.';
                            } else {
                                $err = 'Файл загружен, но не удалось обновить content.json.';
                            }
                        }
                    }
                }
            }
        }
    }
}
?><!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Редактирование · <?= e($label) ?></title>
<style>
body{font:14px system-ui,-apple-system,sans-serif;background:#0a0d18;color:#e6e9f0;margin:0}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 32px;border-bottom:1px solid #2a3149;background:#141826;gap:16px;flex-wrap:wrap}
h1{font-size:16px;color:#00d4ff;margin:0;font-weight:600}
.meta{color:#7d8499;font-size:11px;text-transform:uppercase;letter-spacing:.15em}
main{max-width:760px;margin:0 auto;padding:32px}
label{display:block;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#7d8499}
input[type=text],textarea{width:100%;box-sizing:border-box;padding:10px 12px;background:#0a0d18;border:1px solid #2a3149;color:#e6e9f0;font:inherit}
input:focus,textarea:focus{outline:none;border-color:#00d4ff}
textarea{min-height:240px;resize:vertical;font:13px/1.5 ui-monospace,SFMono-Regular,monospace}
input[type=file]{font:inherit;color:#a5acc0;padding:0}
button{padding:12px 28px;background:#00d4ff;color:#0a0d18;border:0;font:bold 12px/1 system-ui;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;margin-top:16px}
button:hover{background:#33dfff}
.back{color:#7d8499;text-decoration:none;font-size:11px;text-transform:uppercase;letter-spacing:.15em}
.back:hover{color:#e6e9f0}
.msg{background:rgba(212,255,0,.08);border:1px solid #d4ff00;padding:10px 14px;color:#d4ff00;font-size:13px;margin-bottom:20px}
.err{background:rgba(255,46,147,.1);border:1px solid #ff2e93;padding:10px 14px;color:#ff2e93;font-size:13px;margin-bottom:20px}
.hint{font-size:11px;color:#7d8499;margin-top:8px;line-height:1.5}
.preview{margin-top:16px;padding:16px;background:#141826;border:1px solid #2a3149}
.preview img{max-width:100%;height:auto;display:block}
.preview .url{font:11px/1.4 ui-monospace,monospace;color:#7d8499;margin-top:8px;word-break:break-all}
</style>
</head><body>
<header>
  <h1>// edit · <?= e($label) ?> <span class="meta">[<?= e($type) ?>]</span></h1>
  <a class="back" href="index.php">← К списку</a>
</header>
<main>
<?php if ($msg): ?><div class="msg">✓ <?= e($msg) ?></div><?php endif; ?>
<?php if ($err): ?><div class="err">✗ <?= e($err) ?></div><?php endif; ?>

<form method="post"<?= $type === 'image' ? ' enctype="multipart/form-data"' : '' ?>>
<?= nit_csrf_field() ?>

<?php if ($type === 'text'): ?>
  <label>Значение</label>
  <input type="text" name="value" value="<?= e(is_string($current) ? $current : '') ?>" maxlength="500" autofocus>
  <div class="hint">Одна строка, до 500 символов.</div>

<?php elseif ($type === 'richtext'): ?>
  <label>HTML-контент</label>
  <textarea name="value" maxlength="10000" autofocus><?= e(is_string($current) ? $current : '') ?></textarea>
  <div class="hint">Разрешённые теги: <code>p, br, strong, em, b, i, u, a, ul, ol, li, h2, h3, h4, blockquote</code>. Остальные удаляются при сохранении.</div>

<?php elseif ($type === 'image'): ?>
  <?php if (is_string($current) && $current !== ''): ?>
  <div class="preview">
    <img src="../<?= e($current) ?>" alt="" loading="lazy">
    <div class="url"><?= e($current) ?></div>
  </div>
  <?php endif; ?>
  <label style="margin-top:24px">Загрузить новую картинку</label>
  <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif" required>
  <div class="hint">JPEG / PNG / WebP / GIF, до 5 МБ. Имя файла генерируется автоматически.</div>

<?php else: ?>
  <div class="err">Тип «<?= e($type) ?>» не поддерживается.</div>
<?php endif; ?>

<?php if (in_array($type, ['text', 'richtext', 'image'], true)): ?>
<button type="submit">Сохранить</button>
<?php endif; ?>
</form>
</main>
</body></html>
