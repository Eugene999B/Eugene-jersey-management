import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 24N message history count labels", () => {
  it("labels the latest-60 channel counts as recent rather than lifetime totals", () => {
    const page = source("src/app/dashboard/messages/page.tsx");
    expect(page).toContain('take: 60');
    expect(page).toContain("Recent SMS records");
    expect(page).toContain("Recent WhatsApp records");
    expect(page).toContain("Within the latest 60 message records");
    expect(page).not.toContain('>SMS records</p>');
    expect(page).not.toContain('>WhatsApp records</p>');
  });
});
