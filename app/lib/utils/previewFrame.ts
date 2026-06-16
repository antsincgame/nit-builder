/**
 * Подготовка HTML сгенерированного сайта для srcdoc-превью в iframe.
 *
 * Превью рендерится через `<iframe srcDoc=...>`. У srcdoc-документа нет своего
 * URL (его адрес — about:srcdoc), поэтому относительные и hash-ссылки ВНУТРИ
 * сайта резолвятся против URL РОДИТЕЛЯ — билдера на /app/u/:publicId. Клик по
 * меню сгенерированного сайта ("#contact", "/") уводил iframe на /app/u/... и
 * грузил САМ билдер внутрь превью — «фрактальное» открытие проекта в проекте.
 *
 * Инъекция `<base href="about:srcdoc">` переносит базу резолва на сам srcdoc-
 * документ: "#contact" → about:srcdoc#contact (скролл в той же странице, как и
 * ожидает пользователь), а "/..." резолвится в пределах about: и никуда не
 * уводит. Тег нужен ТОЛЬКО для srcdoc-превью; в скачанном/расшаренном
 * (/p/:token) HTML его быть не должно — там у документа реальный URL и
 * hash-ссылки работают нативно.
 */

const PREVIEW_BASE_TAG = '<base href="about:srcdoc">';

/** Вставляет <base href="about:srcdoc"> в <head> превью, если его там ещё нет. */
export function withPreviewBase(html: string): string {
  if (!html) return html;
  // Уже есть <base> (наш или из шаблона) — не дублируем и не перетираем.
  if (/<base\b/i.test(html)) return html;

  const headOpen = html.match(/<head\b[^>]*>/i);
  if (headOpen && headOpen.index !== undefined) {
    const at = headOpen.index + headOpen[0].length;
    return html.slice(0, at) + PREVIEW_BASE_TAG + html.slice(at);
  }

  // <head> ещё не подъехал (ранний стрим генерации) — кликать не по чему; base
  // добавится на следующем кадре, как только <head> появится в потоке.
  return html;
}

/** Достаточно ли HTML для показа в iframe (есть body + закрытый блок). */
export function streamingHtmlReady(htmlStr: string): boolean {
  return (
    /<body[^>]*>/i.test(htmlStr) &&
    (/<\/(section|header|main|footer)>/i.test(htmlStr) || htmlStr.length > 2800)
  );
}
