import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 22 consequential action confirmations", () => {
  test("supplier receipt requires confirmation before posting stock and supplier accounting", () => {
    const page = source("src/app/dashboard/suppliers/page.tsx");
    expect(page).toContain('import { ConfirmActionButton } from "@/components/ui/confirm-action-button"');
    expect(page).toContain('confirmation="Receive this purchase order and post its linked stock, cost history and supplier balance?');
    expect(page).toContain("<PackageCheck size={16} /> Receive & post stock</ConfirmActionButton>");
  });

  test("network fulfilment requires confirmation before reducing linked stock", () => {
    const page = source("src/app/dashboard/network/page.tsx");
    expect(page).toContain('import { ConfirmActionButton } from "@/components/ui/confirm-action-button"');
    expect(page).toContain('confirmation="Fulfil this partner request now? Linked non-service stock will be reduced');
    expect(page).toContain(">Fulfill request</ConfirmActionButton>");
  });

  test("Paystack refund issue and retry require confirmation and reconciliation uses pending-safe shared button", () => {
    const panel = source("src/components/orders/payment-refund-panel.tsx");
    expect(panel).toContain('confirmation="Issue this Paystack refund now?');
    expect(panel).toContain('confirmation="Retry this refund through Paystack with the selected bank details?');
    expect(panel).toContain("<Button variant=\"outline\" size=\"sm\"><RefreshCw size={14} />Reconcile with Paystack</Button>");
    expect(panel).not.toContain('<button type="submit"');
  });

  test("supplier receiving browser acceptance explicitly accepts the confirmation", () => {
    const e2e = source("e2e/tests/phase14-stock-purchasing-costing.spec.ts");
    expect(e2e).toContain('page.once("dialog", (dialog) => dialog.accept())');
    expect(e2e).toContain('name: "Receive & post stock", exact: true');
  });
});
