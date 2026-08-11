import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 19G destructive and retry edge safety", () => {
  it("serializes machine job creation against profile retirement", () => {
    const migration = source("../../prisma/migrations/20260811193000_phase19g_machine_destructive_retry_guards/migration.sql");
    expect(migration).toContain("guard_machine_job_insert_state");
    expect(migration).toContain("guard_machine_profile_destructive_change");
    expect(migration).toContain(":machine-profile:");
    expect(migration.match(/pg_advisory_xact_lock/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("MACHINE_JOB_SOURCE_INVALID");
    expect(migration).toContain("EJM_MACHINE_PROFILE_HAS_OPEN_JOBS");
  });

  it("blocks identical active cutter jobs before a double-submit can duplicate the queue", () => {
    const migration = source("../../prisma/migrations/20260811193000_phase19g_machine_destructive_retry_guards/migration.sql");
    expect(migration).toContain(":machine-job:");
    expect(migration).toContain("job.\"status\" IN ('PREPARED', 'SENDING', 'FAILED')");
    expect(migration).toContain("MACHINE_JOB_DUPLICATE:%");
    expect(migration).toContain('BEFORE INSERT ON "MachineProductionJob"');
  });

  it("preserves machine production history instead of hard-deleting referenced profiles", () => {
    const migration = source("../../prisma/migrations/20260811193000_phase19g_machine_destructive_retry_guards/migration.sql");
    const phase10 = source("../../prisma/migrations/20260804231500_phase10_cutter_operations/migration.sql");
    expect(phase10).toContain('REFERENCES "ShopMachineProfile"("id") ON DELETE RESTRICT');
    expect(migration).toContain("EJM_MACHINE_PROFILE_HAS_HISTORY");
    expect(migration).toContain('BEFORE UPDATE OF "isActive" OR DELETE ON "ShopMachineProfile"');
    expect(migration).not.toContain('DELETE FROM "MachineProductionJob"');
  });

  it("returns intentional profile conflicts for open jobs and historical use", () => {
    const route = source("../app/api/design-machine-profiles/route.ts");
    expect(route).toContain("EJM_MACHINE_PROFILE_HAS_OPEN_JOBS");
    expect(route).toContain("MACHINE_PROFILE_HAS_OPEN_JOBS");
    expect(route).toContain("EJM_MACHINE_PROFILE_HAS_HISTORY");
    expect(route).toContain("MACHINE_PROFILE_HAS_HISTORY");
    expect(route).toContain('error.code === "P2003"');
    expect(route).toContain("Finish or cancel those jobs before deactivating");
  });

  it("maps database and application duplicate signals to one cutter conflict contract", () => {
    const route = source("../app/api/design-machine-jobs/route.ts");
    expect(route).toContain("error.message.match(/MACHINE_JOB_DUPLICATE:");
    expect(route).toContain("already queued, sending, failed and awaiting review");
    expect(route).toContain("existingJobId: duplicate[1]");
    expect(route).toContain('error.message.includes("MACHINE_JOB_SOURCE_INVALID")');
  });
});