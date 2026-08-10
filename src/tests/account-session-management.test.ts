import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("account session and device management", () => {
  it("stores durable platform-global sessions with expiry and revocation evidence", () => {
    const schema = source("../../prisma/models/account-security.prisma");
    const migration = source("../../prisma/migrations/20260810150000_account_session_devices/migration.sql");

    expect(schema).toContain("model AccountSession");
    expect(schema).toContain("accountKind   AccountKind");
    expect(schema).toContain("accountId     String");
    expect(schema).toContain("lastSeenAt");
    expect(schema).toContain("expiresAt");
    expect(schema).toContain("revokedAt");
    expect(schema).toContain("revokedReason");
    expect(schema).toContain("@@index([accountKind, accountId, revokedAt, expiresAt])");
    expect(migration).toContain('CREATE TABLE "AccountSession"');
    expect(migration).toContain('"AccountKind" NOT NULL');
  });

  it("binds staff and buyer JWTs to one durable session id", () => {
    const staffToken = source("../lib/session-token.ts");
    const buyerSession = source("../lib/buyer-session.ts");
    const staffAuth = source("../lib/auth.ts");

    expect(staffToken).toContain("sessionId: user.sessionId");
    expect(staffToken).toContain(".setJti(user.sessionId)");
    expect(staffToken).toContain("|| !payload.sessionId");
    expect(buyerSession).toContain("sessionId: buyer.sessionId");
    expect(buyerSession).toContain(".setJti(buyer.sessionId)");
    expect(buyerSession).toContain("isAccountSessionActive");
    expect(staffAuth).toContain("createAccountSession");
    expect(staffAuth).toContain("isAccountSessionActive");
  });

  it("registers sessions only after password or two-factor authentication succeeds", () => {
    const staffLogin = source("../app/api/auth/login/route.ts");
    const twoFactorLogin = source("../app/api/auth/two-factor/route.ts");
    const buyerLogin = source("../app/buyer/login/actions.ts");
    const buyerSession = source("../lib/buyer-session.ts");

    expect(staffLogin).toContain("createAccountSession");
    expect(staffLogin).toContain("sessionId: accountSession.id");
    expect(twoFactorLogin.match(/createAccountSession/g)?.length).toBeGreaterThanOrEqual(2);
    expect(twoFactorLogin).toContain("AccountKind.USER");
    expect(twoFactorLogin).toContain("AccountKind.BUYER");
    expect(buyerLogin).toContain("setBuyerSessionCookie");
    expect(buyerSession).toContain("accountSessionMetadataFromHeaders");
  });

  it("revokes the exact durable record during normal logout", () => {
    const workforceLogout = source("../app/logout/route.ts");
    const buyerLogout = source("../app/buyer/logout/route.ts");

    for (const route of [workforceLogout, buyerLogout]) {
      expect(route).toContain("revokeAccountSession");
      expect(route).toContain('reason: "logout"');
      expect(route).toContain("sessionId:");
    }
  });

  it("marks all durable sessions revoked after high-risk credential changes", () => {
    const passwordChange = source("../app/api/account/password/route.ts");
    const twoFactor = source("../app/api/account/two-factor/route.ts");
    const workforceRecovery = source("../app/reset-password/actions.ts");
    const buyerRecovery = source("../app/buyer/reset-password/actions.ts");

    expect(passwordChange).toContain("revokeAllAccountSessions");
    expect(passwordChange).toContain('reason: "password-changed"');
    expect(twoFactor).toContain("revokeAllAccountSessions");
    expect(twoFactor).toContain('"two-factor-enabled"');
    expect(twoFactor).toContain('"two-factor-disabled"');
    expect(workforceRecovery).toContain('reason: "password-reset"');
    expect(buyerRecovery).toContain('reason: "password-reset"');
  });

  it("scopes device revocation to the authenticated account and account surface", () => {
    const actions = source("../app/account/security/session-actions.ts");
    const panel = source("../components/account/session-security-panel.tsx");

    expect(actions).toContain('formData.get("accountKind")');
    expect(actions).toContain("getSession()");
    expect(actions).toContain("getBuyerSession()");
    expect(actions).toContain("accountId: actor.accountId");
    expect(actions).toContain("currentSessionId: actor.currentSessionId");
    expect(actions).toContain('action: "auth.session_revoked"');
    expect(actions).toContain('action: "auth.other_sessions_revoked"');
    expect(panel).toContain('name="accountKind"');
    expect(panel).toContain('name="sessionId"');
    expect(panel).toContain("Sign out other devices");
    expect(panel).toContain("Sign out this device");
  });

  it("shows device history to both workforce and buyers", () => {
    const workforce = source("../app/account/security/page.tsx");
    const buyer = source("../app/buyer/security/page.tsx");

    expect(workforce).toContain("listAccountSessions");
    expect(workforce).toContain("accountKind={AccountKind.USER}");
    expect(buyer).toContain("listAccountSessions");
    expect(buyer).toContain("accountKind={AccountKind.BUYER}");
  });

  it("keeps AccountSession outside the tenant-scoped model registry", () => {
    const tenantDb = source("../lib/tenant-db.ts");

    expect(tenantDb).not.toContain('accountSession: "AccountSession"');
    expect(tenantDb).toContain("is platform-global or has an unsupported ownership rule");
    expect(tenantDb).toContain("blockedUnknownDelegate");
  });
});
