import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function hasObjectKey(sourceText: string, key: string) {
  return sourceText.includes(`${key}:`) || sourceText.includes(`"${key}":`);
}

function expectCodesCovered(component: string, actions: string, route: string, codes: string[]) {
  for (const code of codes) {
    expect(actions).toContain(`${route}?error=${code}`);
    expect(hasObjectKey(component, code)).toBe(true);
  }
}

describe("Phase 20 dashboard action feedback", () => {
  test("dashboard shell renders route-aware action feedback safely behind suspense", () => {
    const layout = source("src/app/dashboard/layout.tsx");
    const feedback = source("src/components/dashboard/dashboard-action-feedback.tsx");

    expect(layout).toContain("DashboardActionFeedback");
    expect(layout).toContain("<Suspense fallback={null}><DashboardActionFeedback /></Suspense>");
    expect(feedback).toContain("useSearchParams");
    expect(feedback).toContain('role="alert"');
  });

  test("commerce failures all have visible recovery guidance", () => {
    const actions = source("src/app/dashboard/commerce/actions.ts");
    const feedback = source("src/components/dashboard/dashboard-action-feedback.tsx");
    expectCodesCovered(feedback, actions, "/dashboard/commerce", [
      "zone",
      "coupon",
      "coupon-usage-limit",
      "return-workflow",
      "return",
      "return-transition",
      "return-changed",
    ]);
  });

  test("production stock failures all have visible recovery guidance", () => {
    const actions = source("src/app/dashboard/production-stock/actions.ts");
    const feedback = source("src/components/dashboard/dashboard-action-feedback.tsx");
    expectCodesCovered(feedback, actions, "/dashboard/production-stock", [
      "item",
      "variant",
      "item-duplicate",
      "adjustment",
      "adjustment-stock",
      "payment",
      "supplier",
      "return",
      "return-tenant",
      "return-stock",
      "cost",
      "cost-stock",
      "cost-design",
      "cost-posted",
      "post",
      "post-stock",
    ]);
  });

  test("catalogue and closing validation failures are no longer silent", () => {
    const catalogActions = source("src/app/dashboard/catalog/actions.ts");
    const closingActions = source("src/app/dashboard/closing/actions.ts");
    const feedback = source("src/components/dashboard/dashboard-action-feedback.tsx");

    for (const code of ["category", "category-update", "template-not-found"]) {
      expect(catalogActions).toContain(`/dashboard/catalog?error=${code}`);
      expect(hasObjectKey(feedback, code)).toBe(true);
    }
    expect(closingActions).toContain("/dashboard/closing?error=invalid");
    expect(hasObjectKey(feedback, "invalid")).toBe(true);
  });

  test("unexpected dashboard errors warn against blind retries", () => {
    const boundary = source("src/app/dashboard/error.tsx");
    expect(boundary).toContain("Review the latest page state before repeating the action");
    expect(boundary).toContain("avoid repeating the business action until its current status is clear");
    expect(boundary).toContain("Try page again");
    expect(boundary).toContain("Return to Home");
  });
});
