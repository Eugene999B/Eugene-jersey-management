import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deploymentPlan, resolveDeploymentTier } from "../../scripts/deployment-predeploy";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 17 staging migration, rollback and release readiness", () => {
  it("treats only the Railway production environment as production by default", () => {
    expect(resolveDeploymentTier({ RAILWAY_ENVIRONMENT_NAME: "production" })).toBe("production");
    expect(resolveDeploymentTier({ RAILWAY_ENVIRONMENT_NAME: "staging" })).toBe("staging");
    expect(resolveDeploymentTier({ RAILWAY_ENVIRONMENT_NAME: "preview-pr-17" })).toBe("staging");
    expect(resolveDeploymentTier({ CI: "true" })).toBe("staging");
  });

  it("requires explicit valid deployment tiers and refuses an ambiguous local release", () => {
    expect(resolveDeploymentTier({ ESM_DEPLOYMENT_TIER: "production" })).toBe("production");
    expect(resolveDeploymentTier({ ESM_DEPLOYMENT_TIER: "staging" })).toBe("staging");
    expect(() => resolveDeploymentTier({ ESM_DEPLOYMENT_TIER: "prod" })).toThrow(/production or staging/);
    expect(() => resolveDeploymentTier({})).toThrow(/requires RAILWAY_ENVIRONMENT_NAME/);
  });

  it("never runs production account activation or destructive demo cleanup in the staging plan", () => {
    expect(deploymentPlan("staging")).toEqual(["prisma-migrate-deploy", "release-database-verify"]);
    expect(deploymentPlan("production")).toEqual([
      "prisma-migrate-deploy",
      "production-activate",
      "production-purge-demo",
      "release-database-verify",
    ]);
  });

  it("routes Railway predeploy through the environment-aware release command", () => {
    const railway = source("../../railway.toml");
    expect(railway).toContain('preDeployCommand = "npm run deployment:predeploy"');
    expect(railway).not.toContain("npx prisma migrate deploy && npm run production:activate");
  });

  it("hard-blocks database recovery rehearsal against production and non-loopback databases", () => {
    const recovery = source("../../scripts/verify-database-recovery.mjs");
    expect(recovery).toContain("Database recovery rehearsal is forbidden against production");
    expect(recovery).toContain("requires CI=true or RECOVERY_REHEARSAL=true");
    expect(recovery).toContain('["localhost", "127.0.0.1", "::1"]');
    expect(recovery).toContain('"pg_dump"');
    expect(recovery).toContain('"pg_restore"');
    expect(recovery).toContain("Recovered table counts do not match source counts");
    expect(recovery).toContain("Recovered Prisma migration history does not match the source database");
  });

  it("verifies migration history and production identity safety after Railway predeploy", () => {
    const verifier = source("../../scripts/verify-release-database.ts");
    expect(verifier).toContain('FROM "_prisma_migrations"');
    expect(verifier).toContain("unfinished Prisma migration");
    expect(verifier).toContain("active shop-independent SUPER_ADMIN");
    expect(verifier).toContain("Production demo access remains exposed");
    expect(verifier).toContain("Browser acceptance tenant markers were found in production");
  });

  it("makes staging migration and PostgreSQL recovery rehearsal mandatory in the main CI gate", () => {
    const workflow = source("../../.github/workflows/ci.yml");
    expect(workflow).toContain("Verify staging pre-deploy path");
    expect(workflow).toContain("RAILWAY_ENVIRONMENT_NAME: staging");
    expect(workflow).toContain("Rehearse PostgreSQL backup and restore");
    expect(workflow).toContain("npm run release:verify-recovery");
    expect(workflow.indexOf("Seed browser acceptance identities")).toBeLessThan(workflow.indexOf("Rehearse PostgreSQL backup and restore"));
  });

  it("supports an explicit external staging target without starting the local Next.js server", () => {
    const config = source("../../e2e/playwright.config.ts");
    const test = source("../../e2e/tests/phase17-staging-release-smoke.spec.ts");
    const workflow = source("../../.github/workflows/staging-acceptance.yml");
    expect(config).toContain('process.env.E2E_EXTERNAL === "true"');
    expect(config).toContain("webServer: externalTarget");
    expect(test).toContain("/api/health");
    expect(test).toContain("Platform reports");
    expect(test).toContain("Production Integration Health");
    expect(workflow).toContain("environment: staging");
    expect(workflow).toContain("STAGING_ADMIN_LOGIN_ID");
    expect(workflow).toContain("STAGING_ADMIN_PASSWORD");
  });
});
