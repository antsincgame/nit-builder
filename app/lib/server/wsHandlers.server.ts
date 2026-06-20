/**
 * WebSocket connection handlers for /api/tunnel and /api/control.
 * Browser-selected style presets are appended to the tunnel coder prompt.
 *
 * Called from the custom server.js during HTTP upgrade routing.
 */

import type { WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import {
  PROTOCOL_VERSION,
  NIT_SERVER_VERSION,
  type TunnelToServer,
  type ServerToTunnel,
  type BrowserToServer,
  type ServerToBrowser,
} from "@nit/shared";
import {
  registerTunnel,
  unregisterTunnel,
  registerBrowser,
  unregisterBrowser,
  updateHeartbeat,
  handleTunnelResponse,
  routeRequest,
  abortRequest,
  setRequestTemplate,
  hasTunnelForUser,
  getTunnelCount,
  type TunnelConnection,
  type BrowserSession,
} from "~/lib/services/tunnelRegistry.server";
import { randomUUID } from "node:crypto";
import {
  findUserByTunnelToken,
  getUserById,
  getUserSessionVersion,
  isAppwriteConfigured,
} from "./appwrite.server";
import { parseSessionCookie, verifySessionToken } from "./sessionCookie.server";
import { analyzePrompt, buildEnrichedSystemPrompt } from "~/lib/services/promptAnalyzer";
import { sanitizeUserMessage } from "~/lib/utils/promptSanitizer";
import {
  buildTunnelPlanPrompt,
  buildTunnelPolishPhase,
  buildTunnelAgentPolishPhase,
  buildTunnelCssPatchPhase,
  TUNNEL_PLAN_MAX_TOKENS,
  TUNNEL_CODE_MAX_TOKENS,
} from "~/lib/services/tunnelPipeline.server";
import { classifyPolishIntent } from "~/lib/services/intentClassifier";
import { inferStylePresetId, injectStylePreset } from "~/lib/llm/style-presets";
import { checkRateLimit, checkRateLimitKey } from "~/lib/utils/rateLimit";
import {
  buildPhpSqliteArtifact,
  renderPhpSqliteArtifactPreview,
} from "~/lib/services/phpSqliteArtifactBuilder";
import { PlanSchema, type Plan } from "~/lib/utils/planSchema";
import { inferArtifactModeFromPrompt } from "~/lib/utils/artifactMode";

const SERVER_VERSION = NIT_SERVER_VERSION;

// CSS-patch fast-path для туннельного polish: чисто-визуальные правки шлют в
// туннель компактный JSON-промпт вместо ВСЕГО HTML. По умолчанию ВКЛ (на сбое
// парсинга безопасный fallback на full-rewrite); NIT_TUNNEL_CSS_PATCH=0 — выкл.
const TUNNEL_CSS_PATCH_ENABLED = process.env.NIT_TUNNEL_CSS_PATCH !== "0";

function planFromPromptAnalysis(prompt: string, analysis: ReturnType<typeof analyzePrompt>): Plan {
  const text = prompt.toLowerCase();
  const wantsCommerce = /(товар|товары|магазин|каталог|корзин|checkout|ecommerce|shop|store|payment|плат[её]ж|оплат)/i.test(text);
  const colorMood =
    analysis.colorHints.includes("тёмный") || analysis.colorHints.includes("чёрный")
      ? "dark-premium"
      : "light-minimal";
  return PlanSchema.parse({
    business_type: analysis.businessName || (wantsCommerce ? "магазин товаров" : "backend приложение"),
    target_audience: wantsCommerce
      ? "покупатели, которым нужен каталог, корзина и быстрый заказ"
      : "администраторы и клиенты сайта",
    tone: analysis.tone || "практичный и понятный",
    style_hints: "чистая админка, карточки товаров, понятный checkout",
    color_mood: colorMood,
    sections: ["hero", "products", "cart", "checkout", "admin"],
    keywords: wantsCommerce
      ? ["товары", "корзина", "заказы", "админка", "оплата", "SQLite"]
      : ["backend", "админка", "CRUD", "SQLite", "PHP"],
    cta_primary: wantsCommerce ? "Добавить в корзину" : "Открыть админку",
    language: analysis.language || "ru",
    suggested_template_id: analysis.template.id || "blank-landing",
    hero_headline: wantsCommerce ? "Магазин с админкой на PHP" : "Backend на PHP и SQLite",
    hero_subheadline: "Готовый PHP-проект с SQLite, товарами, корзиной, заказами и защищённой админкой.",
    key_benefits: [
      { title: "SQLite из коробки", description: "База создаётся автоматически при первом запуске без отдельного сервера." },
      { title: "CRUD товаров", description: "Админ может добавлять и редактировать товары прямо из панели." },
      { title: "Заказы готовы", description: "Checkout сохраняет заявки и позиции заказа через PDO prepared statements." },
    ],
    social_proof_line: "MVP backend artifact: 9 файлов проекта, PDO, CSRF и session-auth.",
    cta_microcopy: "Платёжки подключаются через hosted checkout без секретов в HTML.",
    pricing_tiers: wantsCommerce
      ? [
          { name: "Базовый товар", price: "4900", period: "разово", features: ["Каталог", "Корзина", "Email-поддержка"] },
          { name: "Премиум товар", price: "14900", period: "разово", features: ["Приоритет", "Расширенная комплектация", "Быстрая обработка"], highlighted: true },
        ]
      : undefined,
    contact_email: "admin@example.com",
    faq: [
      { question: "Можно ли подключить MySQL?", answer: "Да, через DB_DRIVER=mysql и MYSQL_DSN в окружении." },
      { question: "Где хранить секреты платежей?", answer: "Только на сервере, не в HTML и не в публичном JS." },
      { question: "Что уже есть в MVP?", answer: "Каталог, корзина, заказ, вход в админку, CRUD товаров и список заказов." },
    ],
  });
}

// ─── WebSocket keepalive ──────────────────────────────────────────

const KEEPALIVE_INTERVAL_MS = 30_000;

function installKeepalive(ws: WebSocket, label: string): () => void {
  let isAlive = true;

  const onPong = (): void => {
    isAlive = true;
  };
  ws.on("pong", onPong);

  const interval = setInterval(() => {
    if (!isAlive) {
      console.log(`[${label}] keepalive: pong timeout, terminating`);
      try {
        ws.terminate();
      } catch {
        // noop
      }
      return;
    }
    isAlive = false;
    try {
      ws.ping();
    } catch {
      // soket уже закрыт — следующий tick увидит isAlive=false
    }
  }, KEEPALIVE_INTERVAL_MS);

  return () => {
    clearInterval(interval);
    ws.off("pong", onPong);
  };
}

// ─── Auth ─────────────────────────────────────────────────────────

async function validateTunnelToken(
  token: string,
): Promise<{ userId: string; deviceId?: string } | null> {
  if (!isAppwriteConfigured()) {
    const devToken = process.env.NIT_DEV_TUNNEL_TOKEN;
    if (devToken && token === devToken) {
      return { userId: "dev-user" };
    }
    return null;
  }
  // Per-device токены (Cursor-style привязка устройств) — основной путь;
  // fallback на legacy per-account токен в nit_users (обратная совместимость).
  const { findUserByDeviceToken } = await import("./tunnelDevices.server");
  const device = await findUserByDeviceToken(token);
  if (device) return { userId: device.userId, deviceId: device.deviceId };
  return findUserByTunnelToken(token);
}

type VerifiedBrowser = { userId: string; email: string; sessionVersion: number };

async function validateBrowserSession(token: string): Promise<VerifiedBrowser | null> {
  if (!isAppwriteConfigured()) {
    if (token === "dev-session") {
      return { userId: "dev-user", email: "dev@local", sessionVersion: 0 };
    }
    return null;
  }

  // verifySessionToken после коммита session-version revocation возвращает
  // объект { userId, sessionVersion }. sessionVersion протаскиваем в
  // BrowserSession чтобы heartbeat-handler мог сравнивать с current и
  // закрывать WS при logout-all без ожидания реконнекта.
  const verified = verifySessionToken(token);
  if (!verified) return null;

  const user = await getUserById(verified.userId);
  if (!user) return null;

  return { ...user, sessionVersion: verified.sessionVersion };
}

// ─── Tunnel hello rate-limit ──────────────────────────────────────
//
// Защита от argon2-DoS: каждый hello валидирует tunnel-token через
// argon2id с memoryCost=64MB. Без лимита атакующий с одного IP может
// открыть 100 WS, заслать 100 невалидных hello'в и съесть 6.4GB+CPU.
//
// 5 hello/мин/IP — для легитимного клиента более чем достаточно (он шлёт
// один hello при коннекте + изредка после реконнекта). Для атакующего —
// блокирует объёмные DoS попытки.
//
// Используем существующий checkRateLimit: создаём фейковый Request с
// служебным заголовком x-request-remote-ip — тот же механизм что server.ts
// использует для HTTP роутов (см. trust-proxy whitelist).

function checkTunnelHelloRateLimit(req: IncomingMessage): boolean {
  const remoteIp = req.socket.remoteAddress ?? "";
  const headers: HeadersInit = remoteIp
    ? { "x-request-remote-ip": remoteIp }
    : {};
  const fakeReq = new Request("http://localhost/__internal/tunnel-hello", {
    headers,
  });
  const rl = checkRateLimit(fakeReq, {
    scope: "tunnel-hello",
    windowMs: 60_000,
    maxRequests: 5,
  });
  return rl.allowed;
}

// ─── Tunnel handler (desktop client → server) ────────────────────

export function handleTunnelConnection(ws: WebSocket, req: IncomingMessage): void {
  const connectionId = randomUUID();
  let authed: TunnelConnection | null = null;
  let authState: "none" | "pending" | "authed" = "none";

  const stopKeepalive = installKeepalive(ws, "tunnel");

  const send = (msg: ServerToTunnel): void => {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Connection closed
    }
  };

  const closeWithError = (
    code: "AUTH_FAILED" | "INVALID_TOKEN" | "PROTOCOL_MISMATCH" | "RATE_LIMITED",
    message: string,
  ): void => {
    send({ type: "error", code, message });
    ws.close(4000, message);
  };

  const authTimer = setTimeout(() => {
    if (!authed) {
      console.log("[tunnel] Auth timeout, closing");
      ws.close(4001, "Auth timeout");
    }
  }, 5_000);

  ws.on("message", (raw) => {
    let msg: TunnelToServer;
    try {
      msg = JSON.parse(raw.toString()) as TunnelToServer;
    } catch {
      console.log("[tunnel] Malformed message");
      return;
    }

    switch (msg.type) {
      case "hello": {
        if (authState !== "none") {
          console.log("[tunnel] Duplicate hello, ignoring");
          return;
        }

        if (msg.protocolVersion !== PROTOCOL_VERSION) {
          closeWithError(
            "PROTOCOL_MISMATCH",
            `Expected protocol ${PROTOCOL_VERSION}, got ${msg.protocolVersion}`,
          );
          return;
        }

        // Rate-limit ДО argon2 verify (см. блок-комментарий выше).
        if (!checkTunnelHelloRateLimit(req)) {
          console.log(
            `[tunnel] Hello rate-limited from ${req.socket.remoteAddress}`,
          );
          closeWithError("RATE_LIMITED", "Too many auth attempts, try later");
          return;
        }

        authState = "pending";
        const helloMsg = msg;
        void (async () => {
          const user = await validateTunnelToken(helloMsg.token);
          // pending-sentinel: если за время await параллельный hello уже
          // отработал и установил authed — выходим.
          if (authState !== "pending") return;

          if (!user) {
            authState = "none";
            closeWithError("INVALID_TOKEN", "Invalid tunnel token");
            return;
          }

          clearTimeout(authTimer);
          authState = "authed";
          authed = {
            connectionId,
            userId: user.userId,
            // deviceId есть только у per-device токенов (Cursor-флоу); у legacy
            // per-account токена его нет — кладём только когда определён, чтобы
            // точечный отзыв устройства мог закрыть именно это соединение.
            ...(user.deviceId ? { deviceId: user.deviceId } : {}),
            ws,
            capabilities: helloMsg.capabilities,
            clientVersion: helloMsg.clientVersion,
            connectedAt: Date.now(),
            lastHeartbeat: Date.now(),
          };

          registerTunnel(authed);
          send({
            type: "welcome",
            serverVersion: SERVER_VERSION,
            userId: user.userId,
            sessionId: connectionId,
          });
          console.log(
            `[tunnel] ✓ Connected: user=${user.userId} client=${helloMsg.clientVersion} runtime=${helloMsg.capabilities.runtime} model=${helloMsg.capabilities.model}`,
          );
        })();
        break;
      }

      case "heartbeat": {
        if (!authed) return;
        updateHeartbeat(connectionId);
        send({ type: "heartbeat_ack", serverTime: Date.now() });
        break;
      }

      case "response_start":
      case "response_text":
      case "response_done":
      case "response_error": {
        if (!authed) return;

        const requestId = msg.requestId;
        if (msg.type === "response_start") {
          handleTunnelResponse(requestId, { type: "start" });
        } else if (msg.type === "response_text") {
          handleTunnelResponse(requestId, { type: "text", text: msg.text });
        } else if (msg.type === "response_done") {
          handleTunnelResponse(requestId, {
            type: "done",
            fullText: msg.fullText,
            durationMs: msg.durationMs,
            finishReason: msg.finishReason,
            promptTokens: msg.promptTokens,
            completionTokens: msg.completionTokens,
            model: msg.model,
          });
        } else {
          handleTunnelResponse(requestId, { type: "error", error: msg.error });
        }
        break;
      }
    }
  });

  ws.on("close", (code, reason) => {
    stopKeepalive();
    clearTimeout(authTimer);
    if (authed) {
      console.log(`[tunnel] Closed: user=${authed.userId} code=${code} reason=${reason}`);
      unregisterTunnel(connectionId);
    }
  });

  ws.on("error", (err) => {
    console.error(`[tunnel] Error: ${err.message}`);
  });
}

