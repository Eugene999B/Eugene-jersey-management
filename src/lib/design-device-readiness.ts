import type { DesignMachineProfile, MachineConnectionMode, MachineDeviceType, MachineOutputFormat } from "@/lib/design-machine-profile";

export const MACHINE_DEVICE_TYPE_LABELS: Record<MachineDeviceType, string> = {
  CUTTER_PLOTTER: "Cutter / plotter",
  DESKTOP_PRINTER: "Desktop printer",
  LARGE_FORMAT_PRINTER: "Large-format printer",
  DTF_PRINTER: "DTF printer",
  SUBLIMATION_PRINTER: "Sublimation printer",
  UV_PRINTER: "UV printer",
  OTHER: "Other production device",
};

export const MACHINE_CONNECTION_MODE_LABELS: Record<MachineConnectionMode, string> = {
  SYSTEM_PRINT: "Operating-system print dialog",
  RIP_FILE: "RIP software / full-colour file",
  VENDOR_FILE: "Vendor software / exported file",
  WEB_SERIAL: "Direct browser serial connection",
};

export type ProductionRoute = {
  title: string;
  description: string;
  directBrowserCommunication: boolean;
  browserCanIdentifyHardware: boolean;
};

export function defaultConnectionModeForOutput(outputFormat: MachineOutputFormat): MachineConnectionMode {
  if (outputFormat === "HPGL") return "WEB_SERIAL";
  if (outputFormat === "PRINT_RIP") return "SYSTEM_PRINT";
  return "VENDOR_FILE";
}

export function productionRouteForProfile(profile: Pick<DesignMachineProfile, "outputFormat" | "connectionMode">): ProductionRoute {
  const connectionMode = profile.connectionMode ?? defaultConnectionModeForOutput(profile.outputFormat);
  if (connectionMode === "WEB_SERIAL") {
    return {
      title: "Direct serial HPGL/PLT",
      description: "Chrome or Edge opens a user-approved serial port and sends validated HPGL vector paths directly to a compatible cutter.",
      directBrowserCommunication: true,
      browserCanIdentifyHardware: true,
    };
  }
  if (connectionMode === "SYSTEM_PRINT") {
    return {
      title: "Installed printer through the operating system",
      description: "The studio opens the normal print dialog. The computer driver controls the selected printer, paper, colour and quality settings.",
      directBrowserCommunication: false,
      browserCanIdentifyHardware: false,
    };
  }
  if (connectionMode === "RIP_FILE") {
    return {
      title: "RIP-managed production",
      description: "Export the full-colour SVG, then open it in the printer manufacturer's RIP software for ink, media and colour-profile control.",
      directBrowserCommunication: false,
      browserCanIdentifyHardware: false,
    };
  }
  return {
    title: "Vendor-software file workflow",
    description: profile.outputFormat === "DXF"
      ? "Export DXF and open it in the cutter or CAD software supplied for the machine."
      : profile.outputFormat === "HPGL"
        ? "Export the PLT file and open or spool it through the machine's normal vendor software."
        : "Export the cut-path SVG and open it in the cutter software supplied for the machine.",
    directBrowserCommunication: false,
    browserCanIdentifyHardware: false,
  };
}

export function machineProfileCompatibilityError(profile: Pick<DesignMachineProfile, "outputFormat" | "connectionMode" | "usbVendorId" | "usbProductId">) {
  const connectionMode = profile.connectionMode ?? defaultConnectionModeForOutput(profile.outputFormat);
  if (connectionMode === "WEB_SERIAL" && profile.outputFormat !== "HPGL") {
    return "Direct browser serial communication is available only for HPGL / PLT profiles.";
  }
  if (profile.usbProductId != null && profile.usbVendorId == null) {
    return "A USB product ID requires its matching USB vendor ID.";
  }
  return null;
}

export function formatUsbId(value: number | null | undefined) {
  return value == null ? null : value.toString(16).toUpperCase().padStart(4, "0");
}

export function configuredSerialFilters(profile: Pick<DesignMachineProfile, "usbVendorId" | "usbProductId">) {
  if (profile.usbVendorId == null) return [];
  return [{
    usbVendorId: profile.usbVendorId,
    ...(profile.usbProductId == null ? {} : { usbProductId: profile.usbProductId }),
  }];
}

export function compareDetectedHardware(
  profile: Pick<DesignMachineProfile, "usbVendorId" | "usbProductId">,
  detected: { usbVendorId?: number; usbProductId?: number } | null | undefined,
) {
  if (profile.usbVendorId == null) {
    return { matches: true, configured: false, message: "No USB hardware IDs are locked to this profile." };
  }
  if (!detected?.usbVendorId) {
    return { matches: false, configured: true, message: "The browser did not expose a USB vendor ID for the selected port." };
  }
  if (detected.usbVendorId !== profile.usbVendorId) {
    return {
      matches: false,
      configured: true,
      message: `Expected USB vendor ${formatUsbId(profile.usbVendorId)}, detected ${formatUsbId(detected.usbVendorId)}.`,
    };
  }
  if (profile.usbProductId != null && detected.usbProductId !== profile.usbProductId) {
    return {
      matches: false,
      configured: true,
      message: `Expected USB product ${formatUsbId(profile.usbProductId)}, detected ${formatUsbId(detected.usbProductId)}.`,
    };
  }
  return { matches: true, configured: true, message: "Detected USB hardware matches this machine profile." };
}

export function configuredMachineIdentity(profile: Pick<DesignMachineProfile, "name" | "manufacturer" | "model">) {
  const identity = [profile.manufacturer?.trim(), profile.model?.trim()].filter(Boolean).join(" ");
  return identity || profile.name;
}
