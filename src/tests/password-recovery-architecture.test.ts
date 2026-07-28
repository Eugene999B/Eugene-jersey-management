import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Release 28 password recovery and email trust", () => {
  it("stores recovery challenges without plaintext codes", () => {
    const model = source("../prisma/models/password-recovery.prisma");
    const migration = source("../prisma/migrations/20260729010000_release28_password_recovery_email_trust/migration.sql");
    expect(model).toContain("publicTokenHash");
    expect(model).toContain("codeHash");
    expect(model).not.toMatch(/\bcode\s+String/);
    expect(model).toContain("expiresAt");
    expect(model).toContain("attempts");
    expect(model).toContain("usedAt");
    expect(model).toContain("deliveryStatus");
    expect(migration).toContain('CREATE UNIQUE INDEX "PasswordRecoveryChallenge_publicTokenHash_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "EmailProviderEvent_provider_eventId_key"');
  });

  it("uses opaque one-time challenges for both staff and buyer resets", () => {
    const helper = source("lib/password-recovery.ts");
    const staffRequest = source("app/forgot-password/actions.ts");
    const staffReset = source("app/reset-password/actions.ts");
    const buyerRequest = source("app/buyer/forgot-password/actions.ts");
    const buyerReset = source("app/buyer/reset-password/actions.ts");
    expect(helper).toContain("createPlainToken");
    expect(helper).toContain("timingSafeEqual");
    expect(helper).toContain("attempts: { increment: 1 }");
    expect(helper).toContain("usedAt");
    expect(staffRequest).toContain("PasswordRecoveryChannel");
    expect(staffReset).toContain("AccountKind.USER");
    expect(buyerRequest).toContain("AccountKind.BUYER");
    expect(buyerReset).toContain("clearBuyerSessionCookie");
    expect(staffReset).not.toContain('formData.get("phone")');
  });

  it("prevents public recovery requests from revealing whether an account exists", () => {
    const staffRequest = source("app/forgot-password/actions.ts");
    const staffPage = source("app/forgot-password/page.tsx");
    const buyerRequest = source("app/buyer/forgot-password/actions.ts");
    const buyerPage = source("app/buyer/forgot-password/page.tsx");
    expect(staffRequest).toContain('redirect("/forgot-password?sent=1")');
    expect(buyerRequest).toContain("buyer/forgot-password?sent=1");
    expect(staffPage).toContain("does not confirm whether");
    expect(buyerPage).toContain("never confirms whether");
  });

  it("separates provider acceptance, delivery and ownership verification", () => {
    const transactional = source("lib/transactional-email.ts");
    const recovery = source("lib/password-recovery.ts");
    const emailVerification = source("lib/buyer-email-verification.ts");
    const health = source("lib/production-integration-health.ts");
    const webhook = source("app/api/webhooks/resend/route.ts");
    expect(transactional).toContain("resolveMx");
    expect(transactional).toContain("sendTransactionalEmail");
    expect(recovery).toContain("EmailDeliveryStatus.DELIVERED");
    expect(recovery).toContain("EmailDeliveryStatus.BOUNCED");
    expect(emailVerification).toContain("verifiedAt");
    expect(health).toContain("https://api.resend.com/domains?limit=100");
    expect(health).toContain('domainStatus === "verified"');
    expect(webhook).toContain("verifyResendWebhookSignature");
    expect(webhook).toContain("EmailProviderEvent");
  });

  it("blocks platform recovery records from normal and interactive tenant clients", () => {
    const tenantDb = source("lib/tenant-db.ts");
    const verifier = source("../scripts/verify-release28-recovery-isolation.ts");
    const packageJson = source("../package.json");
    expect(tenantDb).toContain("looksLikePrismaDelegate");
    expect(tenantDb).toContain("is not registered for tenant access");
    expect(verifier).toContain("Tenant client accessed password recovery challenges");
    expect(verifier).toContain("Interactive tenant transaction accessed email provider events");
    expect(packageJson).toContain("verify-release28-recovery-isolation.ts");
  });
});