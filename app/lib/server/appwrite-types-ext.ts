/**
 * Module augmentation для расширения NitUser типа OAuth-полями.
 *
 * Этот файл не содержит runtime-кода — только TypeScript declaration,
 * который объединяется с существующим типом NitUser из appwrite.server.ts
 * через type intersection.
 *
 * Подход выбран чтобы не трогать основной 45KB appwrite.server.ts файл и
 * минимизировать конфликты при будущих изменениях.
 *
 * Поля:
 *   - googleId?: string — Google `sub` claim (уникальный per-провайдер ID юзера)
 *   - githubId?: string — GitHub `id` (число конвертированное в строку)
 *
 * Оба опциональные: существующие email-password юзеры до OAuth-фичи не имеют
 * этих полей, появляются они только после первого OAuth-логина.
 */

import type { NitUser } from "./appwrite.server";

export type NitUserWithOAuth = NitUser & {
  googleId?: string;
  githubId?: string;
};