// ─── Control handler (browser → server) ──────────────────────────

export function handleControlConnection(ws: WebSocket, req: IncomingMessage): void {
  const sessionId = randomUUID();
  let authed: BrowserSession | null = null;
  // Race-protection: cookie-path IIFE и onmessage 'auth' могут стартовать
  // параллельно, оба зайти в await до того как первый успеет установить
  // authed. Sentinel блокирует второй раннер пока первый в pending.
  let authState: "none" | "pending" | "authed" = "none";

  // requestId'ы, на которые abort пришёл ДО того, как generate успел
  // зарегистрировать pending (маршрутизация идёт async после await). Применяем
  // отмену сразу после routeRequest — иначе запрос осиротеет на туннеле.
  const abortedEarly = new Set<string>();

  const stopKeepalive = installKeepalive(ws, "control");

  const send = (msg: ServerToBrowser): void => {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Connection closed
    }
  };

  const authTimer = setTimeout(() => {
    if (!authed) {
      console.log("[control] Auth timeout, closing");
      ws.close(4001, "Auth timeout");
    }
  }, 5_000);

  void (async () => {
    const cookieHeader = req.headers.cookie ?? null;
    const token = parseSessionCookie(cookieHeader);

    if (!token) {
      console.log(
        `[control] Browser connected without session cookie (will wait 5s for auth message)`,
      );
      return;
    }

    if (authState !== "none") return;
    authState = "pending";

    const user = await validateBrowserSession(token);
    if (authState !== "pending") return; // другой раннер успел

    if (!user) {
      authState = "none";
      console.log(
        `[control] ✗ Invalid session cookie (token length=${token.length}), closing`,
      );
      ws.close(4001, "Invalid session");
      return;
    }

    clearTimeout(authTimer);
    authState = "authed";
    authed = {
      sessionId,
      userId: user.userId,
      ws,
      connectedAt: Date.now(),
      sessionVersion: user.sessionVersion,
    };
    registerBrowser(authed);
    send({
      type: "authed",
      userId: user.userId,
      email: user.email,
      tunnelStatus: hasTunnelForUser(user.userId) ? "online" : "offline",
      activeTunnels: getTunnelCount(user.userId),
    });
    console.log(
      `[control] ✓ Browser auto-authed via cookie: user=${user.userId} session=${sessionId} v=${user.sessionVersion} tunnelStatus=${hasTunnelForUser(user.userId) ? "online" : "offline"}`,
    );
  })();

  ws.on("message", (raw) => {
    let msg: BrowserToServer;
    try {
      msg = JSON.parse(raw.toString()) as BrowserToServer;
    } catch {
      return;
    }

    switch (msg.type) {
      case "auth": {
        if (authState !== "none") return;
        authState = "pending";

        const authMsg = msg;
        void (async () => {
          const user = await validateBrowserSession(authMsg.jwt);
          if (authState !== "pending") return;

          if (!user) {
            authState = "none";
            ws.close(4001, "Auth failed");
            return;
          }

          clearTimeout(authTimer);
          authState = "authed";
          authed = {
            sessionId,
            userId: user.userId,
            ws,
            connectedAt: Date.now(),
            sessionVersion: user.sessionVersion,
          };

          registerBrowser(authed);
          send({
            type: "authed",
            userId: user.userId,
            email: user.email,
            tunnelStatus: hasTunnelForUser(user.userId) ? "online" : "offline",
            activeTunnels: getTunnelCount(user.userId),
          });
          console.log(
            `[control] ✓ Browser authed: user=${user.userId} session=${sessionId} v=${user.sessionVersion}`,
          );
        })();
        break;
      }

      case "generate": {
        if (!authed) return;

        // Rate-limit per-user: дешёвый цикл generate→abort→generate жёг GPU
        // туннеля и RAG/эмбеддинги VPS (раньше был только cap параллельных).
        // 30 запросов/мин — щедро для UI, но рубит abuse-петлю.
        const genRl = checkRateLimitKey(`control-generate:${authed.userId}`, {
          maxRequests: 30,
          windowMs: 60_000,
        });
        if (!genRl.allowed) {
          send({
            type: "generate_error",
            requestId: msg.requestId,
            error: "Слишком часто. Подожди немного перед следующей генерацией.",
            code: "RATE_LIMITED",
          });
          return;
        }

        // Size-cap клиентского ввода: previousHtml/prompt идут в промпт и в
        // retained-состояние pending-запроса. Без границы большой previousHtml
        // (polish) раздувал и контекст, и память сервера. prompt всё равно
        // санитайзится до 10k ниже — здесь только грубый DoS-guard на кадр.
        if ((msg.prompt?.length ?? 0) > 30_000 || (msg.previousHtml?.length ?? 0) > 2_000_000) {
          send({
            type: "generate_error",
            requestId: msg.requestId,
            error: "Слишком большой запрос или HTML. Сократи ввод.",
            code: "LLM_ERROR",
          });
          return;
        }

        // ─── Polish: правка существующего сайта (mode==="polish") ───
        // Раньше этот обработчик игнорировал msg.mode и msg.previousHtml — любой
        // уточняющий запрос («сделай шапку синей», «добавь блок цен») молча уходил
        // в planner→create как ТЗ на НОВЫЙ сайт, и память о текущем сайте терялась
        // («пайплайн делает новый»). Теперь polish — одна code-фаза: модель
        // получает текущий HTML (previousHtml клиента) + правку и возвращает новый
        // полный HTML. Без планировщика/шаблона; finalizeTunnelDone без плана =
        // stripCodeFences. Докрутку при обрыве крутит сервер (как у create).
        if (msg.mode === "polish") {
          const reqId = msg.requestId;

          // CSS-patch fast-path: для чисто-визуальной правки («сделай фон синим»)
          // шлём компактный css-patch промпт (~800 токенов) вместо ВСЕГО HTML.
          // Модель отдаёт JSON-правила, сервер инжектит их в previousHtml (см.
          // tunnelRegistry, фаза "csspatch"); на сбое — fallback на full-rewrite.
          // Не для agentPolish (там свой conversational режим).
          const cssCls =
            TUNNEL_CSS_PATCH_ENABLED && !msg.agentPolish && (msg.previousHtml ?? "").trim()
              ? classifyPolishIntent(msg.prompt)
              : null;
          if (cssCls?.intent === "css_patch") {
            const phase = buildTunnelCssPatchPhase(msg.prompt, cssCls.targetSection);
            const routedCss = routeRequest({
              requestId: reqId,
              userId: authed.userId,
              browserSessionId: sessionId,
              system: phase.system,
              prompt: phase.prompt,
              maxOutputTokens: phase.maxOutputTokens,
              temperature: phase.temperature,
              originalPrompt: msg.prompt,
              mode: "polish",
              phase: "csspatch",
              previousHtml: msg.previousHtml,
              targetSection: cssCls.targetSection,
            });
            if (!routedCss) {
              const hasTunnel = hasTunnelForUser(authed.userId);
              send({
                type: "generate_error",
                requestId: reqId,
                error: hasTunnel
                  ? "Слишком много параллельных генераций. Дождись завершения текущих."
                  : "No tunnel connected. Install NIT Tunnel on a device with a GPU.",
                code: hasTunnel ? "RATE_LIMITED" : "NO_TUNNEL",
              });
            }
            return;
          }

          const polish = msg.agentPolish
            ? buildTunnelAgentPolishPhase(msg.previousHtml ?? "", msg.prompt)
            : buildTunnelPolishPhase(msg.previousHtml ?? "", msg.prompt);
          if (!polish) {
            send({
              type: "generate_error",
              requestId: reqId,
              error: "Нет HTML для правки. Сначала создай сайт.",
              code: "LLM_ERROR",
            });
            return;
          }
          const routed = routeRequest({
            requestId: reqId,
            userId: authed.userId,
            browserSessionId: sessionId,
            system: polish.system,
            prompt: polish.prompt,
            maxOutputTokens: polish.maxOutputTokens,
            temperature: polish.temperature,
            originalPrompt: msg.prompt,
            mode: "polish",
            agentPolish: msg.agentPolish,
            // phase опущена → "code"; плана нет → finalize = stripCodeFences.
          });
          if (!routed) {
            const hasTunnel = hasTunnelForUser(authed.userId);
            send({
              type: "generate_error",
              requestId: reqId,
              error: hasTunnel
                ? "Слишком много параллельных генераций. Дождись завершения текущих."
                : "No tunnel connected. Install NIT Tunnel on a device with a GPU.",
              code: hasTunnel ? "RATE_LIMITED" : "NO_TUNNEL",
            });
          }
          return;
        }

        // Санитизация ввода ОДИН раз (паритет с серверным HTTP-путём): раньше на
        // туннеле msg.prompt уходил в planner/coder сырым — инъекционные паттерны
        // («ignore previous instructions», поддельные system:-строки) фильтровались
        // только на сервере, а основной (туннельный) путь их пропускал.
        const userPrompt = sanitizeUserMessage(msg.prompt);

        // Полный анализ промпта: template, tone, colors, business name,
        // sections, language, audience. Раньше передавали только template +
        // generic prompt — Coder выбирал тон/палитру наобум. Теперь всё явно,
        // результат воспроизводим и соответствует запросу.
        const analysis = analyzePrompt(userPrompt);

        if ((msg.artifactMode ?? inferArtifactModeFromPrompt(userPrompt)) === "php-sqlite") {
          // Гибрид backend: план наполняет модель юзера (осмысленный каталог,
          // тексты, FAQ по запросу), а детерминированный билдер собирает из
          // плана безопасный PHP+SQLite (plan-done в tunnelRegistry). Туннель
          // обязателен; если его нет / занят / planner-промпт не собрался —
          // мгновенный fallback на эвристический план, чтобы backend работал.
          const reqId = msg.requestId;
          const uid = authed.userId;

          const sendArtifactFallback = (): void => {
            // Случайный seed вариативности и на fallback-пути (туннеля нет/занят):
            // одинаковый запрос всё равно даёт новый вид при каждой генерации.
            const plan = { ...planFromPromptAnalysis(userPrompt, analysis), variantSeed: Math.floor(Math.random() * 0xffffffff) };
            const artifact = buildPhpSqliteArtifact({ plan, userMessage: userPrompt });
            const html = renderPhpSqliteArtifactPreview({ artifact, plan, userMessage: userPrompt });
            send({
              type: "generate_step",
              requestId: reqId,
              step: "template",
              templateId: "php-sqlite-app",
              templateName: "PHP + SQLite backend",
            });
            send({ type: "generate_step", requestId: reqId, step: "code" });
            send({ type: "generate_text", requestId: reqId, text: html });
            send({
              type: "generate_done",
              requestId: reqId,
              html,
              templateId: "php-sqlite-app",
              templateName: "PHP + SQLite backend",
              durationMs: 0,
            });
          };

          void (async () => {
            let routed = false;
            try {
              const planPrompt = await buildTunnelPlanPrompt(userPrompt);
              routed = routeRequest({
                requestId: reqId,
                userId: uid,
                browserSessionId: sessionId,
                system: planPrompt.system,
                prompt: planPrompt.prompt,
                maxOutputTokens: TUNNEL_PLAN_MAX_TOKENS,
                temperature: 0.3,
                phase: "plan",
                originalPrompt: userPrompt,
                artifactMode: "php-sqlite",
              });
            } catch {
              routed = false;
            }
            // Отмена пришла, пока строился planner-промпт (abortedEarly): pending
            // ещё не было, abortRequest был no-op. Применяем сразу после
            // маршрутизации, иначе запрос осиротеет на туннеле.
            if (abortedEarly.delete(reqId)) {
              if (routed) abortRequest(reqId);
              return; // отменено — ни fallback, ни ошибку не шлём
            }
            // Туннеля нет / лимит / дубль / promtt не собрался — собираем
            // мгновенно эвристикой (прежнее поведение, backend всё равно есть).
            if (!routed) sendArtifactFallback();
          })();
          return;
        }

        // Только явный выбор пользователя из UI (может быть undefined).
        const explicitPresetId = msg.stylePresetId;
        const reqId = msg.requestId;
        const uid = authed.userId;

        // Двухфазный планировщик: planner-промпт строим на сервере (RAG few-shot
        // + retriever shortlist), его JSON-план генерит модель юзера за туннелем
        // (фаза 1); затем сервер делает skeleton/prune/post-polish и при
        // необходимости шлёт coder-промпт (фаза 2). Fallback на одношаговый
        // enriched-промпт если planner-промпт построить не удалось.
        void (async () => {
          let routed = false;
          try {
            const planPrompt = await buildTunnelPlanPrompt(userPrompt);
            routed = routeRequest({
              requestId: reqId,
              userId: uid,
              browserSessionId: sessionId,
              system: planPrompt.system,
              prompt: planPrompt.prompt,
              maxOutputTokens: TUNNEL_PLAN_MAX_TOKENS,
              temperature: 0.3,
              phase: "plan",
              originalPrompt: userPrompt,
              // Передаём только явный UI-выбор. Если его нет — resolveTunnelPlan
              // выведет пресет С УЧЁТОМ плана (color_mood/style_hints), как
              // серверный путь; message-only пресет здесь игнорировал бы стиль
              // из плана.
              stylePresetId: explicitPresetId,
              codeMaxOutputTokens: TUNNEL_CODE_MAX_TOKENS,
            });
          } catch {
            // planner-промпт не построился — одношаговый enriched fallback.
            // Плана здесь нет, поэтому пресет выводим из сообщения (или берём
            // явный UI-выбор, если он был).
            const fallbackPreset = explicitPresetId ?? inferStylePresetId(userPrompt);
            const system = injectStylePreset(
              buildEnrichedSystemPrompt(userPrompt, analysis),
              fallbackPreset,
            );
            routed = routeRequest({
              requestId: reqId,
              userId: uid,
              browserSessionId: sessionId,
              system,
              prompt: userPrompt,
              maxOutputTokens: TUNNEL_CODE_MAX_TOKENS,
              temperature: 0.4,
              originalPrompt: userPrompt,
              stylePresetId: explicitPresetId,
            });
            if (routed) setRequestTemplate(reqId, analysis.template.id, analysis.template.name);
          }

          // Отмена во время план-фазы (см. abortedEarly) — применяем после route.
          if (abortedEarly.delete(reqId)) {
            if (routed) abortRequest(reqId);
            return; // отменено пользователем — ни ошибку, ни генерацию не шлём
          }

          if (!routed) {
            const hasTunnel = hasTunnelForUser(uid);
            send({
              type: "generate_error",
              requestId: reqId,
              error: hasTunnel
                ? "Слишком много параллельных генераций. Дождись завершения текущих."
                : "No tunnel connected. Install NIT Tunnel on a device with a GPU.",
              code: hasTunnel ? "RATE_LIMITED" : "NO_TUNNEL",
            });
          }
        })();
        break;
      }

      case "abort": {
        if (!authed) return;
        // false → pending ещё не создан (generate маршрутизирует async после
        // await) ЛИБО requestId чужой (ownership-проверка в abortRequest).
        // Запоминаем для early-abort своего же запроса сразу после routeRequest;
        // для чужого id это инертно (наш routeRequest создаёт свой requestId).
        if (!abortRequest(msg.requestId, sessionId)) abortedEarly.add(msg.requestId);
        break;
      }

      case "heartbeat": {
        // Heartbeat-revocation: если у юзера sessionVersion в БД больше
        // чем в нашем токене — сессия отозвана через logout-all/password
        // change на другом инстансе. Закрываем WS чтобы клиент перешёл
        // в logged-out state без ожидания реконнекта.
        //
        // Cost: 1 Appwrite-RTT в худшем случае, обычно cache-hit (TTL 30s
        // совпадает с heartbeat-интервалом — амортизированно ~1 RTT/30s/юзер).
        //
        // В dev-режиме (без Appwrite) sessionVersion=0, current тоже 0 —
        // условие не сработает.
        if (authed && typeof authed.sessionVersion === "number" && isAppwriteConfigured()) {
          const stored = authed.sessionVersion;
          const userId = authed.userId;
          void getUserSessionVersion(userId)
            .then((current) => {
              if (current > stored) {
                console.log(
                  `[control] Session revoked (v${stored} < current v${current}), closing user=${userId} session=${sessionId}`,
                );
                try {
                  ws.close(4001, "Session revoked");
                } catch {
                  // already closed
                }
              }
            })
            .catch(() => {
              // fail-open: при сбое Appwrite не выкидываем юзера
            });
        }
        send({ type: "heartbeat_ack" });
        break;
      }
    }
  });

  ws.on("close", () => {
    stopKeepalive();
    clearTimeout(authTimer);
    if (authed) {
      console.log(`[control] Browser closed: user=${authed.userId}`);
      unregisterBrowser(sessionId);
    }
  });

  ws.on("error", (err) => {
    console.error(`[control] Error: ${err.message}`);
  });
}
