import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 24L activity mobile accessibility", () => {
  it("keeps the wide activity table reachable on narrow screens", () => {
    const page = source("src/app/dashboard/activity/page.tsx");
    expect(page).toContain('className="overflow-x-auto"');
    expect(page).toContain('min-w-[820px]');
  });
});
