import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("automatic product photo fitting", () => {
  it("shows complete product photographs without cover cropping", () => {
    const css = source("../app/globals.css");

    expect(css).toContain('.bg-cover[style*="background-image"]');
    expect(css).toContain("background-size: contain !important");
    expect(css).toContain("background-repeat: no-repeat");
    expect(css).toContain("background-position: center");
  });

  it("applies the shared fitting rule to every current product-photo surface", () => {
    const surfaces = [
      "../app/shops/page.tsx",
      "../app/shop/[slug]/page.tsx",
      "../app/dashboard/catalog/page.tsx",
      "../app/cart/page.tsx",
      "../components/pos/pos-terminal.tsx",
    ];

    for (const path of surfaces) {
      expect(source(path)).toContain("bg-cover");
      expect(source(path)).toContain("backgroundImage");
    }
  });
});
