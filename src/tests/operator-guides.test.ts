import { describe, expect, it } from "vitest";
import { adminHandbook, adminPageGuide, designGuide } from "@/lib/operator-guides";

describe("operator guides", () => {
  it("explains that registered shops control their own storefront visibility", () => {
    const shopGuide = adminPageGuide("/admin/shops/example");
    expect(shopGuide.sections[0].heading).toBe("Shops");
    expect(JSON.stringify(shopGuide)).toContain("registered shop");
    expect(JSON.stringify(shopGuide)).toContain("Online, Browse-only or Offline");
  });

  it("covers shop, supplier and commercial operations in the complete handbook", () => {
    const content = JSON.stringify(adminHandbook);
    expect(content).toContain("How shops and suppliers operate");
    expect(content).toContain("How shop teams operate");
    expect(content).toContain("saves plan changes immediately");
  });

  it("provides safe Design Studio instructions", () => {
    const content = JSON.stringify(designGuide());
    expect(content).toContain("machine profile");
    expect(content).toContain("recovery draft");
    expect(content).toContain("HPGL, PLT or DXF");
  });
});
