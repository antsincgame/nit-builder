<?php
declare(strict_types=1);
require_once __DIR__ . '/store.php';

/**
 * Стартануть сессию с безопасными cookie-параметрами.
 * Идемпотентна — если сессия уже активна, ничего не делает.
 */
function nit_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_name('nit_admin');
    session_start();
}

function nit_users_load(): array {
    $path = nit_root() . '/data/users.json';
    if (!is_file($path)) return [];
    $raw = @file_get_contents($path);
    if ($raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function nit_check_password(string $username, string $password): bool {
    $users = nit_users_load();
    if (!isset($users[$username]) || !is_array($users[$username])) return false;
    $hash = $users[$username]['password_hash'] ?? '';
    return is_string($hash) && password_verify($password, $hash);
}

function nit_login(string $username): void {
    nit_session_start();
    session_regenerate_id(true);
    $_SESSION['user'] = $username;
    $_SESSION['logged_at'] = time();
}

function nit_logout(): void {
    nit_session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function nit_is_authenticated(): bool {
    nit_session_start();
    return !empty($_SESSION['user']);
}

function nit_require_auth(): void {
    if (!nit_is_authenticated()) {
        header('Location: login.php');
        exit;
    }
}

/**
 * Простой rate-limit на основе data/rate_limit.json.
 * Окно 15 минут, лимит 5 попыток на ключ (обычно key = 'login:' . IP).
 *
 * Разделён на две функции: peek (read-only, проверяет есть ли ещё попытки)
 * и hit (записывает неудачную попытку). Это нужно чтобы успешный логин и
 * битый CSRF не расходовали попытки — иначе атакующий может за 5 пустых
 * POST-ов залочить логин жертве с того же IP (NAT, корпоративная сеть).
 */
function nit_rate_limit_peek(string $key): bool {
    $path = nit_root() . '/data/rate_limit.json';
    if (!is_file($path)) return true;
    $raw = @file_get_contents($path);
    if ($raw === false) return true;
    $data = json_decode($raw, true);
    if (!is_array($data)) return true;
    $entry = $data[$key] ?? null;
    if (!is_array($entry)) return true;
    $window = 15 * 60;
    $limit = 5;
    if (($entry['start'] ?? 0) + $window < time()) return true; // окно истекло
    return (int)($entry['count'] ?? 0) < $limit;
}

function nit_rate_limit_hit(string $key): void {
    $path = nit_root() . '/data/rate_limit.json';
    $window = 15 * 60;
    $now = time();
    $data = [];
    if (is_file($path)) {
        $raw = @file_get_contents($path);
        if ($raw !== false) {
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) $data = $parsed;
        }
    }
    $entry = $data[$key] ?? null;
    if (!is_array($entry) || ($entry['start'] ?? 0) + $window < $now) {
        $entry = ['start' => $now, 'count' => 1];
    } else {
        $entry['count'] = (int)($entry['count'] ?? 0) + 1;
    }
    $data[$key] = $entry;
    @file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE));
}

function nit_rate_limit_reset(string $key): void {
    $path = nit_root() . '/data/rate_limit.json';
    if (!is_file($path)) return;
    $raw = @file_get_contents($path);
    if ($raw === false) return;
    $data = json_decode($raw, true);
    if (!is_array($data)) return;
    unset($data[$key]);
    @file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE));
}
