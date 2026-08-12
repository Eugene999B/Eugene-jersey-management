import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 23 route and role consistency", () => {
  it("keeps Customer Production readable to order-read roles but limits mutations to production operators", () => {
    const page = source("../app/dashboard/customer-production/page.tsx");
    const actions = source("../app/dashboard/customer-production/actions.ts");
    expect(page).toContain("await requireRole(permissions.ordersRead)");
    expect(page).toContain("const PRODUCTION_ACTION_ROLES");
    expect(page).toContain("Role.OWNER, Role.MANAGER, Role.DESIGNER");
    expect(page).toContain("const canManageProduction = PRODUCTION_ACTION_ROLES.has(session.role)");
    expect(page).toContain("Read-only production view");
    expect(actions).toContain("const productionRoles = [Role.OWNER, Role.MANAGER, Role.DESIGNER]");
  });

  it("does not render mutation-only destinations to read-only Customer Production roles", () => {
    const page = source("../app/dashboard/customer-production/page.tsx");
    expect(page).toContain("{canManageProduction ? <LinkButton href=\"/dashboard/designs\"");
    expect(page).toContain("{canOpenProductionStock ? <LinkButton href=\"/dashboard/production-stock\"");
    expect(page).toContain("canManageProduction && request.status === CustomerProductionRequestStatus.DEPOSIT_PAID");
    expect(page).toContain("canManageProduction && request.status === CustomerProductionRequestStatus.IN_PRODUCTION");
    expect(page).toContain("{canManageProduction ? <form action={advanceCustomerProductionAction}");
  });

  it("uses the shared pending-safe Button for Customer Production mutations", () => {
    const page = source("../app/dashboard/customer-production/page.tsx");
    expect(page).toContain('import { Button, LinkButton } from "@/components/ui/button"');
    expect(page).not.toMatch(/<button[^>]*type=\"submit\"/);
    expect(page).toContain("<Button>Send preview v");
    expect(page).toContain("<Button variant=\"secondary\"><Play");
    expect(page).toContain("<Button><PackageCheck");
    expect(page).toContain("<Button disabled={!request.balancePaidAt}><CheckCircle2");
  });
});
