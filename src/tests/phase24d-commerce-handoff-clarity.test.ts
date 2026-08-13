import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 24D commerce handoff clarity", () => {
  it("describes delivery-zone save semantics truthfully", () => {
    const page = source("src/app/dashboard/commerce/page.tsx");
    expect(page).toContain("Save zone");
    expect(page).toContain("Saving an existing zone name updates and reactivates that zone.");
    expect(page).not.toContain(">Create zone</Button>");
  });

  it("gives every return a direct handoff to its order controls", () => {
    const page = source("src/app/dashboard/commerce/page.tsx");
    expect(page).toContain('href={`/dashboard/orders/${request.order.id}`}');
    expect(page).toContain("Open order");
    expect(page).toContain("Process any refund from the order's Payment & refunds panel");
  });

  it("keeps return accounting separate from the workflow status action", () => {
    const action = source("src/app/dashboard/commerce/actions.ts");
    expect(action).not.toContain("ReturnRequestStatus.REFUNDED,");
    expect(action).not.toContain("ReturnRequestStatus.EXCHANGED,");
    expect(action).not.toContain("paymentRefund");
    expect(action).not.toContain("productVariant.update");
  });
});
