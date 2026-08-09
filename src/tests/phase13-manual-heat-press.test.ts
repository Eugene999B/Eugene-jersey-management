import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EMPTY_HEAT_PRESS_QUALITY,
  MAX_HEAT_PRESS_EVIDENCE_BYTES,
  heatPressPhotoMimeAllowed,
  heatPressQualityComplete,
  heatPressRecipeFromBrief,
  heatPressTargetMs,
  heatPressTimerElapsedMs,
  normalizeHeatPressQuality,
} from "@/lib/heat-press-workflow";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 13 manual heat press workflow", () => {
  it("derives the manual press recipe from the reviewed production snapshots", () => {
    const recipe = heatPressRecipeFromBrief({
      garmentSize: "M",
      materialSnapshot: {
        name: "White HTV",
        colour: "White",
        pressTemperatureC: 150,
        pressDurationSeconds: 12,
        pressure: "Medium",
        peelType: "Warm",
        repressSeconds: 3,
        warnings: "Test heat-sensitive fabric first.",
      },
      garmentSnapshot: {
        name: "Black tee",
        garmentType: "T-shirt",
        colour: "Black",
        fabric: "Cotton",
        heatRestrictions: "Do not exceed the tested garment limit.",
      },
      placementSnapshot: { name: "Left chest", location: "LEFT_CHEST" },
    });
    expect(recipe).toMatchObject({
      materialName: "White HTV",
      garmentName: "Black tee",
      garmentSize: "M",
      placementName: "Left chest",
      pressTemperatureC: 150,
      pressDurationSeconds: 12,
      pressure: "Medium",
      peelType: "Warm",
      repressSeconds: 3,
    });
    expect(heatPressTargetMs("FIRST_PRESS", recipe)).toBe(12_000);
    expect(heatPressTargetMs("REPRESS", recipe)).toBe(3_000);
  });

  it("recovers elapsed timer time from durable server timestamps", () => {
    const elapsed = heatPressTimerElapsedMs({
      timerElapsedMs: 2_000,
      timerStartedAt: new Date("2026-08-09T10:00:00.000Z"),
    }, new Date("2026-08-09T10:00:03.500Z"));
    expect(elapsed).toBe(5_500);
    expect(heatPressTimerElapsedMs({ timerElapsedMs: 900, timerStartedAt: null })).toBe(900);
  });

  it("requires every physical quality check before pass", () => {
    expect(heatPressQualityComplete(EMPTY_HEAT_PRESS_QUALITY)).toBe(false);
    const complete = normalizeHeatPressQuality({
      designCentred: true,
      correctSize: true,
      correctColour: true,
      noLiftedEdges: true,
      noScorchMarks: true,
      noVinylDamage: true,
      carrierRemovedCorrectly: true,
      customerInstructionsSatisfied: true,
    });
    expect(heatPressQualityComplete(complete)).toBe(true);
  });

  it("limits durable evidence to safe image formats and five megabytes", () => {
    expect(heatPressPhotoMimeAllowed("image/jpeg")).toBe(true);
    expect(heatPressPhotoMimeAllowed("image/png")).toBe(true);
    expect(heatPressPhotoMimeAllowed("image/webp")).toBe(true);
    expect(heatPressPhotoMimeAllowed("image/svg+xml")).toBe(false);
    expect(heatPressPhotoMimeAllowed("text/html")).toBe(false);
    expect(MAX_HEAT_PRESS_EVIDENCE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("adds execution, events and durable photo evidence without rewriting production briefs", () => {
    const migration = source("../../prisma/migrations/20260809100000_phase13_manual_heat_press_workflow/migration.sql");
    expect(migration).toContain('CREATE TABLE "HeatPressRun"');
    expect(migration).toContain('CREATE TABLE "HeatPressEvent"');
    expect(migration).toContain('CREATE TABLE "HeatPressEvidence"');
    expect(migration).toContain('"data" BYTEA NOT NULL');
    expect(migration).toContain('REFERENCES "DesignProductionBrief"("id") ON DELETE CASCADE');
    expect(migration).not.toContain('ALTER TABLE "DesignProductionBrief" ADD COLUMN');
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("DELETE FROM");
  });

  it("server-enforces tenant, origin and heat-press state transitions", () => {
    const createRoute = source("../app/api/heat-press-runs/route.ts");
    const actionRoute = source("../app/api/heat-press-runs/[runId]/action/route.ts");
    expect(createRoute).toContain("requireRole(permissions.designs)");
    expect(createRoute).toContain("isTrustedApplicationOrigin(request)");
    expect(createRoute).toContain('status: "REVIEWED"');
    expect(createRoute).toContain("designProductionBriefId: brief.id");
    expect(actionRoute).toContain("where: { id: runId, shopId }");
    expect(actionRoute).toContain('"COMPLETE_FIRST_PRESS"');
    expect(actionRoute).toContain('"COMPLETE_PEEL"');
    expect(actionRoute).toContain('"COMPLETE_REPRESS"');
    expect(actionRoute).toContain('"PASS_QUALITY"');
    expect(actionRoute).toContain('"REQUIRE_REWORK"');
    expect(actionRoute).toContain("heatPressQualityComplete(checklist)");
  });

  it("keeps photo evidence tenant-scoped, hashed, size-limited and non-cacheable", () => {
    const upload = source("../app/api/heat-press-runs/[runId]/evidence/route.ts");
    const read = source("../app/api/heat-press-evidence/[evidenceId]/route.ts");
    expect(upload).toContain("MAX_HEAT_PRESS_EVIDENCE_BYTES");
    expect(upload).toContain("heatPressPhotoMimeAllowed(photo.type)");
    expect(upload).toContain('createHash("sha256")');
    expect(upload).toContain("where: { id: runId, shopId }");
    expect(read).toContain("where: { id: evidenceId, shopId: session.shopId }");
    expect(read).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(read).toContain('"X-Content-Type-Options": "nosniff"');
  });

  it("states clearly that the heat press remains manual", () => {
    const consoleSource = source("../components/design/heat-press-workflow-console.tsx");
    expect(consoleSource).toContain("It does not electronically set temperature, pressure, clamp force or peel the garment.");
    expect(consoleSource).toContain("Start first press");
    expect(consoleSource).toContain("Record peel completed");
    expect(consoleSource).toContain("Mark quality passed");
    expect(consoleSource).toContain("Require rework");
    expect(consoleSource).toContain("Attach finished photo");
  });
});
