/**
 * POST /api/public-templates/:id/vote — голосование за публичный шаблон.
 *
 * v2.2 Phase 3 Community templates voting. Требует авторизацию (session
 * cookie) + серверный лимит 1 голос на (юзера, шаблон) в сутки. Раньше было
 * открыто всем с де-дупом лишь на клиенте (localStorage) — накручивалось
 * тривиальным curl-скриптом. Persistent voting registry (userId+templateId
 * unique) — backlog для v2.3+; текущий лимит in-memory (сброс на рестарте).
 *
 * Body: { direction: "up" | "down" }
 *
 * Возвращает 401 без сессии, 429 при повторном голосе, 404 если шаблон не
 * существует или не публичный, 200 с новым значением votes при успехе.
 */

import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { voteForTemplate } from "~/lib/server/appwrite.server";
import { getAuth } from "~/lib/server/requireAuth.server";
import { checkRateLimit } from "~/lib/utils/rateLimit";

const VoteSchema = z.object({
  direction: z.enum(["up", "down"]),
});

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const templateId = params.id;
  if (!templateId) {
    return Response.json({ error: "Template ID required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Голосовать могут только залогиненные (раньше эндпоинт был открыт всем —
  // накручивалось curl-скриптом). Проверка идёт ПОСЛЕ валидации тела, но ДО
  // мутации votes — на безопасность порядок не влияет.
  const user = await getAuth(request);
  if (!user) {
    return Response.json({ error: "Unauthorized", code: "NO_SESSION" }, { status: 401 });
  }

  // 1 голос на (юзера, шаблон) в сутки. useClientKey:false — ключ по
  // юзеру+шаблону, не по IP, чтобы смена IP не сбрасывала лимит. In-memory
  // (сброс на рестарте) — мягкая защита до persistent registry (v2.3+).
  const voteRl = checkRateLimit(request, {
    scope: `vote:${templateId}:${user.userId}`,
    windowMs: 24 * 60 * 60_000,
    maxRequests: 1,
    useClientKey: false,
  });
  if (!voteRl.allowed) {
    return Response.json(
      { error: "Вы уже голосовали за этот шаблон." },
      { status: 429 },
    );
  }

  const delta = parsed.data.direction === "up" ? 1 : -1;
  const newVotes = await voteForTemplate(templateId, delta);
  if (newVotes === null) {
    return Response.json(
      { error: "Template not found or not public" },
      { status: 404 },
    );
  }

  return Response.json({ id: templateId, votes: newVotes });
}
