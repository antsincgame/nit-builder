/**
 * Утилита: сгенерировать magic-link напрямую для входа без SMTP.
 *
 * Используется когда SMTP ещё не настроен (или почта не доходит) и нужно
 * залогиниться вручную. Скрипт:
 *   1. Создаёт юзера в Appwrite если его ещё нет (как делает обычный
 *      magic-link при первом входе на новый email).
 *   2. Генерирует токен через createMagicLink и сохраняет в БД.
 *   3. Печатает готовую URL — открываете в браузере, залогинены.
 *
 * Запуск:
 *   APPWRITE_API_KEY=<key> npm run magic-link -- email@example.com
 *   APPWRITE_API_KEY=<key> npm run magic-link -- email@example.com https://nit.vibecoding.by
 *
 * Дефолтный baseUrl — https://nit.vibecoding.by, если не указан вторым
 * аргументом или через OAUTH_REDIRECT_BASE env.
 *
 * Требует:
 *   - APPWRITE_API_KEY, APPWRITE_ENDPOINT, APPWRITE_PROJECT в env
 *   - запущенную коллекцию nit_magic_links (npm run migrate:appwrite)
 *
 * После использования юзер с этим email может войти как обычно через
 * /login → email → ссылка из почты (когда SMTP настроен).
 */

import { createMagicLink } from "../app/lib/server/magicLink.server.js";
import { findOrCreateUserByEmail } from "../app/lib/server/appwriteUsers.server.js";

async function main() {
  const email = process.argv[2];
  const baseUrlArg = process.argv[3];

  if (!email || !email.includes("@")) {
    console.error("Использование: npm run magic-link -- <email> [baseUrl]");
    console.error("Пример: npm run magic-link -- igor@example.com");
    process.exit(1);
  }

  const baseUrl =
    baseUrlArg ?? process.env.OAUTH_REDIRECT_BASE ?? "https://nit.vibecoding.by";

  console.log(`[magic-link] email: ${email}`);
  console.log(`[magic-link] baseUrl: ${baseUrl}`);

  try {
    // Создать юзера если ещё нет
    const user = await findOrCreateUserByEmail(email);
    console.log(`[magic-link] user: ${user.userId} (${user.created ? "создан" : "существовал"})`);

    // Сгенерировать токен
    const token = await createMagicLink(email);
    const url = `${baseUrl}/auth/verify?token=${token}`;

    console.log("");
    console.log("════════════════════════════════════════════════════════════");
    console.log("✓ Magic-link готов. Откройте в браузере чтобы войти:");
    console.log("");
    console.log(`  ${url}`);
    console.log("");
    console.log("Ссылка действительна 15 минут, одноразовая.");
    console.log("════════════════════════════════════════════════════════════");
  } catch (err) {
    console.error("[magic-link] FAILED:", err);
    process.exit(1);
  }
}

void main();
