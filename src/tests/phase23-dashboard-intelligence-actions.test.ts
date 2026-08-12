import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 23 dashboard intelligence actions", () => {
  it("links low-stock intelligence only when catalogue navigation is allowed", () => {
    const page = source("../app/dashboard/page.tsx");
    expect(page).toContain('{visibleNavigation.catalog ? <Link href="/dashboard/catalog"');
    expect(page).toContain("Review stock");
  });

  it("links overdue-debt intelligence only when debt navigation is allowed", () => {
    const page = source("../app/dashboard/page.tsx");
    expect(page).toContain('{visibleNavigation.debts ? <Link href="/dashboard/debts"');
    expect(page).toContain("Review debts");
  });

  it("keeps risk summaries visible even when the current role cannot open the destination", () => {
    const page = source("../app/dashboard/page.tsx");
    expect(page).toContain("product variant(s) need stock attention.");
    expect(page).toContain("overdue debt account(s) need follow-up.");
  });
});
