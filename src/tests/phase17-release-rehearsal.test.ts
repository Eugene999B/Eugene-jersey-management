import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 17 staging migration rollback and final acceptance", () => {
  it("keeps Railway deployment ordered as migrate activate purge before health-checked start", () => {
    const railway = source("../../railway.toml");
    expect(railway).toContain('preDeployCommand = "npx prisma migrate deploy && npm run production:activate && npm run production:purge-demo"');
    expect(railway).toContain('healthcheckPath = "/api/health"');
    expect(railway).toContain('restartPolicyType = "ALWAYS"');
  });

  it("runs a dump restore rollback rehearsal as a mandatory CI gate", () => {
    const workflow = source("../../.github/workflows/ci.yml");
    expect(workflow).toContain("Rehearse migrated database backup and rollback restore");
    expect(workflow).toContain("npx prisma migrate status");
    expect(workflow).toContain("pg_dump");
    expect(workflow).toContain("createdb --host=localhost --username=postgres phase17_restore");
    expect(workflow).toContain("pg_restore");
    expect(workflow).toContain("phase17-release-rehearsal.ts verify");
    expect(workflow).toContain("phase17-release-fingerprint.json");
  });

  it("fails closed outside explicit non-production release rehearsal", () => {
    const rehearsal = source("../../scripts/phase17-release-rehearsal.ts");
    expect(rehearsal).toContain('process.env.PHASE17_RELEASE_REHEARSAL !== "true"');
    expect(rehearsal).toContain('process.env.NODE_ENV === "production"');
    expect(rehearsal).toContain("Phase 17 release rehearsal refuses to run in production.");
  });

  it("fingerprints tenant order payment and physical production inventory evidence", () => {
    const rehearsal = source("../../scripts/phase17-release-rehearsal.ts");
    expect(rehearsal).toContain("Phase 17 Release Canary");
    expect(rehearsal).toContain("PHASE17-CANARY-RECEIPT");
    expect(rehearsal).toContain("PaymentStatus.SUCCESS");
    expect(rehearsal).toContain("ProductionInventoryMovementType.PRODUCTION_USE");
    expect(rehearsal).toContain("materialUseCost: \"6.4\"");
    expect(rehearsal).toContain('createHash("sha256")');
    expect(rehearsal).toContain("data fingerprint changed after backup/restore rehearsal");
  });

  it("adds a final authenticated cross-surface browser sweep including mobile overflow", () => {
    const acceptance = source("../../e2e/tests/phase17-final-release-acceptance.spec.ts");
    expect(acceptance).toContain('"/dashboard/designs/production"');
    expect(acceptance).toContain('"/dashboard/production-stock"');
    expect(acceptance).toContain('"/dashboard/customer-production"');
    expect(acceptance).toContain('"/dashboard/reports"');
    expect(acceptance).toContain('"/admin/reports"');
    expect(acceptance).toContain('"/admin/integrations"');
    expect(acceptance).toContain('"/buyer/production-requests"');
    expect(acceptance).toContain("scrollWidth");
    expect(acceptance).toContain("390, height: 844");
  });
});
