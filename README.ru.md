# NIT Builder

> **Создавай сайты на своей видеокарте. С AI. Бесплатно.**
> Peer-to-peer AI-конструктор сайтов. Браузер → наш сервер → твой LM Studio. Облачного inference нет, твои промпты не покидают твою машину.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![Status](https://img.shields.io/badge/status-beta-orange)

[🇬🇧 English version](./README.md)

---

## Что это

NIT Builder — open-source AI-конструктор сайтов с **peer-to-peer tunnel-архитектурой**: веб-приложение работает на нашем VPS, но каждый запрос к LLM проксируется через WebSocket-туннель в **твой LM Studio** на **твоей машине**. Облачный провайдер не видит твои промпты. Ты приносишь GPU, мы — пайплайн.

Описываешь сайт текстом → Planner LLM выдаёт JSON-план → система выбирает один из 22 HTML-шаблонов → Coder LLM адаптирует шаблон → опционально запекается PHP-админка во flat-file. 30–60 секунд.

**Отличие от Tilda/Wix/v0/Bolt:** inference идёт локально на твоём железе. VPS только оркестрирует. Сгенерированные сайты — это чистый HTML + Tailwind (скомпилирован inline, не CDN) + опциональная PHP-админка. Работают где угодно.

### Для кого

- Владельцы малого бизнеса, которым не хочется платить 1500₽/мес за Tilda бесконечно
- Фрилансеры, делающие быстрые сайты клиентам
- Студенты с RTX 3060 и без бюджета
- Все, кто хочет сайт **и** хочет владеть данными

---

## Архитектура (v2)

```
Браузер ─── HTTPS ───▶ NIT VPS (этот репо, app/)
                       │
                       │  WSS /api/control  (сессия браузера)
                       │  WSS /api/tunnel   (desktop-клиент)
                       ▼
                  Tunnel router  ◀── маршрутизация по tunnel-token
                       ▲
                       │ WSS
                       │
            Desktop-клиент (Tauri + Rust, tunnel/desktop/)
                       │
                       ▼
             Твой локальный LM Studio (OpenAI-совместимый)
```

Репо — workspace-монорепо:

- `app/` — React Router v7 SSR + WS-обработчики (VPS)
- `shared/` — общие типы протокола (`@nit/shared`)
- `tunnel/` — Node CLI клиент (`nit-tunnel`)
- `tunnel/desktop/` — Tauri 2.0 + Rust десктоп клиент с tray-иконкой, autostart, auto-update

Подробнее: [docs/architecture/v2-tunnel.md](./docs/architecture/v2-tunnel.md)

---

## Pipeline

```
Запрос («сайт для кофейни в Минске»)
        ↓
  Planner LLM ──▶ JSON-план (business_type, tone, sections, colors, needs_admin, …)
        ↓
  Подбор шаблона (BM25 + dense embeddings + RRF fusion + reranker)
        ↓
  Coder LLM ──▶ адаптирует выбранный шаблон, стримит результат
        ↓
  Polisher каскад (css_patch → section-only → full_rewrite)
        ↓
  Tailwind v4 compile (inline <style>, CDN-скрипт удаляется) → Lighthouse-friendly
        ↓
  [опц.] PHP baker: data-edit зоны → <?= e($c['id']) ?>, flat-file админка
        ↓
  Превью + Download HTML / Download PHP (ZIP)
```

Почему адаптация шаблона, а не генерация с нуля: 7B-модели тонут на полном React-проекте с импортами и конфигами. Зато отлично *адаптируют готовый HTML*. На этом и держится работоспособность на RTX 3060.

---

## Быстрый старт

### Требования

- **Node.js 20+**
- **LM Studio**, запущенный локально — [lmstudio.ai](https://lmstudio.ai)
- Рекомендуемая модель: **Qwen2.5-Coder-7B-Instruct** (Q4_K_M, ~4.5 ГБ)

### Установка

```bash
git clone https://github.com/igor1000rr/nit-builder.git
cd nit-builder
npm install
cp .env.example .env
# отредактируй .env — задай LMSTUDIO_BASE_URL если порт не дефолтный
npm run dev
```

Открой [http://localhost:5173](http://localhost:5173).

### Настройка LM Studio

1. Скачай [LM Studio](https://lmstudio.ai)
2. Подтяни `Qwen2.5-Coder-7B-Instruct` (Q4_K_M)
3. Developer → Start Server (по умолчанию `http://localhost:1234`)
4. Проверь `LMSTUDIO_BASE_URL=http://localhost:1234` в `.env`
5. `npm run dev` → опиши сайт → готово через ~60с

👉 **Для 8 ГБ видеокарт:** [Гайд по LM Studio](./docs/lm-studio-guide.md) — Flash Attention, квантование KV-кэша, расчёт VRAM, когда нужен YaRN.

### Железо

| Видеокарта | Модель | Скорость | Качество |
|---|---|---|---|
| 4 ГБ VRAM | Qwen2.5-Coder-3B-Q4 | Медленно | Ок |
| **8 ГБ VRAM (RTX 3060/4060)** | **Qwen2.5-Coder-7B-Q4** | **Хорошо** | **Отлично** ⭐ |
| 12+ ГБ VRAM | Qwen2.5-Coder-14B-Q4 | Быстро | Превосходно |

> **Внимание:** в v2 удалены облачные fallback'и Groq и OpenRouter, которые были в v1. Продукт позиционируется как P2P — твои промпты не покидают твою машину. Если облачный inference нужен принципиально — используй v1 или контрибьюти plugin провайдера.

---

## 22 встроенных шаблона

☕ Кофейни · 💈 Барбершопы · 📸 Фотографы · 💻 Портфолио разработчиков · 💒 Свадебные приглашения · 💪 Фитнес-тренеры · 🍽️ Рестораны · 📚 Репетиторы · 💅 Мастера красоты · 🔧 Автосервисы · 🎨 Хендмейд · 🎧 DJ/Музыканты · 🚀 SaaS-лендинги · 🦷 Медицинские клиники · 🧘 Йога-студии · 🖤 Тату-студии · 💐 Цветочные магазины · 🗣️ Языковые школы · ⚖️ Юридические фирмы · 🎮 Инди-геймстудии · 🏠 Недвижимость · 📄 Универсальный fallback

Каталог: [`app/lib/config/htmlTemplatesCatalog.ts`](./app/lib/config/htmlTemplatesCatalog.ts) · HTML: [`app/templates/html/`](./app/templates/html/)

---

## Опционально: PHP-админка в бандле

Когда Planner решает что сайту нужен редактируемый контент (`needs_admin=true`), Coder ставит на нужные узлы атрибуты `data-edit`/`data-edit-type`/`data-edit-label`. Детерминированный пост-процессор (`app/lib/bake/`) запекает HTML в PHP:

```html
<!-- до -->
<h1 data-edit="hero_title" data-edit-type="text">Лучший кофе в Минске</h1>

<!-- после -->
<h1><?= e($c['hero_title'] ?? 'Лучший кофе в Минске') ?></h1>
```

ZIP-бандл содержит:

```
index.php             ← твой сайт с PHP-слотами
admin/                ← логин, дашборд, edit (text / richtext / image)
admin/lib/            ← auth, csrf, atomic JSON store
data/                 ← content.json + defaults.json + zones.json
setup.php             ← одноразовая инициализация админа, удалить после входа
assets/uploads/       ← MIME-валидация, .htaccess блокирует .php
```

Чистый PHP 8.1+, ноль зависимостей, без БД. Argon2id, CSRF, rate-limit (5 попыток / 15 мин), atomic write через tempnam+rename. Деплоится на любой shared hosting.

---

## Стек

- **React Router v7** (SSR) + **React 19** + **TypeScript 5.7**
- **Tailwind CSS v4** через Vite plugin (inline-компиляция для генерируемых сайтов)
- **Vercel AI SDK** (`ai@5` + `@ai-sdk/openai`) для стриминга
- **Zod** для валидации плана
- **node-html-parser** для HTML→PHP baker
- **ws** + **Tauri 2.0** для туннеля
- **Argon2id** + HMAC-SHA256 для tunnel-токенов, **session-version revocation** для cookie
- **Appwrite** для пользователей, сайтов и persistent guest-IP квот
- **Vitest 3** — 69 тест-файлов, ~11k LOC тестов, CI зелёный на каждом push

---

## Контрибьюшн

### Добавить шаблон

1. Создай `app/templates/html/your-id.html` — один файл от `<!DOCTYPE html>` до `</html>`, Tailwind через CDN в исходнике, картинки Unsplash или inline SVG, адаптивность (`sm:`/`md:`/`lg:`)
2. Добавь метаданные в `app/lib/config/htmlTemplatesCatalog.ts`
3. Открой PR со скриншотом

### Баги и фичи

Issue по шаблонам из `.github/ISSUE_TEMPLATE/`. CI должен оставаться зелёным (`npm run lint && npm run typecheck && npm test && npm run build`).

---

## Roadmap

- [x] v1.0 — HTML-first pipeline, 22 шаблона, LM Studio + Groq + OpenRouter
- [x] v2.0-beta — P2P туннель, Tauri desktop client, мультиюзер через Appwrite, persistent guest-квоты, PHP-baker, inline Tailwind compile
- [ ] v2.1 — страница «Мои сайты» (CRUD UI), shareable preview-ссылки
- [ ] v2.2 — галерея комьюнити-шаблонов, загрузка своих
- [ ] v2.3 — локальная генерация картинок (Stable Diffusion через туннель)
- [ ] v2.4 — экспорт в React / Vue / Astro
- [ ] v3.0 — встроенный LLM runtime в Tauri-клиенте (без зависимости от LM Studio)

---

## Лицензия

MIT © [Igor](https://t.me/igor1000rr) · Сделано в Беларуси 🇧🇾

Часть экосистемы [VibeCoding](https://vibecoding.by).
