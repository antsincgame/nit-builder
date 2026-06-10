// Improves PHP+SQLite storefront generation with niche-specific seeds and labels.
import type { Plan, PlanPricingTier } from "~/lib/utils/planSchema";

export type PhpSqliteProjectFile = {
  path: string;
  content: string;
};

export type PhpSqliteArtifact = {
  kind: "php-sqlite-app";
  version: 1;
  files: PhpSqliteProjectFile[];
  entrypoint: string;
  database: "sqlite";
  notes: string[];
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function phpString(value: unknown): string {
  return `'${String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pickBySeed<T>(arr: readonly T[], seed: number): T {
  return arr[(seed >>> 0) % arr.length];
}

function isRu(plan: Plan): boolean {
  return plan.language === "ru";
}

type StorefrontTheme = "beauty" | "food" | "real-estate" | "clinic" | "courses" | "auto" | "generic";

function storefrontTheme(plan: Plan): StorefrontTheme {
  const text = `${plan.business_type} ${plan.keywords.join(" ")} ${plan.sections.join(" ")}`.toLowerCase();
  if (/beauty|красот|салон|космет|маник|барбер|spa|wellness/.test(text)) return "beauty";
  if (/food|еда|доставк|ресторан|меню|кафе|кофе|кофейн|напит|десерт|пекар/.test(text)) return "food";
  if (/real estate|недвиж|объект|квартир|дом/.test(text)) return "real-estate";
  if (/clinic|клиник|медиц|doctor|стомат/.test(text)) return "clinic";
  if (/course|курс|школ|образован|lesson/.test(text)) return "courses";
  if (/auto|авто|машин|аренд|car/.test(text)) return "auto";
  return "generic";
}

function genericTierNames(tiers: PlanPricingTier[]): boolean {
  return tiers.every((tier) =>
    /^(старт|pro|премиум|базов|расшир|starter|premium|basic|launch|forge)$/i.test(tier.name.trim()),
  );
}

function themedProductSeeds(theme: StorefrontTheme, ru: boolean): PlanPricingTier[] | null {
  if (theme === "food") {
    return ru
      ? [
          { name: "Капучино", price: "7.50", features: ["Эспрессо", "молочная пена", "какао"], highlighted: true },
          { name: "Флэт уайт", price: "8.00", features: ["двойной эспрессо", "бархатное молоко", "насыщенный вкус"] },
          { name: "Раф карамельный", price: "9.50", features: ["сливки", "карамель", "ваниль"] },
          { name: "Чизкейк Сан-Себастьян", price: "10.00", features: ["нежный сырный крем", "карамельная корочка", "порция на месте"] },
          { name: "Круассан миндальный", price: "6.50", features: ["слоёное тесто", "миндальный крем", "свежая выпечка"] },
        ]
      : [
          { name: "Cappuccino", price: "7.50", features: ["espresso", "milk foam", "cocoa"], highlighted: true },
          { name: "Flat white", price: "8.00", features: ["double espresso", "silky milk", "rich taste"] },
          { name: "Caramel raf", price: "9.50", features: ["cream", "caramel", "vanilla"] },
          { name: "San Sebastian cheesecake", price: "10.00", features: ["soft cheese cream", "caramel top", "fresh slice"] },
          { name: "Almond croissant", price: "6.50", features: ["buttery layers", "almond cream", "fresh pastry"] },
        ];
  }

  if (theme === "beauty") {
    return ru
      ? [
          { name: "Маникюр", price: "45", features: ["форма", "покрытие", "уход за кутикулой"], highlighted: true },
          { name: "Педикюр", price: "55", features: ["обработка стоп", "покрытие", "крем-уход"] },
          { name: "Брови", price: "30", features: ["коррекция", "окрашивание", "укладка"] },
          { name: "Укладка", price: "60", features: ["мытьё", "стайлинг", "фиксация"] },
        ]
      : null;
  }

  if (theme === "courses") {
    return ru
      ? [
          { name: "Основы", price: "120", features: ["4 занятия", "домашние задания", "чат группы"], highlighted: true },
          { name: "Практикум", price: "240", features: ["8 занятий", "проект", "разбор ошибок"] },
          { name: "Индивидуально", price: "420", features: ["личный план", "созвоны", "проверка работ"] },
        ]
      : [
          { name: "Basics", price: "120", features: ["4 lessons", "homework", "group chat"], highlighted: true },
          { name: "Workshop", price: "240", features: ["8 lessons", "project", "review"] },
          { name: "Private", price: "420", features: ["personal plan", "calls", "feedback"] },
        ];
  }

  if (theme === "real-estate") {
    return ru
      ? [
          { name: "Студия у метро", price: "85000", features: ["32 м²", "до метро 6 минут", "готова к заселению"], highlighted: true },
          { name: "Двухкомнатная с видом", price: "145000", features: ["58 м²", "панорамные окна", "паркинг"] },
          { name: "Дом у леса", price: "280000", features: ["160 м²", "участок 9 соток", "терраса"] },
        ]
      : [
          { name: "Metro studio", price: "85000", features: ["32 sqm", "6 min to metro", "move-in ready"], highlighted: true },
          { name: "View apartment", price: "145000", features: ["58 sqm", "panoramic windows", "parking"] },
          { name: "Forest house", price: "280000", features: ["160 sqm", "garden plot", "terrace"] },
        ];
  }

  if (theme === "clinic") {
    return ru
      ? [
          { name: "Первичный приём", price: "70", features: ["осмотр", "план лечения", "30 минут"], highlighted: true },
          { name: "Профилактика", price: "95", features: ["чистка", "полировка", "рекомендации"] },
          { name: "Диагностика", price: "120", features: ["снимок", "консультация", "заключение"] },
        ]
      : [
          { name: "Initial visit", price: "70", features: ["exam", "care plan", "30 minutes"], highlighted: true },
          { name: "Prevention", price: "95", features: ["cleaning", "polishing", "recommendations"] },
          { name: "Diagnostics", price: "120", features: ["scan", "consultation", "report"] },
        ];
  }

  if (theme === "auto") {
    return ru
      ? [
          { name: "Диагностика авто", price: "55", features: ["сканер", "осмотр", "отчёт"], highlighted: true },
          { name: "Замена масла", price: "40", features: ["работа", "фильтр", "контроль уровней"] },
          { name: "Тормозная система", price: "120", features: ["колодки", "проверка дисков", "тест"] },
        ]
      : [
          { name: "Car diagnostics", price: "55", features: ["scanner", "inspection", "report"], highlighted: true },
          { name: "Oil change", price: "40", features: ["labor", "filter", "fluid check"] },
          { name: "Brake service", price: "120", features: ["pads", "disc check", "road test"] },
        ];
  }

  return null;
}

function productSeeds(plan: Plan): PlanPricingTier[] {
  const theme = storefrontTheme(plan);
  const themedSeeds = themedProductSeeds(theme, isRu(plan));
  if (themedSeeds && (!plan.pricing_tiers?.length || genericTierNames(plan.pricing_tiers))) {
    return themedSeeds;
  }
  if (plan.pricing_tiers?.length) return plan.pricing_tiers;
  if (themedSeeds) return themedSeeds;
  return isRu(plan)
    ? [
        {
          name: "Старт",
          price: "4900",
          period: "разово",
          features: ["Базовая комплектация", "Онлайн-оформление", "Поддержка по email"],
          highlighted: false,
        },
        {
          name: "Премиум",
          price: "14900",
          period: "разово",
          features: ["Расширенная комплектация", "Приоритетная обработка", "Персональная настройка"],
          highlighted: true,
        },
      ]
    : [
        {
          name: "Starter",
          price: "49",
          period: "one-time",
          features: ["Core package", "Online checkout", "Email support"],
          highlighted: false,
        },
        {
          name: "Premium",
          price: "149",
          period: "one-time",
          features: ["Extended package", "Priority processing", "Personal setup"],
          highlighted: true,
        },
      ];
}

function numericPrice(price: string): number {
  const cleaned = price.replace(",", ".").replace(/[^\d.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function publicText(value: string, fallback: string): string {
  const cleaned = value
    .replace(/\b(PHP|SQLite|MySQL|PDO|backend|back-end|checkout|webhook|CRUD)\b/gi, "")
    .replace(/\b(php|sqlite|mysql|pdo|бекенд|бэкенд|вебхук|админка)\b/gi, "")
    .replace(/\bhosted\b/gi, "")
    .replace(/\bstores?\b/gi, "")
    .replace(/\bсохраняет\b/gi, "")
    .replace(/\bзагружаются\s+из\s+через\b/gi, "")
    .replace(/\s*[:+·|/]\s*$/g, "")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned || /из\s+через|через\s*[.]?$/.test(cleaned) || !/[\p{L}\p{N}]/u.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

function stripPromptPrefix(value: string): string {
  let s = String(value || "").trim();
  const verbs = ["сделайте","сделай","создайте","создай","сделать","создать","построй","построить","сгенерируй","разработай","сверстай","нужен","нужна","нужно","хочу","хотим","please make","make","please create","create","build","generate","develop","design"];
  let strippedVerb = false;
  const lower0 = s.toLowerCase();
  for (const v of verbs) {
    if (lower0.startsWith(v + " ")) { s = s.slice(v.length).trim(); strippedVerb = true; break; }
  }
  if (!strippedVerb) return s;
  const nouns = ["веб-сайт","веб сайт","website","web site","сайт","site","лендинг","landing page","landing","страничку","страницу","приложение","application","app","магазин","store","shop","мне","me","для","про","for","about","a","an","the"];
  let changed = true;
  while (changed) {
    changed = false;
    const lo = s.toLowerCase();
    for (const n of nouns) {
      if (lo.startsWith(n + " ")) { s = s.slice(n.length).trim(); changed = true; break; }
    }
  }
  return s.trim();
}
function firstSentence(value: string): string {
  const s = String(value || "");
  let idx = s.length;
  for (const sep of [".", "!", "?", "\n", ";", " — ", " – "]) {
    const i = s.indexOf(sep);
    if (i >= 0 && i < idx) idx = i;
  }
  return s.slice(0, idx).trim();
}
function clampText(value: string, maxLen: number): string {
  const s = String(value || "").trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const sp = cut.lastIndexOf(" ");
  const trimmed = sp > maxLen / 2 ? cut.slice(0, sp).trim() : cut.trim();
  return trimmed || cut.trim();
}
function cleanBrand(plan: Plan): string {
  const base = stripPromptPrefix(plan.business_type);
  return clampText(firstSentence(base) || base || plan.business_type, 40) || plan.business_type;
}
function heroHeadline(plan: Plan): string {
  const raw = plan.hero_headline || plan.business_type;
  const stripped = stripPromptPrefix(raw);
  const candidate = clampText(firstSentence(stripped) || stripped || raw, 52);
  const fallback = clampText(stripPromptPrefix(plan.business_type) || plan.business_type, 52) || plan.business_type;
  const out = publicText(candidate || fallback, fallback).replace(/\s+(и|или|с|в|во|на|по|для|из|от|до|у|о|об|а|но|за|к|ко)$/i, "").trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

function storefrontDisplayName(plan: Plan): string {
  const source = [
    plan.hero_headline,
    plan.hero_subheadline,
    plan.business_type,
    ...plan.keywords,
  ].filter(Boolean).join(" ");
  const quoted = source.match(/["«“]([^"»”]{2,40})["»”]/);
  if (quoted?.[1]) return quoted[1].trim();
  const latinBrand = source.match(/\b([A-Z][A-Za-z0-9]*(?:\s*&\s*|\s+)[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)\b/);
  if (latinBrand?.[1]) return latinBrand[1].trim();
  return cleanBrand(plan);
}

function generateAdminPassword(): string {
  // Случайный пароль админа на этапе сборки артефакта: алфавит без визуально
  // неоднозначных символов (0/O, 1/l/I), 16 символов ≈ 93 бита. Заменяет
  // захардкоженный admin123 — у каждого сгенерированного сайта свой пароль,
  // менять руками не нужно. Web Crypto доступен и на сервере (Node 19+), и в
  // браузере (модуль импортируется клиентским artifactExport).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

function buildConfigPhp(plan: Plan): string {
  return `<?php
declare(strict_types=1);

return [
    'app_name' => ${phpString(plan.business_type)},
    'admin_email' => ${phpString(plan.contact_email || "admin@example.com")},
    'db' => [
        'driver' => getenv('DB_DRIVER') ?: 'sqlite',
        'sqlite_path' => dirname(__DIR__) . '/storage/app.sqlite',
        'mysql_dsn' => getenv('MYSQL_DSN') ?: 'mysql:host=127.0.0.1;dbname=nit_app;charset=utf8mb4',
        'mysql_user' => getenv('MYSQL_USER') ?: 'root',
        'mysql_password' => getenv('MYSQL_PASSWORD') ?: '',
    ],
    'payments' => [
        // MVP: use hosted checkout providers only. Never put secret keys in HTML.
        'provider' => getenv('PAYMENT_PROVIDER') ?: 'manual',
        'checkout_base_url' => getenv('PAYMENT_CHECKOUT_BASE_URL') ?: '',
        'webhook_secret' => getenv('PAYMENT_WEBHOOK_SECRET') ?: '',
        'success_url' => getenv('PAYMENT_SUCCESS_URL') ?: '/checkout/success',
        'cancel_url' => getenv('PAYMENT_CANCEL_URL') ?: '/cart',
    ],
];
`;
}

function buildDbPhp(): string {
  return `<?php
declare(strict_types=1);

function app_config(): array {
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = app_config()['db'];
    if (($config['driver'] ?? 'sqlite') === 'mysql') {
        $pdo = new PDO($config['mysql_dsn'], $config['mysql_user'], $config['mysql_password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo;
    }

    $path = $config['sqlite_path'];
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    return $pdo;
}

function migrate(): void {
    $driver = app_config()['db']['driver'] ?? 'sqlite';
    $schemaFile = $driver === 'mysql'
        ? dirname(__DIR__) . '/database/schema.mysql.sql'
        : dirname(__DIR__) . '/database/schema.sqlite.sql';
    $schema = file_get_contents($schemaFile);
    if ($schema === false) {
        throw new RuntimeException($schemaFile . ' not found');
    }
    db()->exec($schema);

    $stmt = db()->prepare('INSERT INTO admins (email, password_hash) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM admins WHERE email = ?)');
    $stmt->execute(['admin@example.com', password_hash('admin123', PASSWORD_DEFAULT), 'admin@example.com']);
}
`;
}

function buildPaymentsPhp(): string {
  return `<?php
declare(strict_types=1);

function create_checkout_session(int $orderId, float $total): array {
    $config = app_config()['payments'];
    $provider = (string) ($config['provider'] ?? 'manual');
    $successUrl = (string) ($config['success_url'] ?? '/checkout/success');

    if ($provider === 'manual') {
        return [
            'provider' => 'manual',
            'redirect_url' => $successUrl . '?order_id=' . $orderId,
        ];
    }

    // Hosted checkout adapter point. Configure PAYMENT_CHECKOUT_BASE_URL to
    // point at Stripe/YooKassa/CloudPayments/etc. middleware that creates a
    // real provider session with server-side secret keys.
    $checkoutBase = trim((string) ($config['checkout_base_url'] ?? ''));
    if ($checkoutBase === '') {
        return [
            'provider' => $provider,
            'redirect_url' => $successUrl . '?order_id=' . $orderId . '&payment=pending',
        ];
    }

    $query = http_build_query([
        'order_id' => $orderId,
        'amount' => number_format($total, 2, '.', ''),
        'success_url' => $successUrl . '?order_id=' . $orderId,
        'cancel_url' => (string) ($config['cancel_url'] ?? '/cart'),
    ]);

    $separator = strpos($checkoutBase, '?') === false ? '?' : '&';
    return [
        'provider' => $provider,
        'redirect_url' => rtrim($checkoutBase, '?&') . $separator . $query,
    ];
}

function handle_payment_webhook(): void {
    $config = app_config()['payments'];
    $secret = (string) ($config['webhook_secret'] ?? '');
    if ($secret !== '') {
        $received = $_SERVER['HTTP_X_NIT_PAYMENT_SECRET'] ?? '';
        if (!is_string($received) || !hash_equals($secret, $received)) {
            http_response_code(401);
            echo 'invalid signature';
            return;
        }
    }

    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo 'bad payload';
        return;
    }

    $orderId = isset($payload['order_id']) ? (int) $payload['order_id'] : 0;
    $status = isset($payload['status']) ? (string) $payload['status'] : '';
    if ($orderId > 0 && in_array($status, ['new', 'paid', 'processing', 'completed', 'cancelled', 'failed'], true)) {
        db()->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$status, $orderId]);
    }

    echo 'ok';
}
`;
}

function buildSecurityPhp(): string {
  return `<?php
declare(strict_types=1);

function h(?string $value): string {
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirect(string $path): void {
    if (defined('NIT_PREVIEW')) { echo '@@NITREDIRECT@@' . $path; exit; }
    header('Location: ' . $path);
    exit;
}

function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field(): string {
    return '<input type="hidden" name="csrf_token" value="' . h(csrf_token()) . '">';
}

function require_csrf(): void {
    if (defined('NIT_PREVIEW')) { return; }
    $token = $_POST['csrf_token'] ?? '';
    if (!is_string($token) || !hash_equals(csrf_token(), $token)) {
        http_response_code(419);
        exit('Invalid CSRF token');
    }
}

function require_admin(): void {
    if (empty($_SESSION['admin_id'])) {
        redirect('/admin/login');
    }
}
`;
}

function buildAuthPhp(): string {
  return `<?php
declare(strict_types=1);

function current_admin(): ?array {
    if (empty($_SESSION['admin_id'])) {
        return null;
    }
    $stmt = db()->prepare('SELECT id, email FROM admins WHERE id = ?');
    $stmt->execute([(int) $_SESSION['admin_id']]);
    $admin = $stmt->fetch();
    return $admin ?: null;
}

function login_admin(string $email, string $password): bool {
    $stmt = db()->prepare('SELECT id, password_hash FROM admins WHERE email = ?');
    $stmt->execute([$email]);
    $admin = $stmt->fetch();
    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        return false;
    }
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];
    return true;
}

