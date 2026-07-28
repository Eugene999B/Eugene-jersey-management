import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_GOVERNANCE, governanceChanges } from "@/lib/platform-governance-shared";

describe("platform governance settings", () => {
  it("keeps Ghana production defaults without provider secrets", () => {
    expect(DEFAULT_PLATFORM_GOVERNANCE.defaultCountry).toBe("Ghana");
    expect(DEFAULT_PLATFORM_GOVERNANCE.defaultCurrency).toBe("GHS");
    expect(DEFAULT_PLATFORM_GOVERNANCE.defaultTimezone).toBe("Africa/Accra");
    expect(DEFAULT_PLATFORM_GOVERNANCE).not.toHaveProperty("paystackSecretKey");
    expect(DEFAULT_PLATFORM_GOVERNANCE).not.toHaveProperty("arkeselApiKey");
  });

  it("returns only governance values that changed", () => {
    const next = { ...DEFAULT_PLATFORM_GOVERNANCE, platformName: "EJM Commerce", maintenanceMode: true, allowedUploadTypes: [...DEFAULT_PLATFORM_GOVERNANCE.allowedUploadTypes, "text/csv"] };
    expect(governanceChanges(DEFAULT_PLATFORM_GOVERNANCE, next)).toEqual({
      platformName: { previous: "Eugene Jersey Management", next: "EJM Commerce" },
      maintenanceMode: { previous: false, next: true },
      allowedUploadTypes: { previous: DEFAULT_PLATFORM_GOVERNANCE.allowedUploadTypes, next: next.allowedUploadTypes },
    });
  });
});
