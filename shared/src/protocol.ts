/**
 * Adds style preset selection to browser generation messages.
 *
 * NIT Builder v2.0 — WebSocket Protocol
 *
 * Shared types between:
 * - VPS backend (app/routes/api.tunnel.ts, app/routes/api.control.ts)
 * - Tunnel client (tunnel/src-tauri + tunnel/ui)
 * - Browser frontend (app/routes/home.tsx via WebSocket)
 *
 * Version: 1.0 — MUST be bumped on any breaking change.
 */

export const PROTOCOL_VERSION = "1.0" as const;

// ─── Common ──────────────────────────────────────────────────────────────────

export type TunnelCapabilities = {
  /** "lmstudio_proxy" — forwards to user's LM Studio. "embedded" — built-in llama.cpp. */
  runtime: "lmstudio_proxy" | "embedded";
  /** Model identifier reported by the runtime (e.g. "qwen2.5-coder-7b-instruct") */
  model: string;
  /** Context window in tokens (e.g. 32000 for Qwen2.5) */
  contextWindow: number;
  /** Optional GPU info for diagnostic display */
  gpu?: {
    vendor: "nvidia" | "amd" | "apple" | "intel" | "cpu";
    name?: string;
    vramMb?: number;
  };
};

export type PipelineStep = "plan" | "template" | "code" | "polish" | "done";

export type GenerationMode = "create" | "polish";

// ─── Tunnel client ↔ Server ──────────────────────────────────

/** Messages sent from tunnel client to the server */
export type TunnelToServer =
  | {
      type: "hello";
      protocolVersion: string;
      token: string;
      clientVersion: string;
      capabilities: TunnelCapabilities;
    }
  | { type: "heartbeat"; timestamp: number }
  | { type: "response_start"; requestId: string }
  | { type: "response_text"; requestId: string; text: string }
  | {
      type: "response_done";
      requestId: string;
      fullText: string;
      durationMs: number;
      promptTokens?: number;
      completionTokens?: number;
      /**
       * Имя модели, реально обработавшей запрос (req.model ?? probe-модель из
       * /v1/models, где эмбеддеры уже отфильтрованы). Сервер берёт его в
       * telemetry.model вместо статичного capabilities.model (тот фиксируется в
       * момент hello и может устареть либо оказаться эмбеддером при мульти-
       * модельном LM Studio). Optional: старые клиенты не шлют → сервер падает
       * обратно на capabilities.model. Backward-compatible, без bump версии.
       */
      model?: string;
      /**
       * Причина остановки генерации у локальной модели. "length" означает что
       * модель упёрлась в maxOutputTokens и HTML оборван — сервер запустит
       * server-driven continuation (см. tunnelRegistry). Optional: старые
       * клиенты туннеля поле не шлют → сервер трактует как "stop" (без докрутки),
       * поэтому добавление backward-compatible и не требует bump PROTOCOL_VERSION.
       */
      finishReason?: "stop" | "length" | "unknown";
    }
  | { type: "response_error"; requestId: string; error: string };

/** Messages sent from server to tunnel client */
export type ServerToTunnel =
  | {
      type: "welcome";
      serverVersion: string;
      userId: string;
      sessionId: string;
    }
  | { type: "heartbeat_ack"; serverTime: number }
  | {
      type: "generate";
      requestId: string;
      system: string;
      prompt: string;
      maxOutputTokens: number;
      temperature: number;
      /** Optional override for the model name (if tunnel supports multiple) */
      model?: string;
    }
  | { type: "abort"; requestId: string }
  | {
      type: "error";
      code: "AUTH_FAILED" | "INVALID_TOKEN" | "PROTOCOL_MISMATCH" | "RATE_LIMITED";
      message: string;
    };

// ─── Browser ↔ Server ────────────────────────────────────────

