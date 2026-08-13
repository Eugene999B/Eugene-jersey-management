import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 24H catalog category duplicate recovery", () => {
  it("maps category unique conflicts to the existing friendly error", () => {
    const actions = source("src/app/dashboard/catalog/actions.ts");
    expect(actions).toContain("Prisma.PrismaClientKnownRequestError");
    expect(actions.match(/error.code === "P2002"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(actions.match(/error=category-exists/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the operator-facing duplicate explanation wired", () => {
    const feedback = source("src/components/dashboard/dashboard-action-feedback.tsx");
    expect(feedback).toContain('"category-exists"');
    expect(feedback).toContain("A category with that name already exists in this shop");
  });
});
