<?php
declare(strict_types=1);

/**
 * Allowlist-санитайзер richtext + перекодировка картинок. Zero-dep, без
 * HTMLPurifier — но на DOMDocument, а не на regex.
 *
 * Раньше edit.php / data.php чистили richtext через strip_tags + preg_replace.
 * Это обходилось: незакавыченная схема (<a href=javascript:alert(1)>), data:-URI
 * вне href/src, экзотический мусор, который strip_tags склеивал в рабочий
 * хендлер. Здесь — настоящий allowlist по дереву: парсим, оставляем ТОЛЬКО
 * разрешённые теги, на каждом — ТОЛЬКО разрешённые атрибуты, у ссылок валидируем
 * схему. Неразрешённый тег разворачиваем в его (уже очищенный) контент — текст
 * не теряем, а сам тег и его атрибуты/обработчики исчезают.
 */

const NIT_ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a',
    'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote',
];

// Разрешённые атрибуты строго по тегу. Везде, кроме <a href>, — пусто.
const NIT_ALLOWED_ATTRS = [
    'a' => ['href'],
];

function nit_safe_href(string $href): bool {
    if ($href === '') {
        return false;
    }
    // Срезаем пробелы/управляющие символы внутри схемы (jav\tascript: и т.п.).
    $probe = strtolower(preg_replace('/[\s\x00-\x20]+/', '', $href) ?? $href);
    // Якорь и относительный путь от корня — безопасны.
    if ($probe[0] === '#' || $probe[0] === '/') {
        return true;
    }
    // Явный безопасный протокол.
    if (preg_match('#^(https?:|mailto:|tel:)#', $probe) === 1) {
        return true;
    }
    // Любая ДРУГАЯ явная схема (javascript:, vbscript:, data:, file:, …) — нет.
    if (preg_match('#^[a-z][a-z0-9+.\-]*:#', $probe) === 1) {
        return false;
    }
    // Схемы нет вовсе (relative "page.html", "img/x.png") — ок.
    return true;
}

function nit_clean_node(DOMNode $node, DOMDocument $doc): void {
    // Обходим снимок списка детей: дерево мутируется по ходу.
    foreach (iterator_to_array($node->childNodes) as $child) {
        if ($child instanceof DOMText) {
            continue; // текст безопасен — выводится экранированно
        }
        if (!($child instanceof DOMElement)) {
            // комментарии, processing-instructions, CDATA — выкидываем
            $node->removeChild($child);
            continue;
        }

        $tag = strtolower($child->nodeName);

        if (!in_array($tag, NIT_ALLOWED_TAGS, true)) {
            // Неразрешённый тег: сначала чистим поддерево, затем разворачиваем
            // его детей на место тега (unwrap) и убираем сам тег.
            nit_clean_node($child, $doc);
            while ($child->firstChild) {
                $node->insertBefore($child->firstChild, $child);
            }
            $node->removeChild($child);
            continue;
        }

        // Разрешённый тег: срезаем все атрибуты, кроме allowlist для этого тега.
        $allowed = NIT_ALLOWED_ATTRS[$tag] ?? [];
        $attrNames = [];
        foreach ($child->attributes as $attr) {
            $attrNames[] = $attr->nodeName; // снимок: удаление по ходу ломает обход
        }
        foreach ($attrNames as $attrName) {
            if (!in_array(strtolower($attrName), $allowed, true)) {
                $child->removeAttribute($attrName);
                continue;
            }
            if (strtolower($attrName) === 'href') {
                if (!nit_safe_href(trim($child->getAttribute('href')))) {
                    $child->removeAttribute($attrName);
                } else {
                    // Внешние ссылки: гасим tabnabbing и SEO-передачу.
                    $child->setAttribute('rel', 'noopener nofollow ugc');
                }
            }
        }

        nit_clean_node($child, $doc);
    }
}

function nit_sanitize_richtext(string $raw): string {
    $raw = trim($raw);
    if ($raw === '') {
        return '';
    }

    $prev = libxml_use_internal_errors(true);
    $doc = new DOMDocument('1.0', 'UTF-8');
    // meta charset → DOMDocument корректно разбирает UTF-8 (без mb_convert_encoding,
    // который в PHP 8.2+ выпилен для HTML-ENTITIES). LIBXML_NONET — никаких сетевых
    // обращений (внешние сущности).
    $doc->loadHTML(
        '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>'
            . $raw . '</body></html>',
        LIBXML_NOERROR | LIBXML_NONET,
    );
    libxml_clear_errors();
    libxml_use_internal_errors($prev);

    $body = $doc->getElementsByTagName('body')->item(0);
    if (!$body) {
        return '';
    }

    nit_clean_node($body, $doc);

    $out = '';
    foreach (iterator_to_array($body->childNodes) as $child) {
        $out .= $doc->saveHTML($child);
    }
    return trim($out);
}

/**
 * Перекодировка загруженной картинки через GD поверх валидного файла —
 * defense-in-depth против polyglot-загрузок (валидный image-заголовок + PHP в
 * хвосте). Re-encode выбрасывает всё, что не пиксели. Best-effort: если GD нет
 * (редкий shared-хостинг) или формат не вытащить — возвращаем false, вызывающий
 * остаётся на провалидированном по MIME файле (имя всё равно с image-расширением).
 *
 * Перезаписывает $path на месте. Аниморированный GIF схлопывается в первый кадр —
 * приемлемый размен на безопасность для контент-картинок.
 */
function nit_reencode_image(string $path, string $mime): bool {
    if (!function_exists('imagecreatefromstring')) {
        return false;
    }
    $data = @file_get_contents($path);
    if ($data === false || $data === '') {
        return false;
    }
    $img = @imagecreatefromstring($data);
    if (!$img) {
        return false;
    }

    ob_start();
    $ok = false;
    switch ($mime) {
        case 'image/jpeg':
            $ok = imagejpeg($img, null, 90);
            break;
        case 'image/png':
            $ok = imagepng($img);
            break;
        case 'image/webp':
            $ok = function_exists('imagewebp') ? imagewebp($img) : false;
            break;
        case 'image/gif':
            $ok = imagegif($img);
            break;
    }
    $encoded = ob_get_clean();
    imagedestroy($img);

    if (!$ok || $encoded === '' || $encoded === false) {
        return false;
    }
    return @file_put_contents($path, $encoded) !== false;
}