/** Messages sent from the browser (control WS) to the server */
export type BrowserToServer =
  | { type: "auth"; jwt: string }
  | {
      type: "generate";
      requestId: string;
      mode: GenerationMode;
      prompt: string;
      artifactMode?: "template" | "custom" | "auto" | "php-sqlite";
      /**
       * Должен покрывать все id из app/lib/llm/style-presets (shared-пакет не может
       * импортировать из app, поэтому union дублируется вручную). Расширение
       * списка — backward-compatible (optional поле browser↔server, туннель его
       * не читает), bump PROTOCOL_VERSION не требуется.
       */
      stylePresetId?:
        | "generic"
        | "neon-cyber"
        | "clean-saas"
        | "warm-premium"
        | "editorial"
        | "tech-terminal"
        | "dark-luxe"
        | "earth-craft"
        | "bold-pop";
      /** Previous site HTML if mode === "polish" */
      previousHtml?: string;
      /**
       * Эксперимент: Agent polish — conversational summary + full rewrite вместо
       * css_patch cascade. Optional, backward-compatible.
       */
      agentPolish?: boolean;
    }
  | { type: "abort"; requestId: string }
  | { type: "heartbeat" };

/** Messages sent from the server to the browser */
export type ServerToBrowser =
  | {
      type: "authed";
      userId: string;
      email: string;
      tunnelStatus: "online" | "offline";
      activeTunnels: number;
    }
  | { type: "tunnel_status"; status: "online" | "offline"; activeTunnels: number }
  | {
      type: "generate_step";
      requestId: string;
      step: PipelineStep;
      /** For "template" step: which template was selected */
      templateId?: string;
      templateName?: string;
    }
  | {
      type: "generate_progress";
      requestId: string;
      /** plan — думает над планом; thinking — reasoning <think>; code — пишет HTML */
      phase: "plan" | "thinking" | "code";
      /** накоплено токенов/чанков с начала фазы */
      tokens: number;
      /** мс с начала генерации */
      elapsedMs: number;
    }
  | { type: "generate_text"; requestId: string; text: string }
  | {
      type: "generate_done";
      requestId: string;
      html: string;
      templateId: string;
      templateName: string;
      durationMs: number;
      /** create | polish — для корректного UI без эвристики по чату. */
      generationMode?: GenerationMode;
      /**
       * Текстовое резюме модели (Agent polish). Optional — только когда
       * agentPolish=true и модель написала пояснение до <!DOCTYPE html>.
       */
      assistantSummary?: string;
      /**
       * Диагностика прогона для UI (опционально, backward-compatible). Сервер
       * заполняет из capabilities туннеля + хода генерации. Старый фронт поле
       * игнорит. promptTokens/completionTokens приходят только если клиент
       * туннеля запросил usage у LM Studio (Слой 2).
       */
      telemetry?: {
        model?: string;
        contextWindow?: number;
        /** Раундов авто-докрутки понадобилось (0 — уложились сразу). */
        continuationRounds?: number;
        /** true — докрутка исчерпана, модель всё ещё обрывалась: сайт мог обрезаться. */
        truncated?: boolean;
        /** true — была фаза repair админ-разметки. */
        repaired?: boolean;
        promptTokens?: number;
        completionTokens?: number;
      };
    }
  | {
      type: "generate_error";
      requestId: string;
      error: string;
      code?:
        | "NO_TUNNEL"
        | "TUNNEL_DISCONNECTED"
        | "LLM_ERROR"
        | "TIMEOUT"
        | "RATE_LIMITED"
        | "ABORTED";
    }
  | { type: "heartbeat_ack" };

// ─── Type guards ───────────────────────────────────────────────

export function isTunnelToServer(msg: unknown): msg is TunnelToServer {
  return typeof msg === "object" && msg !== null && "type" in msg;
}

export function isBrowserToServer(msg: unknown): msg is BrowserToServer {
  return typeof msg === "object" && msg !== null && "type" in msg;
}
