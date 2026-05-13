<?php
declare(strict_types=1);
require_once __DIR__ . '/admin/lib/store.php';

$usersPath = nit_root() . '/data/users.json';
if (is_file($usersPath) && filesize($usersPath) > 0) {
    http_response_code(403);
    echo '<!DOCTYPE html><meta charset="utf-8"><title>Setup completed</title>'
       . '<style>body{font:14px system-ui;background:#0a0d18;color:#e6e9f0;padding:48px}h1{color:#ff2e93}a{color:#00d4ff}</style>'
       . '<h1>Setup уже выполнен.</h1>'
       . '<p>Удали файл <code>setup.php</code> с сервера или открой <a href="admin/">админку</a>.</p>';
    exit;
}

$err = null;
$done = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $u = trim((string)($_POST['username'] ?? ''));
    $p1 = (string)($_POST['p1'] ?? '');
    $p2 = (string)($_POST['p2'] ?? '');
    if (mb_strlen($u) < 3 || !preg_match('/^[a-zA-Z0-9_]+$/', $u)) {
        $err = 'Логин: 3+ символа, только a-z, A-Z, 0-9, _.';
    } elseif (mb_strlen($p1) < 10) {
        $err = 'Пароль минимум 10 символов.';
    } elseif ($p1 !== $p2) {
        $err = 'Пароли не совпадают.';
    } else {
        $hash = password_hash($p1, PASSWORD_ARGON2ID);
        $data = [$u => ['password_hash' => $hash, 'created_at' => date('c')]];
        $dir = nit_root() . '/data';
        if (!is_dir($dir) || !is_writable($dir)) {
            $err = 'Папка data/ недоступна для записи. Сделай chmod 755 data/ и попробуй снова.';
        } elseif (@file_put_contents($usersPath, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) === false) {
            $err = 'Не удалось записать data/users.json. Проверь права на папку data/.';
        } else {
            @chmod($usersPath, 0640);
            $done = true;
        }
    }
}
?><!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setup</title>
<style>
body{font:14px system-ui,-apple-system,sans-serif;background:#0a0d18;color:#e6e9f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}
form,.done{background:#141826;padding:32px;border:1px solid #2a3149;width:380px;max-width:100%;box-sizing:border-box}
h1{font-size:18px;margin:0 0 8px;color:#00d4ff}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:#7d8499;margin:0 0 24px;font-weight:normal}
label{display:block;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#7d8499}
input{width:100%;box-sizing:border-box;padding:10px 12px;margin-bottom:16px;background:#0a0d18;border:1px solid #2a3149;color:#e6e9f0;font:inherit}
input:focus{outline:none;border-color:#00d4ff}
button,.btn{display:inline-block;width:100%;box-sizing:border-box;text-align:center;padding:12px;background:#00d4ff;color:#0a0d18;border:0;font:bold 12px/1 system-ui;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;text-decoration:none}
button:hover,.btn:hover{background:#33dfff}
.err{background:rgba(255,46,147,.1);border:1px solid #ff2e93;padding:10px 14px;color:#ff2e93;font-size:12px;margin-bottom:16px}
.hint{font-size:12px;color:#a5acc0;margin-bottom:16px;line-height:1.5}
.warn{background:rgba(212,255,0,.08);border:1px solid #d4ff00;padding:12px 14px;color:#d4ff00;font-size:11px;margin-top:16px;line-height:1.5}
code{font:12px/1 ui-monospace,monospace;background:rgba(0,0,0,.3);padding:2px 6px;color:#00d4ff}
</style>
</head><body>
<?php if ($done): ?>
<div class="done">
  <h1>✓ Готово</h1>
  <h2>// admin created</h2>
  <p style="font-size:13px;line-height:1.6;margin-top:0">Аккаунт администратора создан. <strong>Удали файл <code>setup.php</code></strong> с сервера и переходи в админку.</p>
  <a class="btn" href="admin/">Открыть админку →</a>
  <div class="warn">⚠ <code>setup.php</code> позволяет кому угодно пересоздать админа. Удали его сразу после первого входа.</div>
</div>
<?php else: ?>
<form method="post">
  <h1>Setup</h1>
  <h2>// первый запуск</h2>
  <?php if ($err): ?><div class="err">✗ <?= htmlspecialchars($err, ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
  <p class="hint">Создай аккаунт администратора. <strong>Этот файл (<code>setup.php</code>) надо удалить после первого входа.</strong></p>
  <label>Логин (a-z, 0-9, _)</label>
  <input name="username" required minlength="3" pattern="[a-zA-Z0-9_]+" autofocus>
  <label>Пароль (минимум 10 символов)</label>
  <input name="p1" type="password" required minlength="10">
  <label>Повтори пароль</label>
  <input name="p2" type="password" required minlength="10">
  <button type="submit">Создать админа</button>
</form>
<?php endif; ?>
</body></html>
