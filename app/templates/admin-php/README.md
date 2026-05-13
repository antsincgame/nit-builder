# Сайт с PHP-админкой

Сгенерирован [NIT Builder](https://github.com/igor1000rr/nit-builder).

## Установка на хостинг

1. Распакуй ZIP в корень сайта на хостинге (обычно `public_html/` или `htdocs/`).
2. Убедись, что папка `data/` доступна для записи PHP-процессу:
   - chmod **755** на папки `data/` и `assets/uploads/`
   - chmod **644** на файлы внутри `data/`
3. Открой `https://твой-сайт/setup.php` и создай аккаунт администратора.
4. **Удали `setup.php`** с сервера сразу после первого входа.
5. Заходи в админку: `https://твой-сайт/admin/`.

## Что можно редактировать

В админке отображаются все размеченные на этапе генерации зоны. Они сгруппированы по секциям (hero, about, contact и т.д.). Поддерживаются три типа:

- **text** — короткая строка: заголовки, имена, цены, телефоны (до 500 символов)
- **richtext** — несколько абзацев с базовыми тегами форматирования (до 10 000 символов)
- **image** — JPEG/PNG/WebP/GIF до 5 МБ

Изменения сохраняются в `data/content.json` и подгружаются при каждом запросе главной страницы.

## Требования к серверу

- **PHP 8.1+** (нужны `random_bytes`, Argon2id для `password_hash`, `finfo`)
- **Apache** с поддержкой `.htaccess` (или nginx с эквивалентными правилами — см. ниже)
- Возможность записи в `data/` и `assets/uploads/`

## Nginx-конфигурация (если не Apache)

```nginx
location ~ /data/ { deny all; }
location /assets/uploads/ {
    location ~ \.(php|phtml|phps)$ { deny all; }
}
```

## Безопасность

- Пароли хранятся в **Argon2id**.
- **CSRF-токен** на каждой форме.
- Загрузка файлов: MIME-проверка через `finfo`, лимит 5 МБ, UUID-имена (нельзя угадать или перетереть).
- `data/` закрыт `.htaccess` от прямого HTTP-доступа.
- `assets/uploads/` запрещает исполнение PHP/CGI любых видов.
- **Rate-limit** на логин: 5 попыток / 15 минут с одного IP.
- Сессии: HTTP-only, SameSite=Strict, Secure при HTTPS.

## Структура архива

```
index.php             ← главная страница (HTML с PHP-вставками)
admin/
  index.php           ← dashboard со списком зон
  login.php           ← форма входа
  logout.php
  edit.php            ← редактор зоны
  lib/                ← auth.php, csrf.php, store.php, e.php
data/
  content.json        ← актуальный контент (мутируется через админку)
  defaults.json       ← дефолтные значения (от baker'а, не трогать)
  zones.json          ← конфиг зон (id, type, label, section)
  users.json          ← создаётся в setup.php
  .htaccess           ← запрет HTTP-доступа
assets/uploads/       ← сюда летят картинки из админки
  .htaccess           ← запрет исполнения PHP
setup.php             ← одноразовый: создание админа, удалить после
.htaccess             ← общие правила (no indexes, charset)
README.md
```

## Что делать, если

**Админка пустая, зон нет** — `data/zones.json` пустой. Это значит, что Coder не разметил `data-edit` атрибуты, или зон не было в плане.

**`data/content.json: permission denied`** — chmod `data/` в 755, и убедись, что владелец директории — пользователь под которым работает PHP (обычно `www-data` или `apache`).

**Загрузка картинки падает на `move_uploaded_file failed`** — проверь права на `assets/uploads/` (755) и что `upload_max_filesize` в PHP не меньше 5M.

**Хочу сбросить пароль** — удали `data/users.json`, открой `/setup.php` заново.
