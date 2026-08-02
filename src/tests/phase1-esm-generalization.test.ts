import { describe, expect, it } from "vitest";
import { BUSINESS_TYPE_OPTIONS, PLATFORM_LOGO_PATH, PLATFORM_MARK_PATH, PLATFORM_NAME, PLATFORM_SHORT_NAME, businessTypeLabel } from "@/lib/brand";

describe("Phase 1 ESM generalization", () => {
  it("uses the new platform identity and asset paths", () => {
    expect(PLATFORM_NAME).toBe("Eugene Shop Management");
    expect(PLATFORM_SHORT_NAME).toBe("ESM");
    expect(PLATFORM_MARK_PATH).toBe("/brand/esm-mark.svg");
    expect(PLATFORM_LOGO_PATH).toBe("/brand/esm-logo.svg");
  });

  it("supports all approved general business types", () => {
    expect(BUSINESS_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      "RETAIL",
      "WHOLESALE",
      "SERVICES",
      "PRODUCTION_PRINTING",
      "RENTAL",
      "MIXED",
    ]);
    expect(businessTypeLabel("PRODUCTION_PRINTING")).toBe("Production / printing");
    expect(businessTypeLabel(undefined)).toBe("Mixed business");
  });
});
