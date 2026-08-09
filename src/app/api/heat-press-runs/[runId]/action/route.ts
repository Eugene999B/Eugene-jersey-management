import {
  HeatPressEventType,
  HeatPressRunStatus,
  HeatPressTimerMode,
  Prisma,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  heatPressQualityComplete,
  heatPressTimerElapsedMs,
  normalizeHeatPressQuality,
} from "@/lib/heat-press-workflow";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("START_TIMER"), mode: z.enum(["FIRST_PRESS", "REPRESS"]) }),
  z.object({ action: z.literal("PAUSE_TIMER") }),
  z.object({ action: z.literal("RESET_TIMER") }),
  z.object({ action: z.literal("COMPLETE_FIRST_PRESS") }),
  z.object({ action: z.literal("COMPLETE_PEEL") }),
  z.object({ action: z.literal("START_REPRESS") }),
  z.object({ action: z.literal("COMPLETE_REPRESS") }),
  z.object({ action: z.literal("PASS_QUALITY"), checklist: z.record(z.string(), z.boolean()) }),
  z.object({ action: z.literal("REQUIRE_REWORK"), checklist: z.record(z.string(), z.boolean()), reason: z.string().trim().min(3).max(1_500) }),
]);

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function serialize(run: {
  id: string;
  attemptNumber: number;
  status: HeatPressRunStatus;
  timerMode: HeatPressTimerMode | null;
  timerStartedAt: Date | null;
  timerElapsedMs: number;
  firstPressElapsedMs: number | null;
  repressElapsedMs: number | null;
  firstPressCompletedAt: Date | null;
  peelCompletedAt: Date | null;
  repressCompletedAt: Date | null;
  qualityChecklist: Prisma.JsonValue | null;
  qualityPassedAt: Date | null;
  reworkReason: string | null;
  updatedAt: Date;
}) {
  return {
    ...run,
    timerStartedAt: run.timerStartedAt?.toISOString() ?? null,
    firstPressCompletedAt: run.firstPressCompletedAt?.toISOString() ?? null,
    peelCompletedAt: run.peelCompletedAt?.toISOString() ?? null,
    repressCompletedAt: run.repressCompletedAt?.toISOString() ?? null,
    qualityPassedAt: run.qualityPassedAt?.toISOString() ?? null,
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return error("A shop workspace is required.", 403);
  if (!isTrustedApplicationOrigin(request)) return error("Invalid request origin.", 403);
  const shopId = session.shopId;
  const { runId } = await context.params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("The heat press action is invalid.");

  const now = new Date();
  let eventType: HeatPressEventType = HeatPressEventType.TIMER_STARTED;
  let eventNote = "";

  try {
    const run = await prisma.$transaction(async (tx) => {
      const current = await tx.heatPressRun.findFirst({ where: { id: runId, shopId } });
      if (!current) throw new Error("Heat press run not found in this shop.");
      if ([HeatPressRunStatus.PASSED, HeatPressRunStatus.REWORK_REQUIRED].includes(current.status)) {
        throw new Error("This heat press attempt is closed. Start a rework attempt if more pressing is required.");
      }

      const elapsedMs = heatPressTimerElapsedMs(current, now);
      let data: Prisma.HeatPressRunUpdateInput = { updatedById: session.id };
      let eventMode: HeatPressTimerMode | null = current.timerMode;
      let eventElapsed: number | null = null;

      if (parsed.data.action === "START_TIMER") {
        const mode = parsed.data.mode === "FIRST_PRESS" ? HeatPressTimerMode.FIRST_PRESS : HeatPressTimerMode.REPRESS;
        if (mode === HeatPressTimerMode.FIRST_PRESS) {
          if (![HeatPressRunStatus.READY, HeatPressRunStatus.PAUSED].includes(current.status) || (current.timerMode && current.timerMode !== mode)) {
            throw new Error("The first-press timer can only start or resume before the first press is completed.");
          }
          data = { ...data, status: HeatPressRunStatus.PRESSING, timerMode: mode, timerStartedAt: now };
          eventNote = current.status === HeatPressRunStatus.PAUSED ? "First-press timer resumed." : "First-press timer started.";
        } else {
          if (current.repressSeconds <= 0) throw new Error("This material recipe does not require a repress timer.");
          if (![HeatPressRunStatus.PEEL_COMPLETE, HeatPressRunStatus.PAUSED].includes(current.status) || (current.status === HeatPressRunStatus.PAUSED && current.timerMode !== mode)) {
            throw new Error("Repress can start only after the peel step is complete.");
          }
          data = { ...data, status: HeatPressRunStatus.REPRESSING, timerMode: mode, timerStartedAt: now };
          eventNote = current.status === HeatPressRunStatus.PAUSED ? "Repress timer resumed." : "Repress timer started.";
        }
        eventType = mode === HeatPressTimerMode.REPRESS ? HeatPressEventType.REPRESS_STARTED : HeatPressEventType.TIMER_STARTED;
        eventMode = mode;
      } else if (parsed.data.action === "PAUSE_TIMER") {
        if (![HeatPressRunStatus.PRESSING, HeatPressRunStatus.REPRESSING].includes(current.status) || !current.timerStartedAt || !current.timerMode) {
          throw new Error("There is no running heat press timer to pause.");
        }
        data = { ...data, status: HeatPressRunStatus.PAUSED, timerStartedAt: null, timerElapsedMs: elapsedMs };
        eventType = HeatPressEventType.TIMER_PAUSED;
        eventNote = "Heat press timer paused.";
        eventElapsed = elapsedMs;
      } else if (parsed.data.action === "RESET_TIMER") {
        if (![HeatPressRunStatus.READY, HeatPressRunStatus.PRESSING, HeatPressRunStatus.PAUSED, HeatPressRunStatus.PEEL_COMPLETE, HeatPressRunStatus.REPRESSING].includes(current.status)) {
          throw new Error("The current production step cannot reset a timer.");
        }
        const mode = current.timerMode ?? HeatPressTimerMode.FIRST_PRESS;
        data = {
          ...data,
          status: mode === HeatPressTimerMode.REPRESS ? HeatPressRunStatus.PEEL_COMPLETE : HeatPressRunStatus.READY,
          timerMode: mode,
          timerStartedAt: null,
          timerElapsedMs: 0,
        };
        eventType = HeatPressEventType.TIMER_RESET;
        eventNote = `${mode === HeatPressTimerMode.REPRESS ? "Repress" : "First-press"} timer reset.`;
        eventMode = mode;
        eventElapsed = 0;
      } else if (parsed.data.action === "COMPLETE_FIRST_PRESS") {
        if (![HeatPressRunStatus.PRESSING, HeatPressRunStatus.PAUSED].includes(current.status) || current.timerMode !== HeatPressTimerMode.FIRST_PRESS) {
          throw new Error("Start the first-press timer before completing the first press.");
        }
        data = {
          ...data,
          status: HeatPressRunStatus.FIRST_PRESS_COMPLETE,
          timerStartedAt: null,
          timerElapsedMs: 0,
          firstPressElapsedMs: elapsedMs,
          firstPressCompletedAt: now,
        };
        eventType = HeatPressEventType.FIRST_PRESS_COMPLETED;
        eventNote = "First press marked complete.";
        eventMode = HeatPressTimerMode.FIRST_PRESS;
        eventElapsed = elapsedMs;
      } else if (parsed.data.action === "COMPLETE_PEEL") {
        if (current.status !== HeatPressRunStatus.FIRST_PRESS_COMPLETE) throw new Error("Complete the first press before recording the peel step.");
        data = {
          ...data,
          status: current.repressSeconds > 0 ? HeatPressRunStatus.PEEL_COMPLETE : HeatPressRunStatus.QUALITY_CHECK,
          peelCompletedAt: now,
          timerMode: current.repressSeconds > 0 ? HeatPressTimerMode.REPRESS : null,
          timerStartedAt: null,
          timerElapsedMs: 0,
        };
        eventType = HeatPressEventType.PEEL_COMPLETED;
        eventNote = `${current.peelType} peel recorded.`;
      } else if (parsed.data.action === "START_REPRESS") {
        if (current.status !== HeatPressRunStatus.PEEL_COMPLETE || current.repressSeconds <= 0) throw new Error("A repress is not ready for this attempt.");
        data = { ...data, status: HeatPressRunStatus.REPRESSING, timerMode: HeatPressTimerMode.REPRESS, timerStartedAt: now, timerElapsedMs: 0 };
        eventType = HeatPressEventType.REPRESS_STARTED;
        eventNote = "Repress timer started.";
        eventMode = HeatPressTimerMode.REPRESS;
      } else if (parsed.data.action === "COMPLETE_REPRESS") {
        if (![HeatPressRunStatus.REPRESSING, HeatPressRunStatus.PAUSED].includes(current.status) || current.timerMode !== HeatPressTimerMode.REPRESS) {
          throw new Error("Start the repress timer before completing the repress.");
        }
        data = {
          ...data,
          status: HeatPressRunStatus.QUALITY_CHECK,
          timerStartedAt: null,
          timerElapsedMs: 0,
          repressElapsedMs: elapsedMs,
          repressCompletedAt: now,
        };
        eventType = HeatPressEventType.REPRESS_COMPLETED;
        eventNote = "Repress marked complete.";
        eventMode = HeatPressTimerMode.REPRESS;
        eventElapsed = elapsedMs;
      } else if (parsed.data.action === "PASS_QUALITY") {
        if (current.status !== HeatPressRunStatus.QUALITY_CHECK) throw new Error("Complete pressing and peel/repress steps before quality approval.");
        const checklist = normalizeHeatPressQuality(parsed.data.checklist);
        if (!heatPressQualityComplete(checklist)) throw new Error("Every quality check must pass before this item can be completed.");
        data = { ...data, status: HeatPressRunStatus.PASSED, qualityChecklist: checklist, qualityPassedAt: now, reworkReason: null };
        eventType = HeatPressEventType.QUALITY_PASSED;
        eventNote = "Finished garment passed the complete quality checklist.";
      } else if (parsed.data.action === "REQUIRE_REWORK") {
        if (current.status !== HeatPressRunStatus.QUALITY_CHECK) throw new Error("Rework can be recorded only during quality checking.");
        const checklist = normalizeHeatPressQuality(parsed.data.checklist);
        data = { ...data, status: HeatPressRunStatus.REWORK_REQUIRED, qualityChecklist: checklist, reworkReason: parsed.data.reason };
        eventType = HeatPressEventType.REWORK_REQUIRED;
        eventNote = parsed.data.reason;
      }

      const updated = await tx.heatPressRun.update({ where: { id: current.id }, data });
      await tx.heatPressEvent.create({
        data: {
          shopId,
          heatPressRunId: current.id,
          type: eventType,
          timerMode: eventMode,
          elapsedMs: eventElapsed,
          note: eventNote || null,
          createdById: session.id,
        },
      });
      return updated;
    });

    await audit({
      shopId,
      userId: session.id,
      action: `production.heat-press.${parsed.data.action.toLowerCase().replaceAll("_", "-")}`,
      entityType: "HeatPressRun",
      entityId: run.id,
      metadata: { attemptNumber: run.attemptNumber, status: run.status, event: eventType },
    });
    return NextResponse.json({ run: serialize(run) });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Could not update the heat press workflow.");
  }
}
