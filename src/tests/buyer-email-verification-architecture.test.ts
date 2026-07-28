import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Release 27 buyer email verification", () => {
  it("stores only a hash with expiry, attempts and one-time verification state", () => {
    const model = source("../prisma/models/buyer-email-verification.prisma");
    const migration = source("../prisma/migrations/20260728234500_release27_buyer_email_verification/migration.sql");
    expect(model).toContain("codeHash");
    expect(model).not.toMatch(/\bcode\s+String/);
    expect(model).toContain("expiresAt");
    expect(model).toContain("attempts");
    expect(model).toContain("usedAt");
    expect(model).toContain("verifiedAt");
    expect(migration).toContain('CREATE UNIQUE INDEX "BuyerEmailVerification_buyerId_key"');
  });

  it("uses authenticated idempotent Resend delivery without logging the code", () => {
    const helper = source("lib/buyer-email-verification.ts");
    expect(helper).toContain('Authorization: `Bearer ${config.apiKey}`');
    expect(helper).toContain('"Idempotency-Key"');
    expect(helper).toContain('"User-Agent"');
    expect(helper).toContain("timingSafeEqual");
    expect(helper).toContain("attempts: { increment: 1 }");
    expect(helper).not.toContain("console.log");
  });

  it("requires a signed buyer session and rate limits send and verify actions", () => {
    const actions = source("app/buyer/verify-email/actions.ts");
    expect(actions.match(/getBuyerSession\(\)/g)?.length).toBe(2);
    expect(actions).toContain("buyer-email-code:");
    expect(actions).toContain("buyer-email-code-ip:");
    expect(actions).toContain("buyer-email-verify:");
    expect(actions).toContain("buyer-email-verify-ip:");
    expect(actions).toContain("auth.buyer_email_verified");
  });

  it("blocks the global verification model in normal and interactive tenant clients", () => {
    const tenantDb = source("lib/tenant-db.ts");
    const verifier = source("../scripts/verify-release27-email-isolation.ts");
    const packageJson = source("../package.json");
    expect(tenantDb).toContain('buyerEmailVerification: "BuyerEmailVerification"');
    expect(tenantDb).toContain("is not registered for tenant access");
    expect(verifier).toContain("Tenant client accessed buyer email verification records");
    expect(verifier).toContain("Interactive tenant transaction accessed buyer email verification records");
    expect(packageJson).toContain("verify-release27-email-isolation.ts");
  });
});