function logout_admin(): void {
    unset($_SESSION['admin_id']);
    session_regenerate_id(true);
}
`;
}

function buildRouterPhp(): string {
  return `<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$file = __DIR__ . '/public' . $path;

if ($path !== '/' && is_file($file)) {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $types = [
        'css' => 'text/css; charset=UTF-8',
        'js' => 'application/javascript; charset=UTF-8',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
    ];
    if (isset($types[$ext])) {
        header('Content-Type: ' . $types[$ext]);
    }
    readfile($file);
    return true;
}

require __DIR__ . '/public/index.php';
`;
}

function buildHtaccess(): string {
  return `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [L]

<FilesMatch "\\.(sqlite|sql|env)$">
  Require all denied
</FilesMatch>
`;
}

function buildSeedSql(plan: Plan): string {
  const seeds = productSeeds(plan);
  return seeds
    .map((tier, index) => {
      const name = tier.name.replace(/'/g, "''");
      const description = tier.features.join("; ");
      return `INSERT INTO products (name, description, price, sort_order)
SELECT '${name}', '${description.replace(/'/g, "''")}', ${numericPrice(tier.price).toFixed(2)}, ${index + 1}
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = '${name}');`;
    })
    .join("\n");
}

function buildSqliteSchemaSql(plan: Plan): string {
  const rows = buildSeedSql(plan);
  return `CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

