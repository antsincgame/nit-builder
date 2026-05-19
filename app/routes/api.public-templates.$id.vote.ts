/**
 * POST /api/public-templates/:id/vote — голосование за публичный шаблон.
 *
 * v2.2 Phase 3 Community templates voting. БЕЗ auth — открыт любому
 * (включая guest'ов), как и сам list/fetch endpoints.
 *
 * Body: { direction: "up" | "down" }
 *
 * Защита от спама на сервере минимальна (см. doc в voteForTemplate в
 * appwrite.server.ts) — основная de-duplication делается на клиенте через
 * localStorage "nit-voted-templates" set. Это компромисс: persistent
 * voting registry с userId+templateId unique constraint — backlog для v2.3+.
 *
 * Возвращает 404 если шаблон не существует или не публичный, 200 с новым
 * значением votes при успехе.
 */

import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { voteForTemplate } from "~/lib/server/appwrite.server";

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
