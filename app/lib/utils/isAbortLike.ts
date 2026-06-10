/**
 * Распознаёт «abort-подобные» ошибки fetch/AI-SDK.
 *
 * AbortError — ручная отмена (controller.abort()).
 * TimeoutError — срабатывание AbortSignal.timeout(ms) в Node 20+.
 *
 * Раньше catch-блоки RAG проверяли только name === "AbortError", поэтому
 * TimeoutError (типичный исход холодного эмбеддинга на 4-секундном бюджете
 * туннельного плана) уходил в generic-ветку и НАВСЕГДА отключал RAG до
 * рестарта процесса. Единый предикат закрывает оба случая.
 */
export function isAbortLike(err: unknown): boolean {
  const name = (err as { name?: unknown } | null | undefined)?.name;
  return name === "AbortError" || name === "TimeoutError";
}

/** True только для ручной отмены пользователем (её нужно пробрасывать вверх). */
export function isUserAbort(err: unknown): boolean {
  return (err as { name?: unknown } | null | undefined)?.name === "AbortError";
}
