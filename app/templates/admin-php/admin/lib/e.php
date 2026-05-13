<?php
declare(strict_types=1);

/**
 * Безопасный вывод строки в HTML — экранирование через htmlspecialchars.
 * Применять ВСЕГДА при выводе пользовательского ввода в HTML (кроме явно подготовленного richtext-контента).
 */
function e(?string $s): string {
    return htmlspecialchars($s ?? '', ENT_QUOTES | ENT_HTML5, 'UTF-8');
}
