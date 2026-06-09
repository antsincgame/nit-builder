/**
 * LM Studio proxy. Calls a local OpenAI-compatible endpoint (default LM Studio on :1234).
 * Streams tokens back to the caller via an async iterable.
 */

export type StreamDelta = {
  type: "start" | "text" | "thinking" | "done" | "error";
  text?: string;
  fullText?: string;
  error?: string;
  durationMs?: number;
  /** Только для type==="done": причина остановки от OpenAI-совместимого API. */
  finishReason?: "stop" | "length" | "unknown";
  /** Только type==="done": реальные токены из usage LM Studio (если отдал). */
  promptTokens?: number;
  completionTokens?: number;
};

export type ProxyConfig = {
  baseUrl: string; // e.g. "http://localhost:1234/v1"
  model: string;
  timeoutMs: number;
};

export async function* streamFromLmStudio(
  config: ProxyConfig,
  params: {
    system: string;
    prompt: string;
    maxTokens: number;
    temperature: number;
    signal?: AbortSignal;
  },
): AsyncGenerator<StreamDelta> {
  const startedAt = Date.now();
  yield { type: "start" };

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.prompt },
    ],
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    stream: true,
  };

  const controller = new AbortController();
  // Idle-таймер вместо общего лимита: медленные модели (27B, reasoning)
  // легко генерят дольше 5 минут — рвать живой стрим нельзя. Рвём только
  // если данных нет дольше timeoutMs. Каждый полученный чанк сбрасывает
  // таймер; idleFired отличает таймаут тишины от пользовательской отмены.
  let idleFired = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleFired = true;
      controller.abort();
    }, config.timeoutMs);
  };
  resetIdle();

  // Chain user abort signal with our internal one
  if (params.signal) {
    if (params.signal.aborted) controller.abort();
    else params.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let fullText = "";
  let finishReason: "stop" | "length" | "unknown" = "unknown";

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      yield { type: "error", error: `LM Studio ${response.status}: ${errorText}` };
      return;
    }

    if (!response.body) {
      yield { type: "error", error: "LM Studio returned empty body" };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      resetIdle();

      buffer += decoder.decode(value, { stream: true });

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        for (const line of block.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: {
                  content?: string;
                  reasoning_content?: string;
                  reasoning?: string;
                };
                finish_reason?: string | null;
              }>;
            };
            const choice = parsed.choices?.[0];
            const delta = choice?.delta?.content;
            if (delta) {
              fullText += delta;
              yield { type: "text", text: delta };
            } else if (
              choice?.delta?.reasoning_content ||
              choice?.delta?.reasoning
            ) {
              // Reasoning-модели стримят размышления отдельным полем:
              // LM Studio/DeepSeek — reasoning_content, Ollama и часть
              // llama.cpp-сборок — reasoning. В текст ответа не входят,
              // но сигналят что модель жива — пробрасываем для прогресса.
              yield { type: "thinking" };
            }
            // finish_reason приходит в последнем чанке (delta пустой). "length" —
            // упёрлись в max_tokens, остальное (stop/null) — нормальное завершение.
            const fr = choice?.finish_reason;
            if (fr) finishReason = fr === "length" ? "length" : "stop";
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }

    yield {
      type: "done",
      fullText,
      durationMs: Date.now() - startedAt,
      finishReason,
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      yield {
        type: "error",
        error: idleFired
          ? `LM Studio idle timeout: нет данных дольше ${Math.round(config.timeoutMs / 1000)}s`
          : "Request aborted (timeout or cancelled)",
      };
    } else {
      yield { type: "error", error: `LM Studio proxy error: ${(err as Error).message}` };
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
}

export async function probeLmStudio(baseUrl: string): Promise<{
  available: boolean;
  model?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl.replace(/\/v1\/?$/, "")}/v1/models`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { available: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    // Первая модель списка может оказаться embedding-моделью (nomic, bge и
    // т.п.) — чатить в неё нельзя. Берём первую НЕ-embedding; если других
    // нет — первую как есть (честная ошибка случится позже на completions).
    const models = data.data ?? [];
    const model =
      (models.find((m) => !m.id.toLowerCase().includes("embed")) ?? models[0])?.id;
    return { available: true, model };
  } catch (err) {
    return { available: false, error: (err as Error).message };
  }
}
