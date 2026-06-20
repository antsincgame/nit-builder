/**
 * Защита от prompt injection. Удаляет/экранирует попытки управления моделью
 * через user input: "ignore previous instructions", fake system tags, и т.д.
 *
 * Паттерн `system:` ловится ТОЛЬКО в начале строки (флаг m): инлайн-упоминания
 * вроде «solar system: планеты» — легитимный текст и не должны превращаться
 * в [filtered]. Реальные role-инъекции для локальных моделей идут отдельной
 * строкой, так что начало строки покрывает атакующий кейс без ложняков.
 */

const INJECTION_PATTERNS = [
  /\bignore\s+(previous|all|above)\s+(instructions|prompts)\b/gi,
  /\bforget\s+(everything|all)\b/gi,
  /^[ \t]*system\s*:\s*/gim,
  /<\|system\|>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /###\s*(system|instruction)/gi,
  // Русские варианты (целевая аудитория RU/BY): английские паттерны их не
  // ловили, инъекция вроде «игнорируй предыдущие инструкции» проходила насквозь.
  // NB: ни \b, ни \w в JS-regex не работают с кириллицей (ASCII-only) — поэтому
  // без \b и с явным классом [а-яё] для словоформ.
  /игнорируй\s+(вс[её][а-яё]*\s+|предыдущ[а-яё]*\s+|выше[а-яё]*\s+|эт[а-яё]*\s+)*(инструкци[а-яё]*|указани[а-яё]*|правил[а-яё]*|промпт[а-яё]*|сообщени[а-яё]*)/gi,
  /(забудь|сотри)\s+(вс[её][а-яё]*|предыдущ[а-яё]*|прежн[а-яё]*|инструкци[а-яё]*|правил[а-яё]*)/gi,
  /новы(й|е)\s+(инструкци[а-яё]*|промпт[а-яё]*|правил[а-яё]*)\s*[:：]/gi,
  /системн[а-яё]*\s+(промпт|инструкци[а-яё]*|сообщени[а-яё]*)/gi,
];

export function sanitizeUserMessage(input: string): string {
  let cleaned = input.trim();

  // Лимит длины
  if (cleaned.length > 10_000) cleaned = cleaned.slice(0, 10_000);

  // Удаляем паттерны инъекций
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[filtered]");
  }

  // Нормализуем переводы строк
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");

  return cleaned;
}
