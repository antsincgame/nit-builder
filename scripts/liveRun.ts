#!/usr/bin/env tsx
/**
 * liveRun — живой прогон полного серверного конвейера против НАСТОЯЩЕГО
 * LM Studio (localhost:1234 или LMSTUDIO_BASE_URL).
 *
 * Что гоняет на каждый кейс: executeHtmlSimple целиком (Planner+RAG →
 * skeleton/Coder → repair-раунд → post-polish), затем независимый аудит
 * финальной разметки, извлечение схемы из самодостаточных атрибутов
 * (как боевой бандл-роут с пустым body) и сборка PHP-бандла.
 *
 * Результаты — в live-results/<runId>/: summary.json, <case>.html,
 * <case>.plan.json, <case>.report.json, <case>.bundle.zip. Файл
 * live-results/LATEST содержит путь последнего прогона (для workflow).
 *
 * Использование:
 *   npx tsx scripts/liveRun.ts [--cases=all|id1,id2] [--timeout-min=12]
 *
 * ENV:
 *   LMSTUDIO_BASE_URL  (default http://localhost:1234)
 *   LMSTUDIO_MODEL     игнорируется: модель берётся из GET /v1/models
 *                      (первая загруженная), чтобы не зависеть от точного
 *                      имени в LM Studio. Если /models недоступен — дефолт.
 *
 * Exit code: 0 если хотя бы один кейс отработал (отчёт важнее красноты),
 * 1 если упали ВСЕ (LM Studio не поднят и т.п.).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeHtmlSimple } from "../app/lib/services/pipelineCreate";
import { getOrCreateSession } from "../app/lib/services/sessionMemory";
import { auditAdminMarkup } from "../app/lib/bake/auditMarkup";
import { extractZonesFromHtml } from "../app/lib/bake/extractZones.server";
import { extractCollectionsFromHtml } from "../app/lib/bake/extractCollections.server";
import { bundlePhp } from "../app/lib/bake/bundle.server";
import { normalizeLmStudioBaseUrl } from "../app/lib/llm/client";
import type { Plan } from "../app/lib/utils/planSchema";
import type { PipelineEvent } from "../app/lib/services/htmlOrchestrator.types";

// ─── Кейсы ───

type LiveCase = {
  id: string;
  prompt: string;
  /** Ожидаем needs_admin=true от планировщика. */
  expectAdmin: boolean;
  /** Ожидаем хотя бы одну задекларированную коллекцию. */
  expectCollections: boolean;
};

const CASES: LiveCase[] = [
  {
    id: "sushi-admin",
    prompt:
      "Сайт суши-бара «Аригато» с админкой: сам добавляю роллы и сеты, меняю цены и фото, плюс редактирую тексты на главной",
    expectAdmin: true,
    expectCollections: true,
  },
  {
    id: "coffee-admin-inferred",
    prompt:
      "Лендинг кофейни в Гродно, чтобы бариста сам мог менять позиции меню и цены без программиста",
    expectAdmin: true,
    expectCollections: true,
  },
  {
    id: "photographer-zones",
    prompt:
      "Сайт свадебного фотографа с админ-панелью, чтобы менять тексты и главные фото самостоятельно",
    expectAdmin: true,
    expectCollections: false,
  },
  {
    id: "barbershop-static",
    prompt: "Простой лендинг для барбершопа в центре города",
    expectAdmin: false,
    expectCollections: false,
  },
];

// ─── CLI ───

type Args = { cases: string[] | "all"; timeoutMin: number };

function parseArgs(argv: string[]): Args {
  const out: Args = { cases: "all", timeoutMin: 12 };
  for (const a of argv) {
    if (a.startsWith("--cases=")) {
      const v = a.slice("--cases=".length).trim();
      if (v && v !== "all") out.cases = v.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a.startsWith("--timeout-min=")) {
      const n = parseInt(a.slice("--timeout-min=".length), 10);
      if (!Number.isNaN(n) && n > 0) out.timeoutMin = n;
    }
  }
  return out;
}

// ─── LM Studio: выбор загруженной модели ───