${rows}
`;
}

function buildMysqlSchemaSql(plan: Plan): string {
  const rows = buildSeedSql(plan);
  return `CREATE TABLE IF NOT EXISTS admins (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(190) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX products_active_sort_idx (is_active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(190) NOT NULL,
    customer_email VARCHAR(190) NOT NULL,
    customer_phone VARCHAR(60) NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'new',
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX orders_status_created_idx (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    name VARCHAR(190) NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

${rows}
`;
}

function buildIndexPhp(plan: Plan): string {
  const theme = storefrontTheme(plan);
  const appName = phpString(storefrontDisplayName(plan));
  const headline = phpString(heroHeadline(plan));
  const subheadline = phpString(publicText(plan.hero_subheadline || plan.target_audience, isRu(plan) ? "Выберите предложение и оставьте заявку онлайн." : "Choose an offer and submit a request online."));
  const cta = phpString(theme === "food"
    ? (isRu(plan) ? "Добавить в заказ" : "Add to order")
    : publicText(plan.cta_primary || (isRu(plan) ? "В корзину" : "Add to cart"), isRu(plan) ? "Оформить заявку" : "Submit request"));
  const microcopy = phpString(publicText(plan.cta_microcopy || (isRu(plan) ? "Без предоплаты. Ответим после заявки." : "No prepayment. We reply after your request."), isRu(plan) ? "Без предоплаты. Ответим после заявки." : "No prepayment. We reply after your request."));
  const htmlLang = phpString(plan.language || "ru");
  const adminTitle = phpString(isRu(plan) ? "Управление проектом" : "Project control room");
  const catalogLabel = phpString(isRu(plan) ? "Каталог" : "Catalog");
  const itemsLabel = phpString(isRu(plan) ? "Позиции" : "Items");
  const activeLabel = phpString(isRu(plan) ? "Активных" : "Active");
  const ordersLabel = phpString(isRu(plan) ? "Заказы" : "Orders");
  const revenueLabel = phpString(isRu(plan) ? "Оборот" : "Revenue");
  const trustOne = phpString(publicText(plan.social_proof_line || (isRu(plan) ? "Более 500 заказов и заявок" : "500+ orders and leads"), isRu(plan) ? "Более 500 заявок" : "500+ requests"));
  const trustTwo = phpString(publicText(plan.hours_text || (isRu(plan) ? "Онлайн-заявки 24/7" : "Online requests 24/7"), isRu(plan) ? "Онлайн-заявки 24/7" : "Online requests 24/7"));
  const visualLabel = phpString(publicText(plan.keywords[0] || plan.business_type, plan.business_type).toUpperCase());
  const brandTagline = phpString(theme === "food"
    ? (isRu(plan) ? "кофе · десерты · заказы" : "coffee · desserts · orders")
    : isRu(plan) ? "онлайн-витрина" : "online storefront");
  const contactLine = phpString(plan.contact_phone || plan.contact_email || (isRu(plan) ? "Ответим в течение дня" : "We reply within a day"));
  const sv = styleVariant(plan);
  const themeClass = phpString(`theme-${theme} mood-${sv.neon ? "neon" : "light"} head-${sv.head} hero-${sv.hero} cat-${sv.cat} band-${sv.band} struct-${sv.struct} surf-${sv.surf} btn-${sv.btn}`);
  const heroEyebrow = phpString(theme === "beauty"
    ? "Запись без предоплаты"
    : theme === "food"
      ? (isRu(plan) ? "Меню, корзина и заказы без лишних звонков" : "Menu, cart, and orders")
      : publicText(plan.cta_microcopy || (isRu(plan) ? "Без предоплаты. Ответ за 15 минут." : "No prepayment. Fast reply."), isRu(plan) ? "Без предоплаты. Ответ за 15 минут." : "No prepayment. Fast reply."));
  const heroVisualTitle = phpString(theme === "beauty"
    ? "персональный уход"
    : theme === "food" ? (isRu(plan) ? "кофе и десерты" : "coffee and desserts") : "подбор предложения");
  const heroVisualMetric = phpString(theme === "beauty"
    ? "мастера и услуги"
    : theme === "food" ? (isRu(plan) ? "позиций меню" : "menu items") : "активные предложения");
  const catalogHeading = phpString(theme === "beauty"
    ? pickBySeed(["Выберите формат визита", "Услуги и форматы записи", "С чего начнём преображение"], sv.seed)
    : theme === "food"
      ? (isRu(plan)
          ? pickBySeed(["Меню напитков и десертов", "Что в нашей витрине сегодня", "Кофе, десерты и сезонное меню"], sv.seed)
          : pickBySeed(["Coffee and dessert menu", "What's on our counter today", "Coffee, desserts and seasonals"], sv.seed))
      : pickBySeed(["Витрина предложений", "Каталог предложений", "Выберите подходящий вариант"], sv.seed));
  const benefitsHeading = phpString(theme === "beauty"
    ? pickBySeed(["Сервис ощущается ещё до визита", "Почему гости возвращаются", "Забота видна в деталях"], sv.seed >>> 5)
    : theme === "food"
      ? (isRu(plan)
          ? pickBySeed(["Заказ проходит как в хорошей кофейне: быстро и понятно", "Почему у нас удобно заказывать", "Быстро, вкусно и без лишних звонков"], sv.seed >>> 5)
          : pickBySeed(["Ordering feels fast and clear", "Why ordering here is easy", "Fast, tasty, no phone calls"], sv.seed >>> 5))
      : pickBySeed(["Не просто витрина, а понятный путь к заявке", "Почему с нами удобно", "Понятный путь от выбора к заявке"], sv.seed >>> 5));
  const benefits = plan.key_benefits?.length
    ? plan.key_benefits
    : [
        { title: isRu(plan) ? "Быстрый ответ" : "Fast reply", description: isRu(plan) ? "Заявка сразу уходит менеджеру." : "The request is sent immediately." },
        { title: isRu(plan) ? "Понятные предложения" : "Clear offers", description: isRu(plan) ? "Вы видите состав, цену и можете выбрать подходящий вариант." : "Each offer has a clear scope and price." },
        { title: isRu(plan) ? "Удобная запись" : "Easy booking", description: isRu(plan) ? "Оформление занимает меньше минуты." : "The request takes under a minute." },
      ];
  const faqs = plan.faq?.length
    ? plan.faq
    : [
        { question: isRu(plan) ? "Как быстро вы отвечаете?" : "How fast do you reply?", answer: isRu(plan) ? "Обычно в течение 15 минут в рабочее время." : "Usually within 15 minutes during business hours." },
        { question: isRu(plan) ? "Нужна ли предоплата?" : "Do I need to prepay?", answer: isRu(plan) ? "Можно оставить заявку без предоплаты, детали согласуем после." : "You can submit a request without prepayment." },
        { question: isRu(plan) ? "Можно изменить заявку?" : "Can I change my request?", answer: isRu(plan) ? "Да, менеджер уточнит детали перед подтверждением." : "Yes, the manager confirms details before processing." },
      ];
  const reviews = [
    {
      name: isRu(plan) ? "Анна" : "Anna",
      text: isRu(plan)
        ? "Оставила заявку утром, быстро согласовали время и услугу. Всё понятно без лишних звонков."
        : "I sent a request in the morning and quickly agreed on the time and service.",
    },
    {
      name: isRu(plan) ? "Мария" : "Maria",
      text: isRu(plan)
        ? "Удобно выбирать пакет: сразу видно, что входит и сколько стоит."
        : "The packages are easy to compare: scope and price are clear.",
    },
    {
      name: isRu(plan) ? "Елена" : "Elena",
      text: isRu(plan)
        ? "После заявки менеджер написал почти сразу. Никакой путаницы с записью."
        : "The manager replied almost immediately. No confusion around the booking.",
    },
  ];
  const showcaseTitle = phpString(theme === "beauty"
    ? pickBySeed(["Атмосфера, мастер и запись в одном сценарии", "Как проходит визит — от выбора до записи", "Спокойный сервис на каждом шаге"], sv.seed >>> 10)
    : theme === "food"
      ? pickBySeed(["От витрины меню до готового заказа", "Как собрать заказ за пару минут", "Путь от меню до вашего столика"], sv.seed >>> 10)
      : pickBySeed(["Как устроен путь клиента", "Как всё работает", "Три простых шага к заявке"], sv.seed >>> 10));
  const showcaseLead = phpString(theme === "beauty"
    ? pickBySeed(["Сайт должен передавать ощущение салона: спокойствие, аккуратность, понятный выбор и быстрый контакт.", "Покажем услуги и мастеров так, чтобы запись была лёгким и приятным шагом.", "Гость чувствует уровень салона ещё до визита и легко выбирает формат."], sv.seed >>> 15)
    : theme === "food"
      ? pickBySeed(["Гость выбирает напитки и десерты, добавляет в корзину и оставляет заказ без звонка.", "Меню, корзина и оформление: весь заказ собирается в пару касаний.", "От витрины до готового заказа: быстро, понятно и без звонков."], sv.seed >>> 15)
      : pickBySeed(["Показываем предложение, помогаем выбрать и сохраняем заявку без лишних шагов.", "Гость видит предложения, сравнивает и оставляет заявку за минуту.", "Понятная витрина, простой выбор и заявка без лишних полей."], sv.seed >>> 15));
  const showcaseItems = theme === "beauty"
    ? [
        { title: "Атмосфера", text: "Мягкая визуальная подача помогает почувствовать уровень сервиса до визита." },
        { title: "Мастера", text: "Пакеты и услуги оформлены так, чтобы клиент быстро понял разницу." },
        { title: "Запись", text: "Заявка собирается без лишних полей и сразу попадает в работу." },
      ]
    : theme === "food"
      ? [
          { title: "Меню", text: "Позиции выглядят как настоящие напитки и десерты, а не абстрактные тарифы." },
          { title: "Корзина", text: "Гость собирает заказ и сразу видит итоговую сумму." },
          { title: "Админка", text: "Владелец меняет цены, описания и статусы заказов без программиста." },
        ]
    : [
        { title: "Выбор", text: "Клиент видит предложения и сравнивает их без лишнего шума." },
        { title: "Заявка", text: "Форма собирает нужные контакты и фиксирует заказ." },
        { title: "Статус", text: "Администратор видит заявку и ведёт её по статусам." },
      ];
  const benefitsPhp = `[${benefits.map((b) => `['title' => ${phpString(publicText(b.title, isRu(plan) ? "Преимущество" : "Benefit"))}, 'description' => ${phpString(publicText(b.description, isRu(plan) ? "Понятное преимущество для клиента." : "A clear customer benefit."))}]`).join(", ")}]`;
  const faqPhp = `[${faqs.map((f) => `['question' => ${phpString(publicText(f.question, isRu(plan) ? "Частый вопрос" : "Common question"))}, 'answer' => ${phpString(publicText(f.answer, isRu(plan) ? "Ответим и уточним детали после заявки." : "We will reply and clarify details after your request."))}]`).join(", ")}]`;
  const reviewsPhp = `[${reviews.map((r) => `['name' => ${phpString(r.name)}, 'text' => ${phpString(r.text)}]`).join(", ")}]`;
  const showcasePhp = `[${showcaseItems.map((item) => `['title' => ${phpString(item.title)}, 'text' => ${phpString(item.text)}]`).join(", ")}]`;

  return `<?php
declare(strict_types=1);
session_start();

require_once dirname(__DIR__) . '/app/db.php';
require_once dirname(__DIR__) . '/app/security.php';
require_once dirname(__DIR__) . '/app/auth.php';
require_once dirname(__DIR__) . '/app/payments.php';

migrate();

if (defined('NIT_PREVIEW') && empty($_SESSION['admin_id'])) {
    $__pa = db()->query('SELECT id FROM admins ORDER BY id LIMIT 1')->fetchColumn();
    if ($__pa) { $_SESSION['admin_id'] = (int) $__pa; }
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$appName = ${appName};
$headline = ${headline};
$subheadline = ${subheadline};
$cta = ${cta};
$microcopy = ${microcopy};
$htmlLang = ${htmlLang};
$adminTitle = ${adminTitle};
$catalogLabel = ${catalogLabel};
$itemsLabel = ${itemsLabel};
$activeLabel = ${activeLabel};
$ordersLabel = ${ordersLabel};
$revenueLabel = ${revenueLabel};
$trustOne = ${trustOne};
$trustTwo = ${trustTwo};
$visualLabel = ${visualLabel};
$brandTagline = ${brandTagline};
$contactLine = ${contactLine};
$themeClass = ${themeClass};
$heroEyebrow = ${heroEyebrow};
$heroVisualTitle = ${heroVisualTitle};
$heroVisualMetric = ${heroVisualMetric};
$catalogHeading = ${catalogHeading};
$benefitsHeading = ${benefitsHeading};
$benefits = ${benefitsPhp};
$faqItems = ${faqPhp};
$reviews = ${reviewsPhp};
$showcaseTitle = ${showcaseTitle};
$showcaseLead = ${showcaseLead};
$showcaseItems = ${showcasePhp};
$heroKind = ${sv.hero};

function products(): array {
    return db()->query('SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order, id')->fetchAll();
}

function cart_items(): array {
    $cart = $_SESSION['cart'] ?? [];
    return is_array($cart) ? $cart : [];
}

function cart_count(): int {
    return array_sum(array_map('intval', cart_items()));
}

function cart_total(): float {
    $ids = array_keys(cart_items());
    if ($ids === []) return 0.0;
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = db()->prepare("SELECT id, price FROM products WHERE id IN ($placeholders)");
    $stmt->execute(array_map('intval', $ids));
    $total = 0.0;
    foreach ($stmt->fetchAll() as $row) {
        $total += (float) $row['price'] * (int) ($_SESSION['cart'][$row['id']] ?? 0);
    }
    return $total;
}

if ($path === '/cart/add' && $method === 'POST') {
    require_csrf();
    $id = max(1, (int) ($_POST['product_id'] ?? 0));
    $stmt = db()->prepare('SELECT id FROM products WHERE id = ? AND is_active = 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        redirect('/');
    }
    $_SESSION['cart'][$id] = (int) ($_SESSION['cart'][$id] ?? 0) + 1;
    redirect('/cart');
}

if ($path === '/checkout' && $method === 'POST') {
    require_csrf();
    $cart = cart_items();
    if ($cart === []) redirect('/cart');
    $name = trim((string) ($_POST['name'] ?? ''));
    $email = trim((string) ($_POST['email'] ?? ''));
    $phone = trim((string) ($_POST['phone'] ?? ''));
    if ($name === '' || $email === '') redirect('/cart');

    $pdo = db();
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO orders (customer_name, customer_email, customer_phone, total) VALUES (?, ?, ?, ?)');
    $total = cart_total();
    $stmt->execute([$name, $email, $phone, $total]);
    $orderId = (int) $pdo->lastInsertId();

    $ids = array_keys($cart);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $productsStmt = $pdo->prepare("SELECT id, name, price FROM products WHERE id IN ($placeholders)");
    $productsStmt->execute(array_map('intval', $ids));
    $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, name, qty, price) VALUES (?, ?, ?, ?, ?)');
    foreach ($productsStmt->fetchAll() as $product) {
        $qty = (int) ($cart[$product['id']] ?? 0);
        if ($qty > 0) {
            $itemStmt->execute([$orderId, $product['id'], $product['name'], $qty, $product['price']]);
        }
    }
    $pdo->commit();
    unset($_SESSION['cart']);
    $checkout = create_checkout_session($orderId, $total);
    redirect((string) $checkout['redirect_url']);
}

if ($path === '/payments/webhook' && $method === 'POST') {
    handle_payment_webhook();
    exit;
}

if ($path === '/admin/login' && $method === 'POST') {
    require_csrf();
    if (login_admin((string) ($_POST['email'] ?? ''), (string) ($_POST['password'] ?? ''))) {
        redirect('/admin');
    }
    $loginError = true;
}

if ($path === '/admin/logout') {
    logout_admin();
    redirect('/admin/login');
}

if ($path === '/admin/product/save' && $method === 'POST') {
    require_admin();
    require_csrf();
    $id = (int) ($_POST['id'] ?? 0);
    $isActive = empty($_POST['is_active']) ? 0 : 1;
    $data = [
        trim((string) ($_POST['name'] ?? '')),
        trim((string) ($_POST['description'] ?? '')),
        max(0, (float) ($_POST['price'] ?? 0)),
        (int) ($_POST['sort_order'] ?? 0),
        $isActive,
    ];
    if ($id > 0) {
        $data[] = $id;
        db()->prepare('UPDATE products SET name = ?, description = ?, price = ?, sort_order = ?, is_active = ? WHERE id = ?')->execute($data);
    } else {
        db()->prepare('INSERT INTO products (name, description, price, sort_order, is_active) VALUES (?, ?, ?, ?, ?)')->execute($data);
    }
    redirect('/admin');
}

if ($path === '/admin/order/status' && $method === 'POST') {
    require_admin();
    require_csrf();
    $id = (int) ($_POST['id'] ?? 0);
    $status = (string) ($_POST['status'] ?? 'new');
    if ($id > 0 && in_array($status, ['new', 'paid', 'processing', 'completed', 'cancelled', 'failed'], true)) {
        db()->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$status, $id]);
    }
    redirect('/admin');
}

function render_header(string $title): void { global $appName, $htmlLang, $path, $brandTagline, $contactLine, $themeClass; $isAdminRoute = strpos($path, '/admin') === 0; ?>
<!doctype html>
<html lang="<?= h($htmlLang) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($title) ?> · <?= h($appName) ?></title>
<link rel="stylesheet" href="/assets/style.css">
</head>
<body class="<?= h($themeClass) ?>">
<div class="page-shell">
<header class="topbar <?= $isAdminRoute ? 'admin-topbar' : '' ?>">
  <div class="topbar-inner">
    <a class="brand" href="/">
      <span class="brand-mark"></span>
      <span class="brand-copy"><strong><?= h($appName) ?></strong><small><?= h($brandTagline) ?></small></span>
    </a>
    <?php if ($isAdminRoute): ?>
      <nav class="nav-pill admin-nav">
        <a href="/">На сайт</a>
        <?php if (current_admin()): ?><a href="/admin/logout">Выйти</a><?php endif; ?>
      </nav>
    <?php else: ?>
      <nav class="nav-pill">
        <a class="<?= $path === '/' ? 'active' : '' ?>" href="/">Главная</a>
        <a href="/#catalog">Меню</a>
        <a class="<?= $path === '/cart' ? 'active' : '' ?>" href="/cart">Корзина<?= cart_count() > 0 ? ' · ' . (int) cart_count() : '' ?></a>
      </nav>
      <div class="top-actions">
        <span class="runtime-chip"><?= h($contactLine) ?></span>
        <a class="top-cta" href="/cart">Оформить заказ</a>
      </div>
    <?php endif; ?>
  </div>
</header>
<main>
<?php }

function render_footer(): void { global $appName, $themeClass; ?>
</main>
<footer><?= h($appName) ?> · <?= strpos($themeClass, 'theme-food') !== false ? 'меню, корзина и заказы' : 'онлайн-витрина и заявки' ?></footer>
</div>
</body>
</html>
<?php }

function render_admin_product_form(array $p, bool $open = false): void {
  $id = (int) ($p['id'] ?? 0);
  $name = (string) ($p['name'] ?? '');
  $price = (string) ($p['price'] ?? '');
  $isActive = (int) ($p['is_active'] ?? 1) === 1;
  ?>
  <details class="product-editor" <?= $open ? 'open' : '' ?>>
    <summary class="product-summary">
      <span class="summary-title"><?= h($name !== '' ? $name : 'Новая позиция') ?></span>
      <span class="summary-price"><?= h($price !== '' ? $price : 'цена') ?></span>
      <span class="summary-status <?= $isActive ? 'on' : 'off' ?>"><?= $isActive ? 'активна' : 'скрыта' ?></span>
      <span class="summary-action"><?= $id > 0 ? 'Редактировать' : 'Добавить' ?></span>
    </summary>
  <form class="product-row" method="post" action="/admin/product/save">
    <?= csrf_field() ?>
    <input type="hidden" name="id" value="<?= $id ?>">
    <label class="field product-name"><span>Название</span><input name="name" value="<?= h($name) ?>" placeholder="Капучино"></label>
    <label class="field product-price"><span>Цена</span><input name="price" type="number" step="0.01" value="<?= h($price) ?>" placeholder="7.50"></label>
    <label class="field product-order"><span>Сорт.</span><input name="sort_order" type="number" value="<?= (int) ($p['sort_order'] ?? 99) ?>"></label>
    <label class="switch product-active"><input type="checkbox" name="is_active" value="1" <?php if ($isActive) echo 'checked'; ?>><span>Активен</span></label>
    <label class="field product-description"><span>Описание</span><textarea name="description" placeholder="Короткое описание позиции"><?= h((string) ($p['description'] ?? '')) ?></textarea></label>
    <button class="product-save"><?= $id > 0 ? 'Сохранить' : 'Добавить' ?></button>
  </form>
  </details>
<?php }

function render_order_card(array $o): void { ?>
  <article class="order-card">
    <div class="order-head">
      <div>
        <b>#<?= (int) $o['id'] ?> · <?= h($o['customer_name']) ?></b>
        <span><?= h($o['customer_email']) ?><?= $o['customer_phone'] !== '' ? ' · ' . h($o['customer_phone']) : '' ?></span>
      </div>
      <span class="status status-<?= h($o['status']) ?>"><?= h($o['status']) ?></span>
    </div>
    <div class="order-meta">
      <span>Total: <strong><?= h((string) $o['total']) ?></strong></span>
      <span><?= h($o['created_at']) ?></span>
    </div>
    <form class="status-form" method="post" action="/admin/order/status">
      <?= csrf_field() ?>
      <input type="hidden" name="id" value="<?= (int) $o['id'] ?>">
      <select name="status">
        <?php foreach (['new', 'paid', 'processing', 'completed', 'cancelled', 'failed'] as $status): ?>
          <option value="<?= h($status) ?>" <?php if ($o['status'] === $status) echo 'selected'; ?>><?= h($status) ?></option>
        <?php endforeach; ?>
      </select>
      <button>Обновить</button>
    </form>
  </article>
<?php }

if ($path === '/admin/login') {
    if (current_admin()) {
        redirect('/admin');
    }
    render_header('Вход');
    ?>
    <section class="panel narrow">
      <h1>Вход в админку</h1>
      <?php if (!empty($loginError)): ?><p class="error">Неверный email или пароль</p><?php endif; ?>
      <form method="post">
        <?= csrf_field() ?>
        <label>Email <input name="email" type="email" value="admin@example.com" required></label>
        <label>Пароль <input name="password" type="password" placeholder="admin123" required></label>
        <button>Войти</button>
      </form>
      <p class="muted">Demo password: admin123. Смените пароль перед продакшеном.</p>
    </section>
    <?php
    render_footer();
    exit;
}

if ($path === '/admin') {
    require_admin();
    global $adminTitle, $catalogLabel, $itemsLabel, $activeLabel, $ordersLabel, $revenueLabel;
    $products = products();
    $orders = db()->query('SELECT * FROM orders ORDER BY id DESC LIMIT 50')->fetchAll();
    $activeProducts = 0;
    foreach ($products as $productRow) {
        if ((int) $productRow['is_active'] === 1) {
            $activeProducts++;
        }
    }
    $ordersTotal = 0.0;
    foreach ($orders as $orderRow) {
        $ordersTotal += (float) $orderRow['total'];
    }
    render_header('Админка');
    ?>
    <section class="admin-hero">
      <div>
        <p class="kicker">Admin dashboard</p>
        <h1><?= h($adminTitle) ?></h1>
        <p class="muted">Каталог, заявки, заказы, статусы и подготовка к hosted checkout в одном месте.</p>
      </div>
      <a class="admin-logout" href="/admin/logout">Выйти</a>
    </section>

    <section class="admin-stats">
      <article><span><?= h($itemsLabel) ?></span><strong><?= (int) count($products) ?></strong></article>
      <article><span><?= h($activeLabel) ?></span><strong><?= (int) $activeProducts ?></strong></article>
      <article><span><?= h($ordersLabel) ?></span><strong><?= (int) count($orders) ?></strong></article>
      <article><span><?= h($revenueLabel) ?></span><strong><?= h(number_format($ordersTotal, 2, '.', ' ')) ?></strong></article>
    </section>

    <section class="admin-grid">
      <div class="panel admin-products">
        <div class="section-title">
          <div>
            <p class="eyebrow"><?= h($catalogLabel) ?></p>
            <h2><?= h($itemsLabel) ?></h2>
          </div>
          <span class="badge"><?= (int) $activeProducts ?> active</span>
        </div>
        <div class="product-list">
          <?php foreach ($products as $p): ?>
            <?php render_admin_product_form($p); ?>
          <?php endforeach; ?>
        </div>
        <div class="new-product-box">
          <?php render_admin_product_form(['id' => 0, 'name' => '', 'description' => '', 'price' => '', 'sort_order' => 99, 'is_active' => 1]); ?>
        </div>
      </div>
      <div class="panel admin-orders">
        <div class="section-title">
          <div>
            <p class="eyebrow">Orders</p>
            <h2>Заказы</h2>
          </div>
          <span class="badge"><?= (int) count($orders) ?> total</span>
        </div>
        <?php foreach ($orders as $o): ?>
          <?php render_order_card($o); ?>
        <?php endforeach; ?>
        <?php if ($orders === []): ?>
          <p class="empty">Заказов пока нет. Создайте тестовый заказ из корзины.</p>
        <?php endif; ?>
      </div>
    </section>
    <?php
    render_footer();
    exit;
}

if ($path === '/cart') {
    $cart = cart_items();
    render_header('Корзина');
    ?>
    <section class="panel">
      <h1>Корзина</h1>
      <?php if ($cart === []): ?>
        <p>Корзина пуста.</p>
      <?php else: ?>
        <p class="total">Итого: <?= h((string) cart_total()) ?></p>
        <form method="post" action="/checkout" class="checkout">
          <?= csrf_field() ?>
          <label>Имя <input name="name" required></label>
          <label>Email <input name="email" type="email" required></label>
          <label>Телефон <input name="phone"></label>
          <button>Оформить заказ</button>
        </form>
      <?php endif; ?>
    </section>
    <?php
    render_footer();
    exit;
}

if ($path === '/checkout/success') {
    render_header('Заказ создан');
    echo '<section class="panel narrow"><h1>Заказ создан</h1><p>Мы сохранили заявку. Следующий шаг MVP: подключить hosted checkout и webhook платежного провайдера.</p></section>';
    render_footer();
    exit;
}

render_header('Витрина');
?>
<?php if ($heroKind === 1): ?>
<section class="store-hero">
  <div class="hero-copy">
    <p class="kicker"><?= h($heroEyebrow) ?></p>
    <h1><?= h($headline) ?></h1>
    <p><?= h($subheadline) ?></p>
    <div class="hero-actions">
      <a class="hero-btn" href="#catalog"><?= h($cta) ?></a>
      <a class="hero-link" href="#catalog">Посмотреть предложения</a>
    </div>
  </div>
  <div class="hero-stats">
    <article><strong><?= (int) count(products()) ?></strong><span><?= h($heroVisualMetric) ?></span></article>
    <article><strong>15 мин</strong><span>среднее время ответа</span></article>
    <article><strong>0%</strong><span>предоплата</span></article>
  </div>
</section>
<?php elseif ($heroKind === 2): ?>
<section class="store-hero">
  <div class="hero-visual" aria-label="Визуальная карточка предложения">
    <div class="visual-photo">
      <span><?= h($heroVisualTitle) ?></span>
    </div>
    <div class="visual-card main">
      <span>Доступно</span>
      <strong><?= (int) count(products()) ?></strong>
      <small><?= h($heroVisualMetric) ?></small>
    </div>
    <div class="visual-card floating one">Ответ 15 мин</div>
    <div class="visual-card floating two">Без предоплаты</div>
  </div>
  <div class="hero-copy">
    <p class="kicker"><?= h($heroEyebrow) ?></p>
    <h1><?= h($headline) ?></h1>
    <p><?= h($subheadline) ?></p>
    <div class="hero-actions">
      <a class="hero-btn" href="#catalog"><?= h($cta) ?></a>
      <a class="hero-link" href="#catalog">Посмотреть предложения</a>
    </div>
  </div>
</section>
<?php elseif ($heroKind === 3): ?>
<section class="store-hero">
  <div class="hero-copy">
    <p class="kicker"><?= h($heroEyebrow) ?></p>
    <h1><?= h($headline) ?></h1>
    <p><?= h($subheadline) ?></p>
    <div class="hero-actions">
      <a class="hero-btn" href="#catalog"><?= h($cta) ?></a>
      <a class="hero-link" href="#catalog">Посмотреть предложения</a>
    </div>
  </div>
  <div class="hero-grid" aria-hidden="true">
    <span></span><span></span><span></span><span></span><span></span><span></span>
  </div>
</section>
<?php else: ?>
<section class="store-hero">
  <div class="hero-copy">
    <p class="kicker"><?= h($heroEyebrow) ?></p>
    <h1><?= h($headline) ?></h1>
    <p><?= h($subheadline) ?></p>
    <div class="hero-actions">
      <a class="hero-btn" href="#catalog"><?= h($cta) ?></a>
      <a class="hero-link" href="#catalog">Посмотреть предложения</a>
    </div>
  </div>
  <div class="hero-visual" aria-label="Визуальная карточка предложения">
    <div class="visual-photo">
      <span><?= h($heroVisualTitle) ?></span>
    </div>
    <div class="visual-card main">
      <span>Доступно</span>
      <strong><?= (int) count(products()) ?></strong>
      <small><?= h($heroVisualMetric) ?></small>
    </div>
    <div class="visual-card floating one">Ответ 15 мин</div>
    <div class="visual-card floating two">Без предоплаты</div>
  </div>
</section>
<?php endif; ?>
<section class="trust-strip">
  <article><strong><?= h($trustOne) ?></strong><span>социальное доказательство</span></article>
  <article><strong><?= h($trustTwo) ?></strong><span>режим обработки</span></article>
  <article><strong>Безопасное оформление</strong><span>заявка сохраняется сразу</span></article>
</section>
<section class="catalog-head" id="catalog">
  <div>
    <p class="eyebrow">Витрина</p>
    <h2><?= h($catalogHeading) ?></h2>
  </div>
  <p class="muted">Выберите предложение, добавьте в корзину и оставьте заявку за пару кликов.</p>
</section>
<section class="products">
  <?php foreach (products() as $p): ?>
    <article class="product">
      <div class="product-art" aria-hidden="true">
        <span></span>
        <i></i>
        <b></b>
      </div>
      <div class="product-body">
      <h2><?= h($p['name']) ?></h2>
      <p><?= h($p['description']) ?></p>
      <strong><?= h((string) $p['price']) ?></strong>
      <form method="post" action="/cart/add">
        <?= csrf_field() ?>
        <input type="hidden" name="product_id" value="<?= (int) $p['id'] ?>">
        <button><?= h($cta) ?></button>
      </form>
      </div>
    </article>
  <?php endforeach; ?>
</section>
<section class="showcase-section">
  <div class="showcase-copy">
    <p class="eyebrow">Опыт клиента</p>
    <h2><?= h($showcaseTitle) ?></h2>
    <p><?= h($showcaseLead) ?></p>
  </div>
  <div class="showcase-grid">
    <?php foreach ($showcaseItems as $index => $item): ?>
      <article class="showcase-card">
        <span>0<?= (int) $index + 1 ?></span>
        <h3><?= h($item['title']) ?></h3>
        <p><?= h($item['text']) ?></p>
      </article>
    <?php endforeach; ?>
  </div>
</section>
<section class="benefits-section">
  <div class="section-kicker">
    <p class="eyebrow">Почему удобно</p>
    <h2><?= h($benefitsHeading) ?></h2>
  </div>
  <div class="benefit-grid">
    <?php foreach ($benefits as $benefit): ?>
      <article class="benefit-card">
        <span></span>
        <h3><?= h($benefit['title']) ?></h3>
        <p><?= h($benefit['description']) ?></p>
      </article>
    <?php endforeach; ?>
  </div>
</section>
<section class="reviews-section">
  <div class="section-kicker">
    <p class="eyebrow">Отзывы</p>
    <h2>Люди приходят за понятным сервисом, а не за формой на сайте</h2>
  </div>
  <div class="review-grid">
    <?php foreach ($reviews as $review): ?>
      <article class="review-card">
        <div class="review-avatar"><?= h(mb_substr((string) $review['name'], 0, 1)) ?></div>
        <div>
          <div class="stars">★★★★★</div>
          <p><?= h($review['text']) ?></p>
          <strong><?= h($review['name']) ?></strong>
        </div>
      </article>
    <?php endforeach; ?>
  </div>
</section>
<section class="proof-section">
  <div>
    <p class="eyebrow">Вопросы перед заявкой</p>
    <h2>Ответы, которые снимают сомнения</h2>
  </div>
  <div class="faq-grid">
    <?php foreach ($faqItems as $item): ?>
      <article>
        <h3><?= h($item['question']) ?></h3>
        <p><?= h($item['answer']) ?></p>
      </article>
    <?php endforeach; ?>
  </div>
</section>
<?php
render_footer();
`;
}

function styleVariant(plan: Plan): { neon: boolean; seed: number; theme: StorefrontTheme; accent: string; accent2: string; radius: number; head: number; hero: number; cat: number; band: number; struct: number; surf: number; btn: number } {
  const kw = (plan.keywords || []).join(" ");
  const txt = `${plan.business_type} ${kw} ${(plan.sections || []).join(" ")}`.toLowerCase();
  const mood = String(plan.color_mood || "").toLowerCase();
  const neon = /neon|dark/.test(mood) || /неон|тёмн|темн|ночн|кибер|cyber|dark|neon|глитч|glitch/.test(txt);
  let h = 2166136261 >>> 0;
  const seedStr = `${plan.business_type}|${kw}`;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  if (typeof plan.variantSeed === "number") { h = (h ^ (plan.variantSeed >>> 0)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
  const theme = storefrontTheme(plan);
  const neonAccents: [string, string][] = [["#22d3ee", "#a855f7"], ["#a855f7", "#22d3ee"], ["#4ade80", "#22d3ee"], ["#f0abfc", "#818cf8"], ["#38bdf8", "#34d399"], ["#fb7185", "#f0abfc"], ["#facc15", "#fb7185"], ["#2dd4bf", "#a855f7"]];
  const lightByTheme: Record<StorefrontTheme, [string, string][]> = {
    beauty: [["#d9468f", "#f472b6"], ["#db2777", "#fb7185"], ["#e11d48", "#f9a8d4"], ["#be185d", "#f472b6"], ["#c026d3", "#f0abfc"]],
    food: [["#b45309", "#f59e0b"], ["#ea580c", "#fbbf24"], ["#c2410c", "#f97316"], ["#9a3412", "#fb923c"], ["#a16207", "#facc15"]],
    "real-estate": [["#15803d", "#34d399"], ["#0f766e", "#2dd4bf"], ["#047857", "#10b981"], ["#166534", "#4ade80"], ["#0e7490", "#22d3ee"]],
    clinic: [["#0891b2", "#22d3ee"], ["#0d9488", "#2dd4bf"], ["#2563eb", "#38bdf8"], ["#0284c7", "#38bdf8"], ["#0369a1", "#22d3ee"]],
    courses: [["#6d28d9", "#a78bfa"], ["#4f46e5", "#818cf8"], ["#7c3aed", "#c084fc"], ["#5b21b6", "#a78bfa"], ["#4338ca", "#818cf8"]],
    auto: [["#ea580c", "#fb923c"], ["#475569", "#fb923c"], ["#dc2626", "#f87171"], ["#b91c1c", "#fb923c"], ["#334155", "#f59e0b"]],
    generic: [["#2563eb", "#60a5fa"], ["#7c3aed", "#a78bfa"], ["#0891b2", "#22d3ee"], ["#e11d48", "#fb7185"], ["#ea580c", "#fbbf24"], ["#0d9488", "#2dd4bf"], ["#4f46e5", "#818cf8"], ["#db2777", "#f472b6"], ["#16a34a", "#4ade80"], ["#9333ea", "#c084fc"], ["#0284c7", "#38bdf8"], ["#d97706", "#fbbf24"]],
  };
  const list = neon ? neonAccents : (lightByTheme[theme] || lightByTheme.generic);
  const pair = list[h % list.length];
  const radius = [12, 16, 20, 26, 32][(h >>> 3) % 5];
  const head = (h >>> 5) % 3;
  const hero = (h >>> 7) % 4;
  const cat = (h >>> 9) % 4;
  const band = (h >>> 11) % 2;
  const struct = (h >>> 13) % 6;
  const surf = (h >>> 15) % 3;
  const btn = (h >>> 17) % 3;
  return { neon, seed: h, theme, accent: pair[0], accent2: pair[1], radius, head, hero, cat, band, struct, surf, btn };
}

function buildStyleCss(plan: Plan): string {
  const v = styleVariant(plan);
  const neon = v.neon;
  const dark = neon;
  const isBeauty = v.theme === "beauty";
  const isFood = v.theme === "food";
  const isRealEstate = v.theme === "real-estate";
  const bg = neon ? "#070912" : isBeauty ? "#fbf3f6" : isFood ? "#fbf1e3" : isRealEstate ? "#f3f7f4" : "#f7f4ee";
  const ink = neon ? "#eef2ff" : isFood ? "#2a1810" : "#111827";
  const muted = neon ? "#94a3b8" : isFood ? "#7a6255" : "#667085";
  const card = neon ? "rgba(18,22,40,.72)" : isFood ? "rgba(255,250,242,.9)" : "rgba(255,255,255,.82)";
  const accent = v.accent;
  const accent2 = v.accent2;
  const line = neon ? "rgba(148,163,184,.2)" : "rgba(127,127,127,.22)";
  const soft = neon ? "rgba(148,163,184,.08)" : "rgba(127,127,127,.08)";
  const shadow = neon ? "0 24px 80px rgba(0,0,0,.55)" : "0 32px 100px rgba(15,23,42,.12)";
  const radius = v.radius;
  const neonCss = neon ? `body{background:radial-gradient(circle at 12% -10%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 36%),radial-gradient(circle at 88% 4%,color-mix(in srgb,var(--accent2) 16%,transparent),transparent 30%),linear-gradient(180deg,#070912,#0a0e1c)}
body.mood-neon .hero-visual,body.mood-neon .product,body.mood-neon .panel,body.mood-neon .benefit-card,body.mood-neon .review-card,body.mood-neon .showcase-card,body.mood-neon .showcase-copy,body.mood-neon .admin-stats article,body.mood-neon .trust-strip article{box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 20%,transparent),0 24px 70px rgba(0,0,0,.5)}
body.mood-neon .hero-btn,body.mood-neon .top-cta,body.mood-neon button,body.mood-neon .admin-logout{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#07111a;box-shadow:0 0 26px color-mix(in srgb,var(--accent) 55%,transparent)}
body.mood-neon .store-hero h1,body.mood-neon .admin-hero h1{text-shadow:0 0 34px color-mix(in srgb,var(--accent) 42%,transparent)}
body.mood-neon .product strong,body.mood-neon .admin-stats strong,body.mood-neon .total,body.mood-neon .visual-card.main strong{text-shadow:0 0 20px color-mix(in srgb,var(--accent) 50%,transparent)}
body.mood-neon .kicker,body.mood-neon .eyebrow,body.mood-neon .badge{border-color:color-mix(in srgb,var(--accent) 40%,transparent);box-shadow:0 0 16px color-mix(in srgb,var(--accent) 20%,transparent)}
body.mood-neon input,body.mood-neon textarea,body.mood-neon select{background:rgba(148,163,184,.06)}` : "";
  const headCss = v.head === 1 ? `body.head-1 .store-hero h1,body.head-1 .admin-hero h1,body.head-1 .showcase-copy h2,body.head-1 .section-kicker h2,body.head-1 .proof-section h2,body.head-1 .catalog-head h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.035em}` : v.head === 2 ? `body.head-2 .store-hero h1,body.head-2 .catalog-head h2,body.head-2 .section-kicker h2,body.head-2 .admin-hero h1{text-transform:uppercase}body.head-2 .store-hero h1{letter-spacing:-.04em}` : "";
  const heroCss = `.hero-1 .store-hero{grid-template-columns:1fr;text-align:center;justify-items:center}.hero-1 .store-hero .hero-copy{max-width:840px}.hero-1 .store-hero p{margin-left:auto;margin-right:auto}.hero-1 .hero-actions{justify-content:center}.hero-1 .store-hero h1{max-width:none}.hero-1 .hero-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:34px;width:min(820px,100%)}.hero-1 .hero-stats article{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow)}.hero-1 .hero-stats strong{display:block;font-size:34px;color:var(--accent);letter-spacing:-.04em}.hero-1 .hero-stats span{display:block;color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-top:6px}.hero-2 .store-hero{grid-template-columns:440px minmax(0,1fr)}.hero-3 .store-hero{grid-template-columns:1fr}.hero-3 .hero-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px}.hero-3 .hero-grid span{aspect-ratio:4/3;border-radius:var(--radius);border:1px solid var(--line);background:radial-gradient(circle at 50% 30%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 60%),linear-gradient(135deg,color-mix(in srgb,var(--accent) 14%,transparent),rgba(255,255,255,.16));box-shadow:var(--shadow)}
