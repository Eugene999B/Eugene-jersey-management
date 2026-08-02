import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 3 interface design system", () => {
  test("defines shared layout, feedback, table and selection primitives", () => {
    const css = source("src/app/globals.css");
    expect(css).toContain(".page-header");
    expect(css).toContain(".feedback-state");
    expect(css).toContain(".selection-card.is-selected");
    expect(css).toContain(".table-shell");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("focus-visible");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  test("keeps reusable controls accessible and touch friendly", () => {
    const button = source("src/components/ui/button.tsx");
    const selection = source("src/components/ui/selection-card.tsx");
    const feedback = source("src/components/ui/feedback-state.tsx");
    const table = source("src/components/ui/data-table-shell.tsx");

    expect(button).toContain("min-h-11");
    expect(button).toContain("focus-visible:ring-4");
    expect(button).toContain("aria-busy");
    expect(selection).toContain("aria-pressed");
    expect(selection).toContain("CheckCircle2");
    expect(feedback).toContain("aria-live");
    expect(feedback).toContain('role={state === "error" ? "alert" : "status"}');
    expect(table).toContain('role="region"');
    expect(table).toContain("tabIndex={0}");
  });

  test("applies obvious selected states to checkout and customer choice", () => {
    const pos = source("src/components/pos/pos-terminal.tsx");
    const customer = source("src/components/customers/customer-search-select.tsx");

    expect(pos).toContain('role="radiogroup"');
    expect(pos).toContain('aria-checked={selected}');
    expect(pos).toContain('selectedLabel="Selected"');
    expect(customer).toContain("<SelectionCard");
    expect(customer).toContain("Tap to change customer");
  });

  test("requires confirmation before high-impact administrator access changes", () => {
    const confirmation = source("src/components/ui/confirm-action-button.tsx");
    const businesses = source("src/app/admin/shops/page.tsx");
    const businessDetail = source("src/app/admin/shops/[shopId]/page.tsx");

    expect(confirmation).toContain("window.confirm");
    expect(businesses).toContain("<ConfirmActionButton");
    expect(businessDetail).toContain("<ConfirmActionButton");
    expect(businesses).toContain("Staff will lose operational access");
  });

  test("uses the shared page and state structure on core tenant and platform screens", () => {
    expect(source("src/app/dashboard/customers/page.tsx")).toContain("<PageHeader");
    expect(source("src/app/dashboard/designs/page.tsx")).toContain("<FeedbackState");
    expect(source("src/app/admin/shops/page.tsx")).toContain("<DataTableShell");
  });
});
