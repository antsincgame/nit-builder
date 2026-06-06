<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/store.php';
nit_require_auth();

$zones = nit_zones();
$content = nit_load_content();
$collections = nit_load_collections();

// Группируем зоны по секции для удобной навигации.
$grouped = [];
foreach ($zones as $z) {
    if (!is_array($z)) continue;
    $section = (string)($z['section'] ?? 'other');
    $grouped[$section][] = $z;
}
?><!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Админка</title>
<style>
body{font:14px system-ui,-apple-system,sans-serif;background:#0a0d18;color:#e6e9f0;margin:0}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 32px;border-bottom:1px solid #2a3149;background:#141826}
h1{font-size:16px;color:#00d4ff;margin:0;font-weight:600}
main{max-width:960px;margin:0 auto;padding:32px}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:#7d8499;margin:32px 0 12px;border-bottom:1px solid #2a3149;padding-bottom:8px}
.zone{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;border:1px solid #2a3149;margin-bottom:8px;background:#141826;text-decoration:none;color:#e6e9f0;transition:border-color .15s}
.zone:hover{border-color:#00d4ff}
.zone .label{font-weight:500;margin-bottom:4px}
.zone .preview{font-size:12px;color:#a5acc0;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zone .meta{font-size:10px;color:#7d8499;text-transform:uppercase;letter-spacing:.15em;flex-shrink:0;border:1px solid #2a3149;padding:4px 8px}
.logout{color:#7d8499;text-decoration:none;font-size:11px;text-transform:uppercase;letter-spacing:.15em}
.logout:hover{color:#ff2e93}
.empty{padding:48px;text-align:center;color:#7d8499;border:1px dashed #2a3149}
.view-site{color:#00d4ff;text-decoration:none;font-size:11px;text-transform:uppercase;letter-spacing:.15em;margin-right:16px}
</style>
</head><body>
<header>
  <h1>// admin · <?= e((string)($_SESSION['user'] ?? '')) ?></h1>
  <div>
    <?php if ($collections !== []): ?><a class="view-site" href="data.php">⊞ Данные</a><?php endif; ?>
    <a class="view-site" href="../" target="_blank">↗ Открыть сайт</a>
    <a class="logout" href="logout.php">Выйти →</a>
  </div>
</header>
<main>
<?php if (empty($zones)): ?>
  <div class="empty">
    Редактируемых зон нет — <code>data/zones.json</code> пустой или отсутствует.
  </div>
<?php else: foreach ($grouped as $section => $list): ?>
  <h2>// <?= e($section) ?></h2>
  <?php foreach ($list as $z):
    $id = (string)($z['id'] ?? '');
    $label = (string)($z['label'] ?? $id);
    $type = (string)($z['type'] ?? 'text');
    $val = $content[$id] ?? '';
    $preview = $type === 'image'
        ? (is_string($val) ? $val : '')
        : trim(strip_tags((string)$val));
  ?>
  <a class="zone" href="edit.php?zone=<?= urlencode($id) ?>">
    <div style="min-width:0;flex:1">
      <div class="label"><?= e($label) ?></div>
      <div class="preview"><?= e(mb_substr($preview, 0, 120)) ?></div>
    </div>
    <span class="meta"><?= e($type) ?></span>
  </a>
  <?php endforeach; endforeach; endif; ?>
</main>
</body></html>