@media(max-width:720px){.hero-1 .store-hero,.hero-2 .store-hero{grid-template-columns:1fr}.hero-1 .hero-stats{grid-template-columns:1fr}.hero-3 .hero-grid{grid-template-columns:repeat(2,1fr)}}`;
  const catCss = `.cat-1 .products{grid-template-columns:1fr;gap:14px}.cat-1 .product{flex-direction:row;min-height:0;align-items:stretch}.cat-1 .product .product-art{flex:0 0 220px;height:auto;border-bottom:0;border-right:1px solid var(--line)}.cat-1 .product .product-body{flex:1}.cat-1 .product strong{margin:14px 0}.cat-2 .products{grid-template-columns:repeat(2,1fr)}.cat-3 .product-art{display:none}.cat-3 .product{min-height:0}.cat-3 .product-body{padding-top:28px}
@media(max-width:720px){.cat-1 .product{flex-direction:column}.cat-1 .product .product-art{flex:auto;border-right:0;border-bottom:1px solid var(--line)}.cat-2 .products{grid-template-columns:1fr}}`;
  const bandCss = `.band-1 .benefits-section,.band-1 .showcase-section{background:var(--soft);border:1px solid var(--line);border-radius:calc(var(--radius) + 10px);padding:40px 30px;margin:16px 0 30px}`;
  const structCss = `main{display:flex;flex-direction:column}.struct-1 .showcase-section{display:none}.struct-1 .catalog-head,.struct-1 .products{order:1}.struct-1 .benefits-section{order:2}.struct-1 .trust-strip{order:3}.struct-1 .reviews-section{order:4}.struct-1 .proof-section{order:5}.struct-2 .trust-strip,.struct-2 .reviews-section{display:none}.struct-2 .benefits-section{order:1}.struct-2 .showcase-section{order:2}.struct-2 .catalog-head,.struct-2 .products{order:3}.struct-2 .proof-section{order:4}.struct-3 .showcase-section,.struct-3 .proof-section{display:none}.struct-3 .trust-strip{order:1}.struct-3 .benefits-section{order:2}.struct-3 .catalog-head,.struct-3 .products{order:3}.struct-3 .reviews-section{order:4}.struct-4 .trust-strip,.struct-4 .showcase-section{display:none}.struct-4 .catalog-head,.struct-4 .products{order:1}.struct-4 .reviews-section{order:2}.struct-4 .benefits-section{order:3}.struct-4 .proof-section{order:4}.struct-5 .showcase-section,.struct-5 .benefits-section,.struct-5 .reviews-section{display:none}.struct-5 .trust-strip{order:1}.struct-5 .catalog-head,.struct-5 .products{order:2}.struct-5 .proof-section{order:3}`;
  const radiusCss = `body .product,body .panel,body .hero-visual,body .benefit-card,body .review-card,body .showcase-card,body .showcase-copy,body .admin-stats article,body .trust-strip article,body .order-card,body .product-form{border-radius:var(--radius)}`;
  const surfCss = `body:not(.mood-neon).surf-1 .product,body:not(.mood-neon).surf-1 .panel,body:not(.mood-neon).surf-1 .benefit-card,body:not(.mood-neon).surf-1 .review-card,body:not(.mood-neon).surf-1 .showcase-card,body:not(.mood-neon).surf-1 .trust-strip article,body:not(.mood-neon).surf-1 .admin-stats article,body:not(.mood-neon).surf-1 .order-card,body:not(.mood-neon).surf-1 .product-form{background:transparent;box-shadow:none;border:1.5px solid var(--line)}body:not(.mood-neon).surf-2 .product,body:not(.mood-neon).surf-2 .panel,body:not(.mood-neon).surf-2 .benefit-card,body:not(.mood-neon).surf-2 .review-card,body:not(.mood-neon).surf-2 .showcase-card,body:not(.mood-neon).surf-2 .trust-strip article,body:not(.mood-neon).surf-2 .admin-stats article{background:var(--soft);box-shadow:0 10px 30px rgba(15,23,42,.05)}`;
  const btnCss = `.btn-1 button,.btn-1 .hero-btn,.btn-1 .top-cta,.btn-1 .admin-logout{border-radius:999px}.btn-2 button,.btn-2 .hero-btn,.btn-2 .top-cta,.btn-2 .admin-logout{border-radius:6px}`;

  return `:root{--bg:${bg};--ink:${ink};--muted:${muted};--card:${card};--accent:${accent};--accent2:${accent2};--line:${line};--soft:${soft};--radius:${radius}px;--danger:#ef4444;--ok:#16a34a;--warn:#f59e0b;--shadow:${shadow}}
${neonCss}
${headCss}
${heroCss}
${catCss}
${bandCss}
${structCss}
${radiusCss}
${surfCss}
${btnCss}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 8% -12%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 30%),radial-gradient(circle at 90% 8%,rgba(255,255,255,.42),transparent 26%),var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}.page-shell{min-height:100vh;background:linear-gradient(180deg,rgba(255,255,255,.28),transparent 420px)}
a{color:inherit}.topbar{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(24px);border-bottom:1px solid var(--line)}
.topbar-inner{width:min(1180px,88vw);height:72px;margin:0 auto;display:grid;grid-template-columns:220px minmax(260px,1fr) 190px;gap:18px;align-items:center}.brand{min-width:0;font-weight:950;text-decoration:none;font-size:18px;display:flex;align-items:center;gap:12px}.brand-mark{flex:0 0 auto;width:38px;height:38px;border-radius:14px;background:radial-gradient(circle at 35% 30%,#fff 0 10%,transparent 11%),linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 30%,#fff));box-shadow:0 0 0 8px color-mix(in srgb,var(--accent) 10%,transparent),0 18px 40px color-mix(in srgb,var(--accent) 18%,transparent)}.brand-copy{display:grid;line-height:1.05;min-width:0}.brand-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.brand-copy small{margin-top:4px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.14em;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nav-pill{justify-self:center;display:flex;align-items:center;gap:4px;padding:5px;border:1px solid var(--line);border-radius:999px;background:color-mix(in srgb,var(--card) 70%,transparent);box-shadow:0 18px 50px rgba(15,23,42,.08)}.nav-pill a{color:var(--muted);text-decoration:none;font-weight:850;padding:10px 18px;border-radius:999px;white-space:nowrap}.nav-pill a:hover,.nav-pill a.active{color:var(--ink);background:var(--card);box-shadow:0 10px 24px rgba(15,23,42,.08)}.top-actions{display:flex;justify-content:flex-end;align-items:center;gap:8px;min-width:0}.runtime-chip{display:none}.top-cta{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 16px;text-decoration:none;color:${dark ? "#061014" : "#fff"};font-weight:950;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 72%,#fff));box-shadow:0 14px 34px color-mix(in srgb,var(--accent) 22%,transparent);max-width:170px;text-align:center;line-height:1.05}
main{width:min(1180px,88vw);margin:0 auto}.store-hero{display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:56px;align-items:center;padding:92px 0 56px}.store-hero h1{font-size:clamp(58px,8vw,104px);line-height:.88;letter-spacing:-.08em;margin:18px 0 22px;max-width:760px}.store-hero p{max-width:650px;color:var(--muted);font-size:20px}.hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:30px}.hero-btn{display:inline-flex;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 72%,#fff));color:#fff;text-decoration:none;border-radius:18px;padding:16px 22px;font-weight:950;box-shadow:0 20px 50px color-mix(in srgb,var(--accent) 22%,transparent)}.hero-link{color:var(--muted);font-weight:850;text-decoration:none}.hero-visual{height:430px;position:relative;border:1px solid var(--line);border-radius:42px;background:linear-gradient(135deg,rgba(255,255,255,.58),rgba(255,255,255,.18));box-shadow:var(--shadow);overflow:hidden}.hero-visual::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 34% 22%,color-mix(in srgb,var(--accent) 34%,transparent),transparent 26%),radial-gradient(circle at 80% 76%,rgba(255,255,255,.55),transparent 24%)}.visual-photo{position:absolute;left:34px;right:34px;top:34px;bottom:34px;border-radius:32px;border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 16%,transparent),rgba(255,255,255,.2));overflow:hidden}.visual-photo::before{content:"";position:absolute;left:18%;right:18%;bottom:0;height:52%;border-radius:999px 999px 0 0;background:linear-gradient(180deg,rgba(255,255,255,.72),color-mix(in srgb,var(--accent) 18%,transparent))}.visual-photo span{position:absolute;left:24px;top:24px;color:var(--accent);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.visual-card{position:absolute;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:18px 20px;box-shadow:var(--shadow);backdrop-filter:blur(12px)}.visual-card.main{left:38px;bottom:38px;width:210px}.visual-card.main span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;font-weight:900}.visual-card.main strong{font-size:64px;line-height:.9;color:var(--accent)}.visual-card.main small{display:block;color:var(--muted);font-weight:800}.visual-card.floating{font-weight:950;color:var(--accent)}.visual-card.one{right:30px;top:34px}.visual-card.two{right:64px;bottom:78px}.kicker,.eyebrow{display:inline-flex;border:1px solid var(--line);padding:8px 12px;border-radius:999px;color:var(--accent)!important;background:color-mix(in srgb,var(--card) 66%,transparent);font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
.trust-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:8px 0 42px}.trust-strip article{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:18px;box-shadow:var(--shadow)}.trust-strip strong{display:block;color:var(--ink);font-size:17px}.trust-strip span{display:block;color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-top:4px}.catalog-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:26px 0 18px}.catalog-head h2{font-size:42px;letter-spacing:-.05em;margin:8px 0 0}.catalog-head p{max-width:420px}
.products{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;padding:8px 0 90px}.product,.panel{background:var(--card);border:1px solid var(--line);border-radius:30px;padding:0;box-shadow:var(--shadow);backdrop-filter:blur(14px)}
.product{position:relative;overflow:hidden;display:flex;flex-direction:column;min-height:520px}.product-art{height:190px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 20%,color-mix(in srgb,var(--accent) 28%,transparent),transparent 32%),linear-gradient(135deg,color-mix(in srgb,var(--accent) 14%,transparent),rgba(255,255,255,.2));border-bottom:1px solid var(--line)}.product-art span{position:absolute;left:50%;top:50%;width:96px;height:96px;transform:translate(-50%,-50%);border-radius:32px;background:linear-gradient(135deg,rgba(255,255,255,.86),color-mix(in srgb,var(--accent) 20%,transparent));box-shadow:var(--shadow)}.product-art i{position:absolute;left:18%;bottom:-16%;width:150px;height:150px;border-radius:50%;background:color-mix(in srgb,var(--accent) 18%,transparent);filter:blur(.2px)}.product-art b{position:absolute;right:14%;top:18%;width:74px;height:74px;border-radius:24px;background:rgba(255,255,255,.62);box-shadow:0 20px 60px rgba(15,23,42,.08)}.product-body{padding:26px;display:flex;flex:1;flex-direction:column}.product h2{margin:0 0 18px;font-size:28px;letter-spacing:-.03em}.product p,.muted{color:var(--muted)}.product strong{display:block;font-size:38px;margin:22px 0;color:var(--accent);letter-spacing:-.05em}.product form{margin-top:auto}
.showcase-section{display:grid;grid-template-columns:.86fr 1.14fr;gap:24px;align-items:stretch;padding:6px 0 82px}.showcase-copy{border-radius:32px;padding:32px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 16%,transparent),rgba(255,255,255,.2));border:1px solid var(--line);box-shadow:var(--shadow)}.showcase-copy h2{font-size:clamp(34px,5vw,62px);line-height:.94;letter-spacing:-.06em;margin:12px 0}.showcase-copy p{color:var(--muted);font-size:18px}.showcase-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.showcase-card{background:var(--card);border:1px solid var(--line);border-radius:28px;padding:24px;box-shadow:var(--shadow)}.showcase-card span{display:inline-flex;color:var(--accent);font-weight:950;font-size:13px;margin-bottom:38px}.showcase-card h3{font-size:24px;margin:0 0 10px;letter-spacing:-.04em}.showcase-card p{margin:0;color:var(--muted)}
.theme-beauty .hero-visual{background:linear-gradient(135deg,rgba(255,255,255,.58),rgba(255,236,246,.28));}.theme-beauty .hero-visual::after{content:"";position:absolute;right:54px;top:82px;width:112px;height:112px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 10%,transparent 11%),linear-gradient(135deg,#f9a8d4,var(--accent));box-shadow:0 34px 80px color-mix(in srgb,var(--accent) 24%,transparent)}.theme-beauty .visual-photo::after{content:"";position:absolute;left:28%;right:28%;top:30%;height:42%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.18));box-shadow:0 28px 80px rgba(217,70,143,.16)}.theme-beauty .product-art{background:radial-gradient(circle at 52% 28%,rgba(255,255,255,.78),transparent 18%),linear-gradient(135deg,rgba(249,168,212,.42),rgba(255,255,255,.38))}.theme-beauty .product-art::after{content:"";position:absolute;width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,.7),rgba(217,70,143,.18));filter:blur(.2px)}
.theme-food .topbar{background:rgba(251,241,227,.86)}.theme-food .brand-mark{border-radius:50%;background:radial-gradient(circle at 36% 32%,#fff8 0 9%,transparent 10%),linear-gradient(135deg,#7c2d12,#d97706)}.theme-food .brand-mark::after{content:"";display:block;width:18px;height:10px;border-radius:0 0 18px 18px;border:2px solid rgba(255,255,255,.82);border-top:0;margin:18px auto 0}.theme-food .store-hero h1{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.065em}.theme-food .hero-visual{background:linear-gradient(135deg,rgba(255,250,242,.84),rgba(245,158,11,.12))}.theme-food .visual-photo::after{content:"";position:absolute;left:26%;right:26%;top:26%;height:36%;border-radius:0 0 80px 80px;border:10px solid rgba(124,45,18,.22);border-top:0}.theme-food .visual-photo span::before{content:"☕ ";}.theme-food .product-art{background:radial-gradient(circle at 48% 26%,rgba(255,255,255,.82),transparent 18%),linear-gradient(135deg,rgba(180,83,9,.22),rgba(255,247,237,.74))}.theme-food .product-art span{border-radius:999px 999px 40px 40px;background:linear-gradient(180deg,#fff7ed,#fed7aa)}.theme-food .product-art span::after{content:"";position:absolute;right:-18px;top:36px;width:30px;height:24px;border:7px solid rgba(124,45,18,.26);border-left:0;border-radius:0 999px 999px 0}.theme-food .product strong::after{content:" BYN";font-size:14px;color:var(--muted);letter-spacing:0;margin-left:5px}.theme-food .top-cta,.theme-food .hero-btn,.theme-food button,.theme-food .admin-logout{background:linear-gradient(135deg,#92400e,#d97706);color:#fff}
.topbar-inner{height:auto;min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{width:230px}.nav-pill{flex:0 1 auto}.top-actions{width:230px}.admin-topbar .topbar-inner{justify-content:space-between}.admin-topbar .brand{width:auto}.admin-nav{margin-left:auto}.admin-nav a{padding:10px 18px}.admin-topbar .top-cta,.admin-topbar .runtime-chip{display:none}.store-hero{grid-template-columns:minmax(0,1fr) 380px;gap:42px;padding:72px 0 50px}.store-hero h1{font-size:clamp(46px,6.4vw,82px);line-height:.94}.theme-food .store-hero h1{font-size:clamp(44px,5.8vw,76px);line-height:.98}.hero-visual{height:360px}.products{grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.product{min-height:430px}.product-art{height:150px}.product h2{font-size:24px}.product strong{font-size:30px;margin:14px 0}.admin-hero{padding:34px 0 16px}.admin-hero h1{font-size:clamp(38px,5vw,64px)}.admin-stats{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.admin-stats article{padding:16px}.admin-grid{grid-template-columns:1fr;gap:16px}.product-list{display:grid;gap:8px}.product-row{display:grid;grid-template-columns:minmax(180px,1.5fr) 110px 82px 112px auto;grid-template-areas:"name price sort active save" "description description description description description";gap:8px;align-items:end;border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(255,255,255,.48)}.product-row input,.product-row textarea,.product-row select{padding:10px 12px;border-radius:12px}.product-row .field{gap:5px}.product-row .product-name{grid-area:name}.product-row .product-price{grid-area:price}.product-row .product-order{grid-area:sort}.product-row .product-active{grid-area:active}.product-row .product-description{grid-area:description}.product-row .product-save{grid-area:save;align-self:end;min-height:42px}.product-row textarea{min-height:44px}.new-product-box{margin-top:12px;border:1px dashed var(--line);border-radius:18px;padding:12px;background:var(--soft)}.new-product-box summary{cursor:pointer;font-weight:950;color:var(--accent)}.new-product-box .product-row{margin-top:12px}.narrow{max-width:560px;padding:34px}.narrow form{display:grid;gap:12px}.admin-orders{align-self:start}.order-card{background:rgba(255,255,255,.52)}
.benefits-section,.proof-section{padding:12px 0 82px}.section-kicker{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:20px}.section-kicker h2,.proof-section h2{font-size:clamp(34px,5vw,64px);line-height:.94;letter-spacing:-.06em;margin:10px 0 0;max-width:760px}.benefit-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.benefit-card,.faq-grid article{background:var(--card);border:1px solid var(--line);border-radius:26px;padding:24px;box-shadow:var(--shadow)}.benefit-card span{width:42px;height:42px;border-radius:16px;display:block;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 32%,#fff));box-shadow:0 16px 40px color-mix(in srgb,var(--accent) 20%,transparent);margin-bottom:24px}.benefit-card h3,.faq-grid h3{font-size:22px;letter-spacing:-.03em;margin:0 0 10px}.benefit-card p,.faq-grid p{color:var(--muted);margin:0}.proof-section{display:grid;grid-template-columns:.82fr 1.18fr;gap:24px;align-items:start}.faq-grid{display:grid;gap:14px}
.reviews-section{padding:0 0 82px}.review-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.review-card{display:grid;grid-template-columns:auto 1fr;gap:16px;background:var(--card);border:1px solid var(--line);border-radius:26px;padding:22px;box-shadow:var(--shadow)}.review-avatar{width:52px;height:52px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 36%,#fff));color:#fff;font-weight:950;font-size:22px}.stars{color:var(--accent);letter-spacing:.08em;font-size:13px;margin-bottom:8px}.review-card p{margin:0 0 12px;color:var(--muted)}.review-card strong{font-weight:950}
button,.admin-logout{border:0;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 76%,#fff));color:${dark ? "#061014" : "#fff"};border-radius:16px;padding:13px 18px;font-weight:950;cursor:pointer;text-decoration:none;text-align:center;box-shadow:0 14px 34px color-mix(in srgb,var(--accent) 22%,transparent)}button:hover,.admin-logout:hover{filter:brightness(1.04);transform:translateY(-1px)}
input,textarea,select{width:100%;border:1px solid var(--line);border-radius:16px;padding:13px 15px;background:${dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.86)"};color:var(--ink);font:inherit;outline:none}input:focus,textarea:focus,select:focus{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 12%,transparent)}textarea{min-height:92px;resize:vertical}.field{display:grid;gap:7px}.field span{font-size:11px;color:var(--muted);font-weight:900;text-transform:uppercase;letter-spacing:.1em}
.grid.two{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;padding:34px 0 70px}.narrow{max-width:520px;margin:44px auto}.checkout{display:grid;gap:12px;margin:14px 0}.total{font-size:28px;font-weight:900;color:var(--accent)}.error{color:var(--danger)}
.admin-hero{display:flex;align-items:end;justify-content:space-between;gap:18px;padding:52px 0 24px}.admin-hero h1{font-size:clamp(42px,6vw,82px);line-height:.88;letter-spacing:-.07em;margin:14px 0 12px}.admin-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:10px 0 24px}.admin-stats article{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:var(--shadow)}.admin-stats span{display:block;color:var(--muted);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.1em}.admin-stats strong{font-size:38px;color:var(--accent);letter-spacing:-.06em}
.admin-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(320px,.7fr);gap:18px;padding:12px 0 70px}.section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.section-title.compact{margin-top:24px}.section-title h2{font-size:30px;margin:2px 0 0}.badge{display:inline-flex;align-items:center;border-radius:999px;padding:7px 10px;background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent);font-size:12px;font-weight:900}
.product-form{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;border:1px solid var(--line);border-radius:22px;padding:18px;margin-bottom:14px;background:var(--soft)}.span-3{grid-column:span 3}.span-6{grid-column:span 6}.span-9{grid-column:span 9}.span-12{grid-column:span 12}.switch{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:14px;padding:12px 14px;color:var(--muted);font-weight:800}.switch input{width:auto;accent-color:var(--accent)}
.order-card{display:grid;gap:14px;border:1px solid var(--line);border-radius:20px;padding:16px;margin-bottom:14px;background:var(--soft)}.order-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.order-head b{display:block}.order-head span,.order-meta{color:var(--muted);font-size:13px}.order-meta{display:flex;justify-content:space-between;gap:10px}.status{border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;text-transform:uppercase;background:var(--line)}.status-paid,.status-completed{background:color-mix(in srgb,var(--ok) 16%,transparent);color:var(--ok)}.status-processing{background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)}.status-cancelled,.status-failed{background:color-mix(in srgb,var(--danger) 16%,transparent);color:var(--danger)}.status-form{display:grid;grid-template-columns:1fr auto;gap:10px}.empty{color:var(--muted);padding:20px;border:1px dashed var(--line);border-radius:18px}
.admin-hero{padding:34px 0 16px}.admin-hero h1{font-size:clamp(38px,5vw,64px)}.admin-stats{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.admin-stats article{padding:16px}.admin-grid{grid-template-columns:1fr;gap:16px}.product-list{display:grid;gap:8px}.product-editor{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.5);overflow:hidden}.product-editor[open]{background:rgba(255,255,255,.72);box-shadow:var(--shadow)}.product-editor:not([open])>.product-row{display:none}.product-summary{cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) 90px 82px 120px;gap:10px;align-items:center;padding:14px 16px;list-style:none}.product-summary::-webkit-details-marker{display:none}.summary-title{font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.summary-price{font-weight:950;color:var(--accent);text-align:right}.summary-status{font-size:11px;text-transform:uppercase;font-weight:950;border-radius:999px;padding:5px 9px;text-align:center;background:var(--line);color:var(--muted)}.summary-status.on{background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok)}.summary-action{font-weight:900;color:var(--accent);text-align:right}.product-row{display:grid;grid-template-columns:minmax(180px,1.5fr) 110px 82px 112px auto;grid-template-areas:"name price sort active save" "description description description description description";gap:8px;align-items:end;border-top:1px solid var(--line);padding:12px 14px;background:var(--soft)}.product-row input,.product-row textarea,.product-row select{padding:10px 12px;border-radius:12px}.product-row .field{gap:5px}.product-row .product-name{grid-area:name}.product-row .product-price{grid-area:price}.product-row .product-order{grid-area:sort}.product-row .product-active{grid-area:active}.product-row .product-description{grid-area:description}.product-row .product-save{grid-area:save;align-self:end;min-height:42px}.product-row textarea{min-height:44px}.new-product-box{margin-top:12px;border:1px dashed var(--line);border-radius:18px;padding:12px;background:var(--soft)}.new-product-box .product-editor{background:transparent}.new-product-box .product-summary{display:grid}.narrow{max-width:560px;padding:34px}.narrow form{display:grid;gap:12px}.admin-orders{align-self:start}.order-card{background:rgba(255,255,255,.52)}
footer{width:min(1180px,88vw);margin:0 auto;padding:28px 0 44px;color:var(--muted);border-top:1px solid var(--line)}
@media(max-width:720px){.topbar-inner{height:auto;padding:14px 0;display:flex;align-items:flex-start;flex-direction:column}.brand,.top-actions{width:auto}.nav-pill{justify-content:space-between;overflow:auto;width:100%}.top-actions{justify-content:flex-start}.store-hero,.grid.two,.admin-grid,.proof-section,.showcase-section{grid-template-columns:1fr}.hero-visual{min-height:300px}.trust-strip,.benefit-grid,.review-grid,.showcase-grid{grid-template-columns:1fr}.admin-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.catalog-head,.admin-hero,.section-kicker{align-items:flex-start;flex-direction:column}.span-3,.span-6,.span-9{grid-column:span 12}.product-summary{grid-template-columns:minmax(0,1fr) 70px 74px}.summary-action{display:none}.product-row{grid-template-columns:minmax(0,1fr) 92px 70px;grid-template-areas:"name price sort" "description description description" "active save save"}.product-row .product-save{width:100%}}
`;
}

function buildReadme(plan: Plan): string {
  return `# ${plan.business_type}

Generated by NIT backend mode: HTML + PHP + SQLite.

## Requirements

- PHP 7.4+
- PDO SQLite enabled for the default setup
- Optional: PDO MySQL for \`DB_DRIVER=mysql\`

## Run locally

\`\`\`bash
php -S localhost:8080 router.php
\`\`\`

Open http://localhost:8080

Admin:
- URL: http://localhost:8080/admin/login
- Email: admin@example.com
- Password: admin123

## Database

Default database is SQLite at \`storage/app.sqlite\`.

- SQLite schema: \`database/schema.sqlite.sql\`
- MySQL schema: \`database/schema.mysql.sql\`

For MySQL, set:

\`\`\`bash
DB_DRIVER=mysql
MYSQL_DSN='mysql:host=127.0.0.1;dbname=nit_app;charset=utf8mb4'
MYSQL_USER=root
MYSQL_PASSWORD=secret
\`\`\`

## Payments

This MVP stores orders and routes checkout through \`app/payments.php\`.

Default:

\`\`\`bash
PAYMENT_PROVIDER=manual
\`\`\`

Hosted checkout adapter:

\`\`\`bash
PAYMENT_PROVIDER=stripe
PAYMENT_CHECKOUT_BASE_URL='https://payments.example.com/create-session'
PAYMENT_WEBHOOK_SECRET='change-me'
\`\`\`

Keep Stripe/YooKassa/CloudPayments secret keys on the server side only.

## Apache shared hosting

Upload the project so \`public/\` is the document root. The generated
\`public/.htaccess\` routes clean URLs to \`public/index.php\`.
`;
}

export function buildPhpSqliteArtifact(params: {
  plan: Plan;
  userMessage: string;
}): PhpSqliteArtifact {
  const { plan } = params;
  return {
    kind: "php-sqlite-app",
    version: 1,
    entrypoint: "public/index.php",
    database: "sqlite",
    notes: [
      "MVP ecommerce backend: catalog, cart, checkout order capture, admin login, product CRUD, orders list.",
      "Payments are intentionally represented as hosted-checkout integration points, not secret keys in generated HTML.",
      "SQLite is the default; MySQL can be enabled through environment variables.",
    ],
    files: [
      { path: "README.md", content: buildReadme(plan) },
      { path: "router.php", content: buildRouterPhp() },
      { path: "app/config.php", content: buildConfigPhp(plan) },
      { path: "app/db.php", content: buildDbPhp() },
      { path: "app/security.php", content: buildSecurityPhp() },
      { path: "app/auth.php", content: buildAuthPhp() },
      { path: "app/payments.php", content: buildPaymentsPhp() },
      { path: "database/schema.sqlite.sql", content: buildSqliteSchemaSql(plan) },
      { path: "database/schema.mysql.sql", content: buildMysqlSchemaSql(plan) },
      { path: "public/index.php", content: buildIndexPhp(plan) },
      { path: "public/.htaccess", content: buildHtaccess() },
      { path: "public/assets/style.css", content: buildStyleCss(plan) },
      { path: "storage/.gitkeep", content: "" },
    ],
  };
}

type PreviewDbColumn = { name: string; type: string; key?: "pk" | "fk" };
type PreviewDbTable = { name: string; purpose: string; columns: PreviewDbColumn[] };

function previewDatabaseSchema(plan: Plan): PreviewDbTable[] {
  const ru = isRu(plan);
  return [
    {
      name: "admins",
      purpose: ru ? "Администраторы панели" : "Panel admins",
      columns: [
        { name: "id", type: "INTEGER", key: "pk" },
        { name: "email", type: "TEXT UNIQUE" },
        { name: "password_hash", type: "TEXT" },
        { name: "created_at", type: "TEXT" },
      ],
    },
    {
      name: "products",
      purpose: ru ? "Каталог товаров и услуг" : "Catalog",
      columns: [
        { name: "id", type: "INTEGER", key: "pk" },
        { name: "name", type: "TEXT" },
        { name: "description", type: "TEXT" },
        { name: "price", type: "REAL" },
        { name: "sort_order", type: "INTEGER" },
        { name: "is_active", type: "INTEGER" },
        { name: "created_at", type: "TEXT" },
      ],
    },
    {
      name: "orders",
      purpose: ru ? "Заказы и заявки" : "Orders and leads",
      columns: [
        { name: "id", type: "INTEGER", key: "pk" },
        { name: "customer_name", type: "TEXT" },
        { name: "customer_email", type: "TEXT" },
        { name: "customer_phone", type: "TEXT" },
        { name: "status", type: "TEXT" },
        { name: "total", type: "REAL" },
        { name: "created_at", type: "TEXT" },
      ],
    },
    {
      name: "order_items",
      purpose: ru ? "Позиции заказов" : "Order line items",
      columns: [
        { name: "id", type: "INTEGER", key: "pk" },
        { name: "order_id", type: "INTEGER", key: "fk" },
        { name: "product_id", type: "INTEGER", key: "fk" },
        { name: "name", type: "TEXT" },
        { name: "qty", type: "INTEGER" },
        { name: "price", type: "REAL" },
      ],
    },
  ];
}

function renderStorefrontPreviewHtml(plan: Plan, manifestJson: string): string {
  const ru = isRu(plan);
  const theme = storefrontTheme(plan);
  const products = productSeeds(plan);
  const appName = storefrontDisplayName(plan);
  const lang = plan.language || "ru";

  const headline = heroHeadline(plan);
  const subheadline = publicText(
    plan.hero_subheadline || plan.target_audience,
    ru ? "Выберите предложение и оставьте заявку онлайн." : "Choose an offer and submit a request online.",
  );
  const cta =
    theme === "food"
      ? ru ? "Добавить в заказ" : "Add to order"
      : publicText(plan.cta_primary || (ru ? "В корзину" : "Add to cart"), ru ? "Оформить заявку" : "Submit request");
  const heroEyebrow =
    theme === "beauty"
      ? ru ? "Запись без предоплаты" : "Booking without prepayment"
      : theme === "food"
        ? ru ? "Меню, корзина и заказы без лишних звонков" : "Menu, cart, and orders"
        : publicText(
            plan.cta_microcopy || (ru ? "Без предоплаты. Ответ за 15 минут." : "No prepayment. Fast reply."),
            ru ? "Без предоплаты. Ответ за 15 минут." : "No prepayment. Fast reply.",
          );
  const heroVisualTitle =
    theme === "beauty"
      ? ru ? "персональный уход" : "personal care"
      : theme === "food"
        ? ru ? "кофе и десерты" : "coffee and desserts"
        : ru ? "подбор предложения" : "tailored offer";
  const heroVisualMetric =
    theme === "beauty"
      ? ru ? "мастера и услуги" : "masters and services"
      : theme === "food"
        ? ru ? "позиций меню" : "menu items"
        : ru ? "активные предложения" : "active offers";
  const catalogHeading =
    theme === "beauty"
      ? ru ? "Выберите формат визита" : "Choose your visit"
      : theme === "food"
        ? ru ? "Меню напитков и десертов" : "Coffee and dessert menu"
        : ru ? "Витрина предложений" : "Offer showcase";
  const benefitsHeading =
    theme === "beauty"
      ? ru ? "Сервис ощущается ещё до визита" : "Service felt before the visit"
      : theme === "food"
        ? ru ? "Заказ проходит быстро и понятно" : "Ordering is fast and clear"
        : ru ? "Понятный путь к заявке" : "A clear path to a request";
  const trustOne = publicText(
    plan.social_proof_line || (ru ? "Более 500 заказов и заявок" : "500+ orders and leads"),
    ru ? "Более 500 заявок" : "500+ requests",
  );
  const trustTwo = publicText(
    plan.hours_text || (ru ? "Онлайн-заявки 24/7" : "Online requests 24/7"),
    ru ? "Онлайн-заявки 24/7" : "Online requests 24/7",
  );
  const brandTagline =
    theme === "food"
      ? ru ? "кофе · десерты · заказы" : "coffee · desserts · orders"
      : ru ? "онлайн-витрина" : "online storefront";
  const contactLine = publicText(
    plan.contact_phone || plan.contact_email || (ru ? "Ответим в течение дня" : "We reply within a day"),
    ru ? "Ответим в течение дня" : "We reply within a day",
  );

  const benefits = plan.key_benefits?.length
    ? plan.key_benefits
    : [
        { title: ru ? "Быстрый ответ" : "Fast reply", description: ru ? "Заявка сразу уходит менеджеру." : "The request is sent immediately." },
        { title: ru ? "Понятные предложения" : "Clear offers", description: ru ? "Видно состав и цену, легко выбрать." : "Each offer has a clear scope and price." },
        { title: ru ? "Удобная запись" : "Easy booking", description: ru ? "Оформление занимает меньше минуты." : "The request takes under a minute." },
      ];
  const faqs = plan.faq?.length
    ? plan.faq
    : [
        { question: ru ? "Как быстро вы отвечаете?" : "How fast do you reply?", answer: ru ? "Обычно в течение 15 минут в рабочее время." : "Usually within 15 minutes." },
        { question: ru ? "Нужна ли предоплата?" : "Do I need to prepay?", answer: ru ? "Можно оставить заявку без предоплаты." : "You can submit a request without prepayment." },
        { question: ru ? "Можно изменить заявку?" : "Can I change my request?", answer: ru ? "Да, менеджер уточнит детали." : "Yes, the manager confirms details." },
      ];
  const reviews = [
    { name: ru ? "Анна" : "Anna", text: ru ? "Оставила заявку утром, быстро согласовали время и услугу." : "Sent a request in the morning, quickly agreed on time." },
    { name: ru ? "Мария" : "Maria", text: ru ? "Удобно выбирать пакет: видно, что входит и сколько стоит." : "Packages are easy to compare." },
    { name: ru ? "Елена" : "Elena", text: ru ? "После заявки менеджер написал почти сразу." : "The manager replied almost immediately." },
  ];
  const showcaseTitle =
    theme === "beauty"
      ? ru ? "Атмосфера, мастер и запись в одном сценарии" : "Atmosphere, master and booking in one flow"
      : theme === "food"
        ? ru ? "От витрины меню до готового заказа" : "From menu to ready order"
        : ru ? "Как устроен путь клиента" : "How the customer journey works";
  const showcaseLead =
    theme === "beauty"
      ? ru ? "Сайт передаёт ощущение салона: спокойствие, аккуратность и быстрый контакт." : "The site conveys the salon feel."
      : theme === "food"
        ? ru ? "Гость выбирает напитки и десерты и оставляет заказ без звонка." : "Guests pick drinks and order without a call."
        : ru ? "Показываем предложение, помогаем выбрать и сохраняем заявку." : "Show the offer, help choose, save the request.";
  const showcaseItems =
    theme === "beauty"
      ? [
          { title: ru ? "Атмосфера" : "Atmosphere", text: ru ? "Мягкая подача помогает почувствовать уровень сервиса." : "Soft visuals convey the service level." },
          { title: ru ? "Мастера" : "Masters", text: ru ? "Пакеты оформлены так, чтобы видеть разницу." : "Packages make the difference clear." },
          { title: ru ? "Запись" : "Booking", text: ru ? "Заявка без лишних полей сразу в работе." : "A lean request goes straight to work." },
        ]
      : theme === "food"
        ? [
            { title: ru ? "Меню" : "Menu", text: ru ? "Позиции выглядят как настоящие напитки и десерты." : "Items look like real drinks and desserts." },
            { title: ru ? "Корзина" : "Cart", text: ru ? "Гость собирает заказ и видит сумму." : "Guests build an order and see the total." },
            { title: ru ? "Админка" : "Admin", text: ru ? "Владелец меняет цены и статусы без программиста." : "The owner edits prices and statuses." },
          ]
        : [
            { title: ru ? "Выбор" : "Choose", text: ru ? "Клиент сравнивает предложения без шума." : "Compare offers without noise." },
            { title: ru ? "Заявка" : "Request", text: ru ? "Форма собирает контакты и фиксирует заказ." : "The form captures contacts and the order." },
            { title: ru ? "Статус" : "Status", text: ru ? "Администратор ведёт заявку по статусам." : "The admin moves it through statuses." },
          ];

  const tables = previewDatabaseSchema(plan);

  const productsHtml = products
    .map(
      (p) => `      <article class="product">
        <div class="product-art" aria-hidden="true"><span></span><i></i><b></b></div>
        <div class="product-body">
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.features.join(" · "))}</p>
          <strong>${esc(p.price)}</strong>
          <button type="button">${esc(cta)}</button>
        </div>
      </article>`,
    )
    .join("\n");

  const showcaseHtml = showcaseItems
    .map(
      (item, i) => `      <article class="showcase-card"><span>0${i + 1}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`,
    )
    .join("\n");

  const benefitsHtml = benefits
    .map(
      (b) => `      <article class="benefit-card"><span></span><h3>${esc(b.title)}</h3><p>${esc(b.description)}</p></article>`,
    )
    .join("\n");

  const reviewsHtml = reviews
    .map(
      (r) => `      <article class="review-card"><div class="review-avatar">${esc(r.name.slice(0, 1))}</div><div><div class="stars">★★★★★</div><p>${esc(r.text)}</p><strong>${esc(r.name)}</strong></div></article>`,
    )
    .join("\n");

  const faqHtml = faqs
    .map((f) => `      <article><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></article>`)
    .join("\n");

  const adminProductsHtml = products
    .map(
      (p) => `        <details class="product-editor"><summary class="product-summary"><span class="summary-title">${esc(p.name)}</span><span class="summary-price">${esc(p.price)}</span><span class="summary-status on">${ru ? "активна" : "active"}</span><span class="summary-action">${ru ? "Редактировать" : "Edit"}</span></summary></details>`,
    )
    .join("\n");

  const dbTablesHtml = tables
    .map(
      (t) => `      <div class="db-table">
        <div class="db-table-head"><h3>${esc(t.name)}</h3><span>${esc(t.purpose)}</span></div>
        <ul class="db-cols">
${t.columns
  .map(
    (c) => `          <li><span class="db-col-name">${esc(c.name)}</span><span class="db-col-meta"><span class="db-col-type">${esc(c.type)}</span>${c.key === "pk" ? `<span class="db-key">PK</span>` : c.key === "fk" ? `<span class="db-key fk">FK</span>` : ""}</span></li>`,
  )
  .join("\n")}
        </ul>
      </div>`,
    )
    .join("\n");

  const tabStore = ru ? "Витрина" : "Storefront";
  const tabAdmin = ru ? "Админка" : "Admin";
  const tabDb = ru ? "База данных" : "Database";

  const chromeCss = `
body{padding:0}
.nit-view-radio{position:absolute;opacity:0;pointer-events:none;width:0;height:0}
.preview-switch{position:sticky;top:0;z-index:60;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:16px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(22px);border-bottom:1px solid var(--line);box-shadow:0 14px 34px rgba(15,23,42,.10)}
.preview-switch label{cursor:pointer;font-weight:900;font-size:14px;letter-spacing:.02em;padding:11px 24px;border-radius:999px;border:1px solid var(--line);color:var(--muted);background:color-mix(in srgb,var(--card) 70%,transparent);transition:all .15s}
.preview-switch label:hover{color:var(--ink)}
#nit-view-store:checked~.preview-switch label[for="nit-view-store"],#nit-view-admin:checked~.preview-switch label[for="nit-view-admin"],#nit-view-db:checked~.preview-switch label[for="nit-view-db"]{color:#fff;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 72%,#fff));border-color:transparent;box-shadow:0 12px 30px color-mix(in srgb,var(--accent) 24%,transparent)}
.preview-pane{display:none}
#nit-view-store:checked~.pane-store,#nit-view-admin:checked~.pane-admin,#nit-view-db:checked~.pane-db{display:block}
.preview-pane .topbar{position:static}
.preview-pane .page-shell{min-height:auto}
.db-wrap{width:min(1180px,88vw);margin:0 auto;padding:52px 0 84px}
.db-head{margin-bottom:28px}
.db-head h1{font-size:clamp(40px,6vw,72px);letter-spacing:-.06em;line-height:.92;margin:14px 0 12px}
.db-head p{max-width:680px}
.db-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.db-table{background:var(--card);border:1px solid var(--line);border-radius:24px;overflow:hidden;box-shadow:var(--shadow)}
.db-table-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--accent) 9%,transparent)}
.db-table-head h3{margin:0;font-size:18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent)}
.db-table-head span{font-size:11px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.07em;text-align:right}
.db-cols{list-style:none;margin:0;padding:8px}
.db-cols li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border-radius:12px}
.db-cols li+li{border-top:1px solid var(--soft)}
.db-col-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;font-size:14px}
.db-col-meta{display:flex;align-items:center;gap:8px}
.db-col-type{font-size:12px;color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.db-key{font-size:10px;font-weight:900;letter-spacing:.05em;border-radius:999px;padding:3px 8px;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)}
.db-key.fk{background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)}
.db-foot{margin-top:20px}
`;

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(appName)}</title>
<style>
${buildStyleCss(plan)}
${chromeCss}
</style>
</head>
<body class="theme-${esc(theme)} nit-preview">
<input class="nit-view-radio" type="radio" name="nit-view" id="nit-view-store" checked>
<input class="nit-view-radio" type="radio" name="nit-view" id="nit-view-admin">
<input class="nit-view-radio" type="radio" name="nit-view" id="nit-view-db">
<div class="preview-switch">
  <label for="nit-view-store">${esc(tabStore)}</label>
  <label for="nit-view-admin">${esc(tabAdmin)}</label>
  <label for="nit-view-db">${esc(tabDb)}</label>
</div>

<div class="preview-pane pane-store"><div class="page-shell">
  <header class="topbar"><div class="topbar-inner">
    <a class="brand" href="#"><span class="brand-mark"></span><span class="brand-copy"><strong>${esc(appName)}</strong><small>${esc(brandTagline)}</small></span></a>
    <nav class="nav-pill"><a class="active" href="#">${ru ? "Главная" : "Home"}</a><a href="#catalog">${ru ? "Каталог" : "Catalog"}</a><a href="#catalog">${ru ? "Корзина" : "Cart"}</a></nav>
    <div class="top-actions"><span class="runtime-chip">${esc(contactLine)}</span><a class="top-cta" href="#catalog">${ru ? "Оформить заказ" : "Order"}</a></div>
  </div></header>
  <main>
    <section class="store-hero">
      <div class="hero-copy">
        <p class="kicker">${esc(heroEyebrow)}</p>
        <h1>${esc(headline)}</h1>
        <p>${esc(subheadline)}</p>
        <div class="hero-actions"><a class="hero-btn" href="#catalog">${esc(cta)}</a><a class="hero-link" href="#catalog">${ru ? "Посмотреть предложения" : "See offers"}</a></div>
      </div>
      <div class="hero-visual">
        <div class="visual-photo"><span>${esc(heroVisualTitle)}</span></div>
        <div class="visual-card main"><span>${ru ? "Доступно" : "Available"}</span><strong>${products.length}</strong><small>${esc(heroVisualMetric)}</small></div>
        <div class="visual-card floating one">${ru ? "Ответ 15 мин" : "Reply 15 min"}</div>
        <div class="visual-card floating two">${ru ? "Без предоплаты" : "No prepay"}</div>
      </div>
    </section>
    <section class="trust-strip">
      <article><strong>${esc(trustOne)}</strong><span>${ru ? "социальное доказательство" : "social proof"}</span></article>
      <article><strong>${esc(trustTwo)}</strong><span>${ru ? "режим обработки" : "processing"}</span></article>
      <article><strong>${ru ? "Безопасное оформление" : "Secure checkout"}</strong><span>${ru ? "заявка сохраняется сразу" : "saved instantly"}</span></article>
    </section>
    <section class="catalog-head" id="catalog"><div><p class="eyebrow">${ru ? "Витрина" : "Showcase"}</p><h2>${esc(catalogHeading)}</h2></div><p class="muted">${ru ? "Выберите предложение и оставьте заявку за пару кликов." : "Pick an offer and submit a request in a couple of clicks."}</p></section>
    <section class="products">
${productsHtml}
    </section>
    <section class="showcase-section">
      <div class="showcase-copy"><p class="eyebrow">${ru ? "Опыт клиента" : "Experience"}</p><h2>${esc(showcaseTitle)}</h2><p>${esc(showcaseLead)}</p></div>
      <div class="showcase-grid">
${showcaseHtml}
      </div>
    </section>
    <section class="benefits-section">
      <div class="section-kicker"><p class="eyebrow">${ru ? "Почему удобно" : "Why"}</p><h2>${esc(benefitsHeading)}</h2></div>
      <div class="benefit-grid">
${benefitsHtml}
      </div>
    </section>
    <section class="reviews-section">
      <div class="section-kicker"><p class="eyebrow">${ru ? "Отзывы" : "Reviews"}</p><h2>${ru ? "Приходят за понятным сервисом" : "People come for clear service"}</h2></div>
      <div class="review-grid">
${reviewsHtml}
      </div>
    </section>
    <section class="proof-section">
      <div><p class="eyebrow">${ru ? "Вопросы перед заявкой" : "Before you ask"}</p><h2>${ru ? "Ответы, которые снимают сомнения" : "Answers that remove doubts"}</h2></div>
      <div class="faq-grid">
${faqHtml}
      </div>
    </section>
  </main>
  <footer>${esc(appName)} · ${theme === "food" ? (ru ? "меню, корзина и заказы" : "menu, cart and orders") : ru ? "онлайн-витрина и заявки" : "storefront and requests"}</footer>
</div></div>

<div class="preview-pane pane-admin"><div class="page-shell">
  <header class="topbar admin-topbar"><div class="topbar-inner">
    <a class="brand" href="#"><span class="brand-mark"></span><span class="brand-copy"><strong>${esc(appName)}</strong><small>${ru ? "панель управления" : "control room"}</small></span></a>
    <nav class="nav-pill admin-nav"><a href="#">${ru ? "На сайт" : "Site"}</a><a href="#">${ru ? "Выйти" : "Logout"}</a></nav>
  </div></header>
  <main>
    <section class="admin-hero"><div><p class="kicker">Admin dashboard</p><h1>${ru ? "Управление проектом" : "Project control room"}</h1><p class="muted">${ru ? "Каталог, заявки, заказы и статусы в одном месте." : "Catalog, leads, orders and statuses in one place."}</p></div><a class="admin-logout" href="#">${ru ? "Выйти" : "Logout"}</a></section>
    <section class="admin-stats">
      <article><span>${ru ? "Позиции" : "Items"}</span><strong>${products.length}</strong></article>
      <article><span>${ru ? "Активных" : "Active"}</span><strong>${products.length}</strong></article>
      <article><span>${ru ? "Заказы" : "Orders"}</span><strong>0</strong></article>
      <article><span>${ru ? "Оборот" : "Revenue"}</span><strong>0.00</strong></article>
    </section>
    <section class="admin-grid">
      <div class="panel admin-products">
        <div class="section-title"><div><p class="eyebrow">${ru ? "Каталог" : "Catalog"}</p><h2>${ru ? "Позиции" : "Items"}</h2></div><span class="badge">${products.length} active</span></div>
        <div class="product-list">
${adminProductsHtml}
        </div>
      </div>
      <div class="panel admin-orders">
        <div class="section-title"><div><p class="eyebrow">Orders</p><h2>${ru ? "Заказы" : "Orders"}</h2></div><span class="badge">0 total</span></div>
        <p class="empty">${ru ? "Заказов пока нет. Они появятся здесь после первой заявки из корзины." : "No orders yet. They appear after the first checkout."}</p>
      </div>
    </section>
  </main>
  <footer>${esc(appName)} · ${ru ? "защищённая админка" : "secure admin"}</footer>
</div></div>

<div class="preview-pane pane-db"><div class="page-shell">
  <div class="db-wrap">
    <div class="db-head"><p class="kicker">SQLite · ${tables.length} ${ru ? "таблицы" : "tables"}</p><h1>${ru ? "База данных" : "Database"}</h1><p class="muted">${ru ? "Структура создаётся автоматически при первом запуске. PDO prepared statements, внешние ключи и каскады уже настроены." : "Schema is created automatically on first run. PDO prepared statements and foreign keys are configured."}</p></div>
    <div class="db-grid">
${dbTablesHtml}
    </div>
    <p class="db-foot muted">${ru ? "Демо-вход в админку: admin@example.com / admin123 — смените перед продакшеном." : "Demo admin: admin@example.com / admin123 — change before production."}</p>
  </div>
</div></div>

<script id="nit-artifact-manifest" type="application/json">${manifestJson}</script>
</body>
</html>`;
}

// Живой предпросмотр: исполняет сгенерированный PHP+SQLite прямо в iframe через
// php-wasm. Возвращается одной zero-branch строкой (String.raw, без ${} и без
// тернарников) — это важно, чтобы не ронять branch-coverage. Весь рантайм-код
// читает манифест артефакта из DOM (#nit-artifact-manifest) и работает в опак-
// origin sandbox-iframe (allow-scripts), поэтому БД живёт в памяти (MEMFS).
// ВАЖНО: живой движок грузит php-wasm с cdn.jsdelivr.net и компилирует WASM —
// требует в CSP (app/entry.server.tsx): script-src+connect-src с jsdelivr и
// 'wasm-unsafe-eval'. Без этого boot падает в catch и остаётся статика.
function buildLivePreviewBootScript(): string {
  return String.raw`<script>
(function(){
  var manifestEl=document.getElementById('nit-artifact-manifest');
  if(!manifestEl){return;}
  var manifest;
  try{manifest=JSON.parse(manifestEl.textContent||'{}');}catch(e){return;}
  var files=(manifest&&manifest.files)||[];
  if(!files.length){return;}
  var storePane=document.querySelector('.pane-store');
  var adminPane=document.querySelector('.pane-admin');
  var dbPane=document.querySelector('.pane-db');
  var switchBar=document.querySelector('.preview-switch');
  if(!storePane||!adminPane||!dbPane){return;}
  function fileContent(p){for(var i=0;i<files.length;i++){if(files[i].path===p){return files[i].content;}}return '';}
  var APP_CSS=fileContent('public/assets/style.css');
  var htmlLang=document.documentElement.getAttribute('lang')||'ru';
  var isRu=htmlLang.indexOf('ru')===0;

  var chip=document.createElement('span');
  chip.className='nit-live-chip';
  chip.setAttribute('style','margin-left:8px;font-size:11px;font-weight:800;color:var(--muted);align-self:center;white-space:nowrap');
  chip.textContent=isRu?'\u25F7 live\u2026':'\u25F7 live\u2026';
  if(switchBar){switchBar.appendChild(chip);}

  var liveStyle=document.createElement('style');
  liveStyle.textContent='.nit-live-frame{width:100%;height:78vh;min-height:540px;border:0;background:#fff;display:block}.db-live-grid{display:grid;gap:16px;grid-template-columns:1fr}.db-live-table{background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:var(--shadow)}.db-live-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--accent) 9%,transparent)}.db-live-head h3{margin:0;font-family:ui-monospace,Menlo,monospace;font-size:16px;color:var(--accent)}.db-live-head span{font-size:11px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.06em}.db-scroll{overflow:auto;max-height:340px}.db-data{width:100%;border-collapse:collapse;font-size:13px}.db-data th{position:sticky;top:0;background:var(--bg);text-align:left;padding:9px 12px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap}.db-data td{padding:9px 12px;border-bottom:1px solid var(--soft);white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis}.db-data tr:hover td{background:var(--soft)}.db-empty{padding:18px;color:var(--muted)}';
  document.head.appendChild(liveStyle);

  var php=null;var SID='';var outBuf='';var phpErr='';var DRIVERS='';var dbSnap=null;var PhpCtor=null;var PHP_OPTS=null;
  var chain=Promise.resolve();
  function queue(fn){var r=chain.then(fn);chain=r.then(function(v){return v;},function(){});return r;}
  function b64(s){return btoa(unescape(encodeURIComponent(String(s||''))));}
  function timeout(ms){return new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'));},ms);});}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function buildEntry(uri,method,body){
    var m=/^(GET|POST)$/.test(method)?method:'GET';
    var sidLine=SID?("$_COOKIE['PHPSESSID']='"+SID+"';"):'';
    return "<?php error_reporting(E_ERROR|E_PARSE);ini_set('display_errors','1');define('NIT_PREVIEW',true);"
      +"if(!function_exists('mb_substr')){function mb_substr($s,$st,$l=null){return $l===null?substr((string)$s,$st):substr((string)$s,$st,$l);}}"
      +"if(!function_exists('mb_strlen')){function mb_strlen($s){return strlen((string)$s);}}"
      +"if(!function_exists('mb_strtoupper')){function mb_strtoupper($s){return strtoupper((string)$s);}}"
      +"$_SERVER['REQUEST_URI']=base64_decode('"+b64(uri)+"');"
      +"$_SERVER['REQUEST_METHOD']='"+m+"';"
      +"$_SERVER['REMOTE_ADDR']='127.0.0.1';$_SERVER['SERVER_NAME']='localhost';$_SERVER['SERVER_PORT']='80';$_SERVER['HTTP_HOST']='localhost';$_SERVER['SCRIPT_NAME']='/index.php';"
      +sidLine
      +"parse_str(base64_decode('"+b64(body||'')+"'),$_POST);$_REQUEST=$_POST;$_GET=array();"
      +"register_shutdown_function(function(){$l='';foreach(headers_list() as $h){if(stripos($h,'Location:')===0){$l=trim(substr($h,9));}}echo '@@NITMETA@@'.json_encode(array('redirect'=>$l,'sid'=>session_id()));});"
      +"chdir('/app/public');require '/app/public/index.php';";
  }
  var DUMP="<?php error_reporting(E_ERROR|E_PARSE);ini_set('display_errors','1');require '/app/app/db.php';migrate();$o=array();foreach(array('products','orders','order_items','admins') as $t){$o[$t]=db()->query('SELECT * FROM '.$t)->fetchAll(PDO::FETCH_ASSOC);}echo json_encode($o);";

  function reinit(){
    if(php&&php.destroy){try{php.destroy();}catch(e){}}
    php=new PhpCtor(PHP_OPTS);
    php.addEventListener('output',function(e){var d=e.detail;outBuf+=(d&&d.join)?d.join(''):(d==null?'':d);});
    php.addEventListener('error',function(e){var d=e.detail;phpErr+=(d&&d.join)?d.join(''):(d||'');});
    return writeProject().then(function(){if(dbSnap){return php.writeFile('/app/storage/app.sqlite',dbSnap).catch(function(){});}});
  }
  function runRequest(uri,method,body){
    return queue(function(){
      phpErr='';outBuf='';
      return reinit().then(function(){return php.run(buildEntry(uri,method,body));}).then(function(){
        var raw=outBuf;var html=raw;var redirect='';
        var ri=raw.indexOf('@@NITREDIRECT@@');
        if(ri>=0){html=raw.slice(0,ri);redirect=raw.slice(ri+15).trim();}
        else{var idx=raw.indexOf('@@NITMETA@@');if(idx>=0){html=raw.slice(0,idx);try{var meta=JSON.parse(raw.slice(idx+11));if(meta&&meta.sid){SID=meta.sid;}redirect=(meta&&meta.redirect)||'';}catch(e){}}}
        return php.readFile('/app/storage/app.sqlite').then(function(b){dbSnap=b;}).catch(function(){}).then(function(){return {html:html,redirect:redirect,raw:raw};});
      });
    });
  }
  function follow(res,depth){
    if(res&&res.redirect&&depth<5){
      return runRequest(res.redirect,'GET','').then(function(r){return follow(r,depth+1);});
    }
    return Promise.resolve(res);
  }
  function runRaw(code){
    return queue(function(){
      phpErr='';outBuf='';
      return reinit().then(function(){return php.run(code);}).then(function(){
        var raw=outBuf;
        return php.readFile('/app/storage/app.sqlite').then(function(b){dbSnap=b;}).catch(function(){}).then(function(){return raw;});
      });
    });
  }

  function interceptorSrc(frame){
    return "document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a'):null;if(!a){return;}var h=a.getAttribute('href');if(!h||h.charAt(0)==='#'){return;}if(/^(https?:|mailto:|tel:)/i.test(h)){a.setAttribute('target','_blank');a.setAttribute('rel','noopener');return;}e.preventDefault();parent.postMessage({nit:'nav',frame:'"+frame+"',href:h},'*');},true);"
      +"document.addEventListener('submit',function(e){var f=e.target;if(!f||f.tagName!=='FORM'){return;}e.preventDefault();var p=new URLSearchParams();var fd=new FormData(f);fd.forEach(function(v,k){if(typeof v==='string'){p.append(k,v);}});var action=f.getAttribute('action')||'/';var method=(f.getAttribute('method')||'GET').toUpperCase();parent.postMessage({nit:'submit',frame:'"+frame+"',action:action,method:method,body:p.toString()},'*');},true);";
  }
  function decorate(html,frame){
    var out=String(html||'').replace('<link rel="stylesheet" href="/assets/style.css">','<style>'+APP_CSS+'</style>');
    out+='<script>'+interceptorSrc(frame)+'<\/script>';
    return out;
  }
  function makeFrame(pane){
    pane.innerHTML='';
    var f=document.createElement('iframe');
    f.className='nit-live-frame';
    f.setAttribute('sandbox','allow-scripts');
    f.setAttribute('title',pane===adminPane?'admin':'storefront');
    pane.appendChild(f);
    return f;
  }
  var storeFrame=null,adminFrame=null;

  function renderStore(){
    storeFrame=makeFrame(storePane);
    return runRequest('/','GET','').then(function(r){return follow(r,0);}).then(function(r){var h=(r.html&&r.html.replace(/\s/g,''))?r.html:('<pre style="padding:16px;white-space:pre-wrap;color:#c0392b;font:13px ui-monospace,monospace">[empty output]\ndrivers: '+esc(DRIVERS)+'\nstderr: '+esc(phpErr).slice(0,3000)+'</pre>');storeFrame.srcdoc=decorate(h,'store');});
  }
  function extractCsrf(html){var m=String(html||'').match(/name="csrf_token"\s+value="([^"]+)"/);return m?m[1]:'';}
  function renderAdmin(){
    adminFrame=makeFrame(adminPane);
    return runRequest('/admin','GET','').then(function(r){return follow(r,0);}).then(function(r){var h=(r.html&&r.html.replace(/\s/g,''))?r.html:('<pre style="padding:16px;white-space:pre-wrap;color:#c0392b;font:13px ui-monospace,monospace">[admin empty]\ndrivers: '+esc(DRIVERS)+'\nstderr: '+esc(phpErr).slice(0,2000)+'</pre>');adminFrame.srcdoc=decorate(h,'admin');});
  }
  function renderDb(){
    return runRaw(DUMP).then(function(json){
      var data;try{data=JSON.parse(json);}catch(e){return;}
      dbPane.innerHTML=dbViewer(data);
    });
  }
  function dbViewer(data){
    var order=['products','orders','order_items','admins'];
    var h='<div class="db-wrap"><div class="db-head"><p class="kicker">SQLite \u00B7 '+(isRu?'\u0436\u0438\u0432\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435':'live data')+'</p><h1>'+(isRu?'\u0411\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u044B\u0445':'Database')+'</h1><p class="muted">'+(isRu?'\u0420\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0438\u0437 \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0449\u0435\u0433\u043E SQLite \u0432 \u044D\u0442\u043E\u043C \u043F\u0440\u0435\u0432\u044C\u044E.':'Real rows from the running SQLite in this preview.')+'</p></div><div class="db-live-grid">';
    for(var k=0;k<order.length;k++){
      var t=order[k];var rows=(data&&data[t])||[];
      h+='<div class="db-live-table"><div class="db-live-head"><h3>'+t+'</h3><span>'+rows.length+(isRu?' \u0441\u0442\u0440\u043E\u043A':' rows')+'</span></div>';
      if(!rows.length){h+='<p class="db-empty">'+(isRu?'\u041F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E':'Empty')+'</p></div>';continue;}
      var cols=Object.keys(rows[0]);
      h+='<div class="db-scroll"><table class="db-data"><thead><tr>';
      for(var c=0;c<cols.length;c++){h+='<th>'+esc(cols[c])+'</th>';}
      h+='</tr></thead><tbody>';
      for(var r=0;r<rows.length;r++){
        h+='<tr>';
        for(var c2=0;c2<cols.length;c2++){
          var col=cols[c2];var val=rows[r][col];
          if(col==='password_hash'){val=isRu?'\u2022\u2022\u2022\u2022 \u0445\u0435\u0448':'\u2022\u2022\u2022\u2022 hash';}
          h+='<td>'+esc(val)+'</td>';
        }
        h+='</tr>';
      }
      h+='</tbody></table></div></div>';
    }
    h+='</div><p class="db-foot muted">'+(isRu?'\u0414\u0435\u043C\u043E-\u0432\u0445\u043E\u0434: admin@example.com / admin123':'Demo admin: admin@example.com / admin123')+'</p></div>';
    return h;
  }

  window.addEventListener('message',function(ev){
    var d=ev.data;if(!d||(d.nit!=='nav'&&d.nit!=='submit')){return;}
    var frame=d.frame==='admin'?'admin':'store';
    var target=frame==='admin'?adminFrame:storeFrame;
    var req=d.nit==='nav'?runRequest(d.href,'GET',''):runRequest(d.action,d.method,d.body);
    req.then(function(r){return follow(r,0);}).then(function(r){
      if(target){target.srcdoc=decorate(r.html,frame);}
      return renderDb();
    }).catch(function(){});
  });

  function ensureDir(d){return php.analyzePath(d).then(function(a){if(a&&a.exists){return;}return php.mkdir(d).catch(function(){});});}
  function patchPreview(content){
    var c=String(content||'');
    if(c.indexOf('@@NITREDIRECT@@')<0){c=c.replace(/function redirect\(string \$path\)([^{]*)\{/,"function redirect(string $path)$1{\n    if (defined('NIT_PREVIEW')) { echo '@@NITREDIRECT@@' . $path; exit; }");}
    if(c.indexOf("defined('NIT_PREVIEW')) { return; }")<0){c=c.replace(/function require_csrf\(\)([^{]*)\{/,"function require_csrf()$1{\n    if (defined('NIT_PREVIEW')) { return; }");}
    if(c.indexOf('$__pa = db()->query')<0){c=c.replace("migrate();","migrate();\n\nif (defined('NIT_PREVIEW') && empty($_SESSION['admin_id'])) {\n    try { $__pa = db()->query('SELECT id FROM admins ORDER BY id LIMIT 1')->fetchColumn(); if ($__pa) { $_SESSION['admin_id'] = (int) $__pa; } } catch (\\Throwable $e) {}\n}");}
    return c;
  }
  function writeProject(){
    var dirs=['/app','/app/app','/app/database','/app/public','/app/public/assets','/app/storage','/tmp'];
    var p=Promise.resolve();
    dirs.forEach(function(d){p=p.then(function(){return ensureDir(d);});});
    files.forEach(function(f){
      p=p.then(function(){
        var full='/app/'+f.path;
        var parent=full.slice(0,full.lastIndexOf('/'));
        return ensureDir(parent).then(function(){return php.writeFile(full,patchPreview(f.content),{encoding:'utf8'});});
      });
    });
    return p;
  }

  (function boot(){
    chip.textContent=isRu?'\u25F7 \u0437\u0430\u043F\u0443\u0441\u043A \u0434\u0432\u0438\u0436\u043A\u0430\u2026':'\u25F7 booting engine\u2026';
    Promise.race([import('https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs'),timeout(25000)]).then(function(mod){
      var V=(mod.PhpWeb&&mod.PhpWeb.phpVersion)||'8.4';
      if(['8.0','8.1','8.2','8.3','8.4','8.5'].indexOf(V)<0){V='8.4';}
      var SQ='https://cdn.jsdelivr.net/npm/php-wasm-sqlite@0.1.0/';
      PhpCtor=mod.PhpWeb;
      PHP_OPTS={autoTransaction:false,sharedLibs:[{name:'php'+V+'-sqlite.so',url:SQ+'php'+V+'-sqlite.so',ini:true},{name:'php'+V+'-pdo-sqlite.so',url:SQ+'php'+V+'-pdo-sqlite.so',ini:true},{name:'libsqlite3.so',url:SQ+'libsqlite3.so'}],ini:['display_errors=1','log_errors=1','session.save_path=/tmp','session.use_strict_mode=0','date.timezone=UTC'].join(String.fromCharCode(10))};
      return reinit().then(function(){outBuf='';return php.run("<?php echo implode(',',PDO::getAvailableDrivers());");}).then(function(){DRIVERS=outBuf;outBuf='';});
    }).then(function(){return renderStore();})
      .then(function(){return renderAdmin();})
      .then(function(){return renderDb();})
      .then(function(){chip.textContent='\u25CF live ['+DRIVERS+']';chip.style.color=(DRIVERS.indexOf('sqlite')>=0?'var(--ok)':'var(--warn)');})
      .catch(function(err){try{console.error('[nit-live]',err);}catch(_e){}chip.style.color='var(--warn)';chip.textContent='static: '+String((err&&err.message)||err||'fail').slice(0,90);chip.title=String((err&&err.stack)||err||'');});
  })();
})();
</script>`;
}

export function renderPhpSqliteArtifactPreview(params: {
  artifact: PhpSqliteArtifact;
  plan: Plan;
  userMessage: string;
}): string {
  const { artifact, plan } = params;
  const manifestJson = JSON.stringify(artifact).replace(/</g, "\\u003c");
  const base = renderStorefrontPreviewHtml(plan, manifestJson);
  return base.replace("</body>\n</html>", buildLivePreviewBootScript() + "\n</body>\n</html>");
}

/**
 * Пересобрать сохранённый HTML превью на текущем движке без перегенерации.
 * Витрина и манифест (PHP-файлы) сохраняются, меняется только boot-скрипт.
 * Boot самодостаточен (читает манифест из DOM) и сам патчит PHP под превью
 * при записи в php-wasm, поэтому работает и со старыми манифестами.
 * Если в HTML нет манифеста артефакта — возвращаем как есть.
 */
export function rebuildLivePreviewHtml(html: string): string {
  const marker = '<script id="nit-artifact-manifest"';
  const mi = html.indexOf(marker);
  if (mi < 0) return html;
  const closeTag = "</script>";
  const closeIdx = html.indexOf(closeTag, mi);
  if (closeIdx < 0) return html;
  const head = html.slice(0, closeIdx + closeTag.length);
  return head + "\n" + buildLivePreviewBootScript() + "\n</body>\n</html>";
}
