export type ArtifactMode = "template" | "custom" | "auto" | "php-sqlite";

export function inferArtifactModeFromPrompt(prompt: string): Extract<ArtifactMode, "php-sqlite"> | undefined {
  const text = prompt.toLowerCase();
  const asksForBackend =
    /\b(backend|back-end|php|sqlite|mysql|pdo|admin|crud|checkout|payment|payments)\b/i.test(text) ||
    /(бекенд|бэкенд|админк|товар|товары|корзин|заказ|заказы|плат[её]ж|оплат)/i.test(text);
  const asksForPhpStack = /\b(php|sqlite|mysql)\b/i.test(text) || /(пхп|майскл|мускул)/i.test(text);
  return asksForBackend && asksForPhpStack ? "php-sqlite" : undefined;
}
