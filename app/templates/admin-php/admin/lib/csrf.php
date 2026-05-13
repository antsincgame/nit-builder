<?php
declare(strict_types=1);

/**
 * CSRF-токен живёт в сессии, генерится один раз и проверяется на каждом POST.
 */
function nit_csrf_token(): string {
    if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function nit_csrf_check(?string $token): bool {
    return isset($_SESSION['csrf']) && is_string($token) && hash_equals($_SESSION['csrf'], $token);
}

function nit_csrf_field(): string {
    return '<input type="hidden" name="_csrf" value="' . htmlspecialchars(nit_csrf_token(), ENT_QUOTES, 'UTF-8') . '">';
}
