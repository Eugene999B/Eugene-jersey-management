import { describe, expect, it } from "vitest";
import {
  compareDetectedHardware,
  configuredMachineIdentity,
  configuredSerialFilters,
  defaultConnectionModeForOutput,
  formatUsbId,
  machineProfileCompatibilityError,
  productionRouteForProfile,
} from "@/lib/design-device-readiness";

describe("Design Studio device readiness", () => {
  it("routes each output through an honest production path", () => {
    expect(defaultConnectionModeForOutput("HPGL")).toBe("WEB_SERIAL");
    expect(defaultConnectionModeForOutput("PRINT_RIP")).toBe("SYSTEM_PRINT");
    expect(defaultConnectionModeForOutput("SVG_CUT")).toBe("VENDOR_FILE");

    expect(productionRouteForProfile({ outputFormat: "HPGL", connectionMode: "WEB_SERIAL" }).directBrowserCommunication).toBe(true);
    expect(productionRouteForProfile({ outputFormat: "PRINT_RIP", connectionMode: "SYSTEM_PRINT" }).directBrowserCommunication).toBe(false);
    expect(productionRouteForProfile({ outputFormat: "DXF", connectionMode: "VENDOR_FILE" }).description).toContain("DXF");
  });

  it("rejects unsafe or contradictory profile combinations", () => {
    expect(machineProfileCompatibilityError({
      outputFormat: "SVG_CUT",
      connectionMode: "WEB_SERIAL",
      usbVendorId: null,
      usbProductId: null,
    })).toContain("only for HPGL");
    expect(machineProfileCompatibilityError({
      outputFormat: "HPGL",
      connectionMode: "WEB_SERIAL",
      usbVendorId: null,
      usbProductId: 0x7523,
    })).toContain("requires its matching USB vendor ID");
    expect(machineProfileCompatibilityError({
      outputFormat: "HPGL",
      connectionMode: "WEB_SERIAL",
      usbVendorId: 0x1a86,
      usbProductId: 0x7523,
    })).toBeNull();
  });

  it("filters and validates browser-visible USB hardware IDs", () => {
    const profile = { usbVendorId: 0x1a86, usbProductId: 0x7523 };
    expect(configuredSerialFilters(profile)).toEqual([{ usbVendorId: 0x1a86, usbProductId: 0x7523 }]);
    expect(formatUsbId(0x1a86)).toBe("1A86");
    expect(compareDetectedHardware(profile, { usbVendorId: 0x1a86, usbProductId: 0x7523 }).matches).toBe(true);
    expect(compareDetectedHardware(profile, { usbVendorId: 0x0403, usbProductId: 0x6001 }).matches).toBe(false);
  });

  it("shows the configured manufacturer and model without pretending the browser discovered them", () => {
    expect(configuredMachineIdentity({ name: "Front cutter", manufacturer: "Graphtec", model: "CE7000" })).toBe("Graphtec CE7000");
    expect(configuredMachineIdentity({ name: "Front cutter", manufacturer: null, model: null })).toBe("Front cutter");
  });
});