async function pickLoadedModel(baseUrl: string): Promise<string | undefined> {
  try {
    const resp = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return undefined;
    const json = (await resp.json()) as { data?: Array<{ id?: string }> };
    const id = json.data?.[0]?.id;
    return typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

// ─── Компактный журнал событий (без html/text-дельт) ───

function compactEvent(ev: PipelineEvent): Record<string, unknown> | null {
  const e = ev as unknown as Record<string, unknown>;
  switch (ev.type) {
    case "text":
      return null;
    case "step_complete":
      return { type: ev.type, htmlChars: String(e.html ?? "").length };
    case "plan_ready":
      return { type: ev.type, cached: e.cached };
    default: {
      const copy: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(e)) {
        if (k === "html" || k === "plan") continue;
        if (typeof v === "string" && v.length > 300) {
          copy[k] = `${v.slice(0, 300)}…(${v.length})`;
        } else {
          copy[k] = v;
        }
      }
      return copy;
    }
  }
}

// ─── Прогон одного кейса ───

type CaseReport = {
  id: string;
  prompt: string;
  ok: boolean;
  pass: boolean;
  durationMs: number;
  error?: string;
  injectMethod: "skeleton" | "coder" | "unknown";
  truncated: boolean;
  needsAdmin: boolean;
  adminConfidence?: string;
  zonesDeclared: number;
  collectionsDeclared: string[];
  missingAfterRepair?: {
    zones: string[];
    collections: string[];
    fields: string[];
    total: number;
  };
  extractedZones?: number;
  extractedCollections?: string[];
  extractMatchesPlan?: boolean;
  bundle?: {
    bytes: number;
    setupFilename: string;
    matchedZones: number;
    missingZones: number;
    matchedCollections: number;
    missingCollections: number;
    missingCollectionFields: number;
  };
  bundleError?: string;
  htmlChars: number;
  events: Array<Record<string, unknown>>;
};

async function runCase(
  c: LiveCase,
  modelName: string | undefined,
  timeoutMin: number,
  outDir: string,
): Promise<CaseReport> {
  const memory = getOrCreateSession(`live-${c.id}-${Date.now()}`, "live-eval");
  const signal = AbortSignal.timeout(timeoutMin * 60_000);
  const started = Date.now();

  const report: CaseReport = {
    id: c.id,
    prompt: c.prompt,
    ok: false,
    pass: false,
    durationMs: 0,
    injectMethod: "unknown",
    truncated: false,
    needsAdmin: false,
    zonesDeclared: 0,
    collectionsDeclared: [],
    htmlChars: 0,
    events: [],
  };

  let plan: Plan | undefined;
  let html = "";

  try {
    const gen = executeHtmlSimple(
      memory,
      c.prompt,
      signal,
      modelName ? { providerOverride: { modelName } } : {},
    );
    for await (const ev of gen) {
      const compact = compactEvent(ev);
      if (compact) report.events.push(compact);
      if (ev.type === "plan_ready") plan = (ev as { plan: Plan }).plan;
      else if (ev.type === "skeleton_inject_used") report.injectMethod = "skeleton";
      else if (ev.type === "step_start" && (ev as { roleName?: string }).roleName === "Кодер") {
        report.injectMethod = "coder";
      } else if (ev.type === "truncated") report.truncated = true;
      else if (ev.type === "step_complete") html = (ev as { html: string }).html;
      else if (ev.type === "error") report.error = (ev as { message: string }).message;
    }
    report.ok = !report.error && html.length > 0;
  } catch (err) {
    report.error = (err as Error).message;
  }

  report.durationMs = Date.now() - started;
  report.htmlChars = html.length;

  if (plan) {
    report.needsAdmin = plan.needs_admin === true;
    report.adminConfidence = plan.admin_intent_confidence;
    const zones = plan.needs_admin ? plan.editable_zones ?? [] : [];
    const collections = plan.needs_admin ? plan.collections ?? [] : [];
    report.zonesDeclared = zones.length;
    report.collectionsDeclared = collections.map((col) => col.id);
    await writeFile(path.join(outDir, `${c.id}.plan.json`), JSON.stringify(plan, null, 2));

    if (html && (zones.length > 0 || collections.length > 0)) {
      const audit = auditAdminMarkup(html, zones, collections);
      report.missingAfterRepair = {
        zones: audit.missingZones.map((z) => z.id),
        collections: audit.missingCollections.map((col) => col.id),
        fields: audit.missingFields.map((m) => `${m.collection.id}.${m.field.id}`),
        total:
          audit.missingZones.length +
          audit.missingCollections.length +
          audit.missingFields.length,
      };
    }
  }

  if (html) {
    await writeFile(path.join(outDir, `${c.id}.html`), html);

    // Самодостаточность разметки: извлекаем схему из самого HTML —
    // ровно то, что делает боевой /api/bundle/php с пустым body.
    const extractedZones = extractZonesFromHtml(html);
    const extractedCollections = extractCollectionsFromHtml(html);
    report.extractedZones = extractedZones.length;
    report.extractedCollections = extractedCollections.map((col) => col.id);
    if (report.collectionsDeclared.length > 0) {
      const declared = new Set(report.collectionsDeclared);
      report.extractMatchesPlan =
        extractedCollections.length > 0 &&
        extractedCollections.every((col) => declared.has(col.id));
    }

    if (extractedZones.length > 0 || extractedCollections.length > 0) {
      try {
        const bundle = await bundlePhp({
          html,
          zones: extractedZones,
          collections: extractedCollections,
        });
        await writeFile(path.join(outDir, `${c.id}.bundle.zip`), bundle.zip);
        report.bundle = {
          bytes: bundle.sizeBytes,
          setupFilename: bundle.setupFilename,
          matchedZones: bundle.matchedZones.length,
          missingZones: bundle.missingZones.length,
          matchedCollections: bundle.matchedCollections.length,
          missingCollections: bundle.missingCollections.length,
          missingCollectionFields: bundle.missingCollectionFields.length,
        };
      } catch (err) {
        report.bundleError = (err as Error).message;
      }
    }
  }

  // pass: пайплайн отработал И админ-ожидания плана совпали.
  // missingAfterRepair — информационная метрика качества 7B, не gate.
  report.pass =
    report.ok &&
    report.needsAdmin === c.expectAdmin &&
    (!c.expectCollections || report.collectionsDeclared.length > 0);

  await writeFile(path.join(outDir, `${c.id}.report.json`), JSON.stringify(report, null, 2));
  return report;
}

// ─── main ───

function runStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const selected =
    args.cases === "all" ? CASES : CASES.filter((c) => (args.cases as string[]).includes(c.id));
  if (selected.length === 0) {
    console.error(`❌ неизвестные кейсы: ${String(args.cases)}. Доступны: ${CASES.map((c) => c.id).join(", ")}`);
    process.exit(2);
  }

  const baseUrl = normalizeLmStudioBaseUrl();
  const model = await pickLoadedModel(baseUrl);
  const runId = runStamp();
  const outDir = path.join("live-results", runId);
  await mkdir(outDir, { recursive: true });

  console.log("═════════════════════════════════════════════════");
  console.log("NIT Builder — Live Run (LM Studio)");
  console.log("═════════════════════════════════════════════════");
  console.log(`baseUrl: ${baseUrl}`);
  console.log(`model:   ${model ?? "(GET /v1/models не ответил — дефолт клиента)"}`);
  console.log(`cases:   ${selected.map((c) => c.id).join(", ")}`);
  console.log(`out:     ${outDir}`);
  console.log("");

  const startedAt = Date.now();
  const reports: CaseReport[] = [];
  for (const c of selected) {
    console.log(`▶ ${c.id} …`);
    const r = await runCase(c, model, args.timeoutMin, outDir);
    reports.push(r);
    const miss = r.missingAfterRepair ? ` miss=${r.missingAfterRepair.total}` : "";
    const cols = r.collectionsDeclared.length > 0 ? ` cols=[${r.collectionsDeclared.join(",")}]` : "";
    const bundle = r.bundle ? ` zip=${Math.round(r.bundle.bytes / 1024)}KB` : r.bundleError ? " zip=ERR" : "";
    console.log(
      `  ${r.pass ? "✅" : r.ok ? "⚠️" : "❌"} ok=${r.ok} pass=${r.pass} ${Math.round(r.durationMs / 1000)}s inject=${r.injectMethod} admin=${r.needsAdmin}${cols}${miss}${bundle}${r.error ? ` error=${r.error}` : ""}`,
    );
  }

  const summary = {
    runId,
    startedAt: new Date(startedAt).toISOString(),
    totalMs: Date.now() - startedAt,
    baseUrl,
    model: model ?? null,
    cases: reports.map((r) => ({
      id: r.id,
      ok: r.ok,
      pass: r.pass,
      durationMs: r.durationMs,
      injectMethod: r.injectMethod,
      truncated: r.truncated,
      needsAdmin: r.needsAdmin,
      adminConfidence: r.adminConfidence ?? null,
      zonesDeclared: r.zonesDeclared,
      collectionsDeclared: r.collectionsDeclared,
      missingAfterRepair: r.missingAfterRepair?.total ?? null,
      extractedZones: r.extractedZones ?? null,
      extractedCollections: r.extractedCollections ?? [],
      extractMatchesPlan: r.extractMatchesPlan ?? null,
      bundleBytes: r.bundle?.bytes ?? null,
      bundleError: r.bundleError ?? null,
      error: r.error ?? null,
    })),
  };
  await writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(path.join("live-results", "LATEST"), `live-results/${runId}`);

  console.log("");
  console.log(`summary: ${path.join(outDir, "summary.json")}`);
  const okCount = reports.filter((r) => r.ok).length;
  console.log(`ok ${okCount}/${reports.length}, pass ${reports.filter((r) => r.pass).length}/${reports.length}`);

  if (okCount === 0) {
    console.error("❌ ни один кейс не отработал — LM Studio поднят? (Developer → Start Server)");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ liveRun упал:", err);
  process.exit(2);
});
