import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CUTTER_CHECKLIST_ITEMS,
  EMPTY_CUTTER_CHECKLIST,
  cutterChecklistComplete,
  machineProductionAreaError,
} from "@/lib/design-machine-operations";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 10 cutter operations and direct serial control", () => {
  it("requires every physical operator check", () => {
    expect(cutterChecklistComplete(EMPTY_CUTTER_CHECKLIST)).toBe(false);
    const complete = Object.fromEntries(CUTTER_CHECKLIST_ITEMS.map((item) => [item.key, true])) as typeof EMPTY_CUTTER_CHECKLIST;
    expect(cutterChecklistComplete(complete)).toBe(true);
    expect(CUTTER_CHECKLIST_ITEMS.map((item) => item.key)).toEqual([
      "materialLoaded",
      "pinchRollersLocked",
      "bladeChecked",
      "originSet",
      "areaClear",
      "testCutPassed",
    ]);
  });

  it("blocks narrow material and machine-bed overflow", () => {
    const profile = { bedWidthMm: 610, bedHeightMm: 1000 };
    expect(machineProductionAreaError({ profile, materialWidthMm: 300, sheet: { width: 305, height: 508 } })).toContain("narrower");
    expect(machineProductionAreaError({ profile, materialWidthMm: 700, sheet: { width: 700, height: 508 } })).toContain("exceeds");
    expect(machineProductionAreaError({ profile, materialWidthMm: 610, sheet: { width: 305, height: 508 } })).toBeNull();
  });

  it("uses additive queue tables without rewriting artwork or business records", () => {
    const migration = source("../../prisma/migrations/20260804231500_phase10_cutter_operations/migration.sql");
    expect(migration).toContain('CREATE TABLE "MachineProductionJob"');
    expect(migration).toContain('CREATE TABLE "MachineProductionAttempt"');
    expect(migration).toContain("'PREPARED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'");
    expect(migration).toContain('FOREIGN KEY ("designJobId") REFERENCES "DesignJob"');
    expect(migration).not.toContain('DROP TABLE "DesignJob"');
    expect(migration).not.toContain('UPDATE "DesignJob"');
    expect(migration).not.toContain('DELETE FROM "Order"');
    expect(migration).not.toContain('UPDATE "Payment"');
  });

  it("scopes raw queue operations by shop and prevents concurrent or duplicate sends", () => {
    const service = source("../lib/machine-production-jobs.ts");
    expect(service).toContain('jobs."shopId" = ${shopId}');
    expect(service).toContain('"shopId" = ${input.shopId}');
    expect(service).toContain("NOW() - INTERVAL '15 minutes'");
    expect(service).toContain('"status" IN (\'PREPARED\', \'FAILED\')');
    expect(service).toContain('"status" = \'SENDING\'');
    expect(service).toContain("MACHINE_JOB_NOT_SENDABLE");
    expect(service).toContain("MACHINE_JOB_NOT_CANCELLABLE");
  });

  it("accepts only a saved shop design, active direct HPGL profile and complete checklist", () => {
    const route = source("../app/api/design-machine-jobs/route.ts");
    expect(route).toContain("materialLoaded: z.literal(true)");
    expect(route).toContain("testCutPassed: z.literal(true)");
    expect(route).toContain('outputFormat: "HPGL"');
    expect(route).toContain('connectionMode: "WEB_SERIAL"');
    expect(route).toContain("The loaded material is narrower");
    expect(route).toContain("The prepared production area exceeds");
    expect(route).toContain("MACHINE_JOB_DUPLICATE");
    expect(route).toContain("createHash(\"sha256\")");
  });

  it("keeps the browser console human-gated and free of arbitrary command input", () => {
    const consoleSource = source("../components/design/cutter-operations-console.tsx");
    expect(consoleSource).toContain("Only a saved shop design can enter the durable machine queue");
    expect(consoleSource).toContain("buildDesignCutPaths");
    expect(consoleSource).toContain("outlineDesignTextLayers");
    expect(consoleSource).toContain("buildCutHpgl");
    expect(consoleSource).toContain("configuredSerialFilters");
    expect(consoleSource).toContain("compareDetectedHardware");
    expect(consoleSource).toContain("Once serial bytes reach the cutter, the browser cannot recall blade movement");
    expect(consoleSource).toContain("/claim");
    expect(consoleSource).toContain("/result");
    expect(consoleSource).not.toContain("Raw HPGL");
    expect(consoleSource).not.toContain("textarea");
  });

  it("provides an operator route directly from Design Studio", () => {
    const studio = source("../app/dashboard/designs/page.tsx");
    const operations = source("../app/dashboard/designs/production/page.tsx");
    expect(studio).toContain('/dashboard/designs/production');
    expect(operations).toContain("Cutter operations");
    expect(operations).toContain("Chrome or Edge Web Serial");
    expect(operations).toContain("The browser always asks the operator to choose the port");
  });
});
