<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/csrf.php';
nit_session_start();

// Уже залогинен — сразу в dashboard.
if (nit_is_authenticated()) {
    header('Location: index.php');
    exit;
}

$err = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!nit_rate_limit_check('login:' . $ip)) {
        $err = 'Слишком много попыток входа. Попробуй через 15 минут.';
    } elseif (!nit_csrf_check($_POST['_csrf'] ?? null)) {
        $err = 'CSRF-токен не совпал. Обнови страницу и попробуй ещё раз.';
    } else {
        $u = trim((string)($_POST['username'] ?? ''));
        $p = (string)($_POST['password'] ?? '');
        if (nit_check_password($u, $p)) {
            nit_login($u);
            header('Location: index.php');
            exit;
        }
        $err = 'Неверный логин или пароль.';
    }
}
?><!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Вход в админку</title>
<style>
body{font:14px system-ui,-apple-system,sans-serif;background:#0a0d18;color:#e6e9f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
form{background:#141826;padding:32px;border:1px solid #2a3149;width:320px}
h1{font-size:18px;margin:0 0 24px;color:#00d4ff}
label{display:block;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#7d8499}
input{width:100%;box-sizing:border-box;padding:10px 12px;margin-bottom:16px;background:#0a0d18;border:1px solid #2a3149;color:#e6e9f0;font:inherit}
input:focus{outline:none;border-color:#00d4ff}
button{width:100%;padding:12px;background:#00d4ff;color:#0a0d18;border:0;font:bold 12px/1 system-ui;letter-spacing:.15em;text-transform:uppercase;cursor:pointer}
button:hover{background:#33dfff}
.err{background:rgba(255,46,147,.1);border:1px solid #ff2e93;padding:10px;color:#ff2e93;font-size:12px;margin-bottom:16px}
</style>
</head><body>
<form method="post" novalidate>
  <h1>// admin login</h1>
  <?php if ($err): ?><div class="err"><?= e($err) ?></div><?php endif; ?>
  <?= nit_csrf_field() ?>
  <label>Логин</label>
  <input name="username" autocomplete="username" required autofocus>
  <label>Пароль</label>
  <input name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Войти</button>
</form>
</body></html>
