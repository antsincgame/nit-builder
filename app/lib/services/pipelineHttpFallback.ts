/**
 * HTTP fallback для генерации сайтов, включая выбранный style preset.
 *
 * Используется когда WebSocket-туннель недоступен:
 *   - Юзер не залогинен
 *   - Залогинен, но его tunnel offline
 *   - Сетевая проблема с /api/control
 *
 * Раньше эта логика была inline'ом в `app/routes/home.tsx` — два почти
 * идентичных блока (createSite + polishSite, ~150 LOC дубля). Вынесено
 * сюда чтобы home.tsx остался про UI/state, а HTTP-флоу про передачу
 * данных и парсинг событий.
 *
 * Через WebSocket события идут через `useControlSocket.onEvent` → handler
 * в home.tsx. Здесь же — через SSE стрим напрямую в callback.
 *
 * API сознательно простой: callback на каждый событие пайплайна
 * + signal для отмены. Сам hook ничего про React не знает — это чистая
 * функция, легко покрыть тестами.
 */

import { parseSseStream } from "~/lib/utils/sseParser";
import { inferArtifactModeFromPrompt, type ArtifactMode } from "~/lib/utils/artifactMode";
import type { StylePresetId } from "~/lib/llm/style-presets";

/** Событие пайплайна, унифицированное для create/polish HTTP-fallback. */
export type HttpPipelineEvent =
  | { type: "session_init"; sessionId: string }
  | { type: "plan_ready" }
  | { type: "template_selected"; templateId: string; templateName: string }
  | { type: "step_start"; roleName: string }
  | { type: "text_delta"; text: string; accumulated: string }
  | { type: "truncated"; canContinue: boolean; attemptsLeft: number }
  | { type: "step_complete"; html?: string }
  | { type: "error"; message: string };

export type HttpFallbackParams = {
  mode: "create" | "polish";
  projectId: string;
  prompt: string;
  /** sessionId возвращается сервером в первом событии и должен быть переиспользован для polish. */
  sessionId?: string;
  providerId?: string;
  artifactMode?: ArtifactMode;
  stylePresetId?: StylePresetId;
  signal: AbortSignal;
  /** Вызывается на каждое событие. Возврат false — прервать обработку (не используется сейчас, на будущее). */
  onEvent: (event: HttpPipelineEvent) => void;
};

export type HttpFallbackResult = {
  finalHtml: string;
  templateId: string;
  templateName: string;
  /** Был ли новый sessionId назначен сервером — caller должен сохранить для последующих запросов. */
  newSessionId: string | undefined;
};

/**
 * Запустить HTTP-pipeline и стримить события через onEvent.
 *
 * Бросает Error при сетевой ошибке или при `error` событии от сервера.
 * AbortError каллер должен ловить отдельно — это юзер нажал Cancel.
 */
export async function runHttpPipeline(
  params: HttpFallbackParams,
): Promise<HttpFallbackResult> {
  const res = await fetch("/api/pipeline/simple", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: params.mode,
      projectId: params.projectId,
      sessionId: params.sessionId,
      message: params.prompt,
      providerId: params.providerId,
      artifactMode: params.artifactMode ?? inferArtifactModeFromPrompt(params.prompt),
      stylePresetId: params.stylePresetId,
    }),
    signal: params.signal,
  });

  // Не-SSE ошибка ДО старта стрима (429 rate-limit, 400 validation, 401,
  // 5xx). Тело такого ответа — JSON {error}, а не event-stream: parseSseStream
  // над ним не даёт ни одного события и не бросает. Без этой проверки caller
  // получил бы пустой результат (finalHtml="") и молча провалился в editing
  // с белым экраном — точно как пустой результат на туннельном пути до
  // isUsableHtml. Достаём message из тела и бросаем — createSite/polishSite
  // покажут toast.error и вернут в welcome.
  if (!res.ok) {
    let detail = `Сервер вернул ошибку (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; retryAfter?: number };
      if (body?.error) {
        detail = body.error;
        if (res.status === 429 && typeof body.retryAfter === "number") {
          detail += `. Повтори через ${body.retryAfter}s.`;
        }
      }
    } catch {
      // тело не JSON — оставляем generic message
    }
    throw new Error(detail);
  }

  let accumulated = "";
  let templateId = "";
  let templateName = "";
  let newSessionId: string | undefined;

  await parseSseStream(res, (event) => {
    switch (event.type) {
      case "session_init":
        newSessionId = event.sessionId as string;
        params.onEvent({ type: "session_init", sessionId: newSessionId });
        break;

      case "plan_ready":
        params.onEvent({ type: "plan_ready" });
        break;

      case "template_selected":
        templateId = event.templateId as string;
        templateName = event.templateName as string;
        params.onEvent({
          type: "template_selected",
          templateId,
          templateName,
        });
        break;

      case "step_start":
        params.onEvent({
          type: "step_start",
          roleName: (event.roleName as string) ?? "",
        });
        break;

      case "text":
        accumulated += event.text as string;
        params.onEvent({
          type: "text_delta",
          text: event.text as string,
          accumulated,
        });
        break;

      case "step_complete":
        if (event.html) accumulated = event.html as string;
        params.onEvent({ type: "step_complete", html: event.html as string | undefined });
        break;

      case "error": {
        const message = (event.message as string) || "Неизвестная ошибка";
        params.onEvent({ type: "error", message });
        // Серверная ошибка — прерываем pipeline. parseSseStream сам не бросит.
        throw new Error(message);
      }
    }
  });

  return {
    finalHtml: accumulated,
    templateId,
    templateName,
    newSessionId,
  };
}
