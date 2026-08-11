import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  assignableStaffRoles,
  canAssignStaffRole,
  canToggleStaffAccess,
} from "@/lib/staff-authority";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 19E tenant staff authority", () => {
  it("never allows tenant staff management to disable an owner", () => {
    expect(canToggleStaffAccess(Role.OWNER, Role.OWNER)).toBe(false);
    expect(canToggleStaffAccess(Role.MANAGER, Role.OWNER)).toBe(false);
  });

  it("lets owners manage managers while managers can manage ordinary staff only", () => {
    expect(canAssignStaffRole(Role.OWNER, Role.MANAGER)).toBe(true);
    expect(canAssignStaffRole(Role.MANAGER, Role.MANAGER)).toBe(false);
    expect(canToggleStaffAccess(Role.OWNER, Role.MANAGER)).toBe(true);
    expect(canToggleStaffAccess(Role.MANAGER, Role.MANAGER)).toBe(false);
    expect(canAssignStaffRole(Role.MANAGER, Role.CASHIER)).toBe(true);
    expect(assignableStaffRoles(Role.MANAGER)).not.toContain(Role.MANAGER);
  });

  it("enforces the hierarchy in server actions, not only the UI", () => {
    const actions = source("src/app/dashboard/staff/actions.ts");
    expect(actions).toContain("canAssignStaffRole(session.role, parsed.data.role)");
    expect(actions).toContain("canToggleStaffAccess(session.role, user.role)");
    expect(actions).toContain('staffRedirect("role-authority")');
    expect(actions).toContain('if (user.id === session.id) staffRedirect("self")');
  });

  it("keeps access toggles invalidating active sessions", () => {
    const entitlement = source("src/lib/subscription-entitlements.ts");
    expect(entitlement).toContain("sessionVersion: { increment: 1 }");
  });
});

describe("Phase 19E staff setup clarity", () => {
  it("uses the actual 12-character password policy in the staff form", () => {
    const page = source("src/app/dashboard/staff/page.tsx");
    const policy = source("src/lib/password-policy.ts");
    expect(policy).toContain("PASSWORD_MIN_LENGTH = 12");
    expect(page).toContain("minLength={PASSWORD_MIN_LENGTH}");
    expect(page).toContain("characters with a letter and number");
  });
});
