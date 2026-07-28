import type { ProductionMachineProfile } from "@/lib/design-production";

export const MACHINE_OUTPUT_FORMATS = ["SVG_CUT", "HPGL", "DXF", "PRINT_RIP"] as const;
export const MACHINE_ORIGINS = ["BOTTOM_LEFT", "TOP_LEFT"] as const;
export const MACHINE_DEVICE_TYPES = [
  "CUTTER_PLOTTER",
  "DESKTOP_PRINTER",
  "LARGE_FORMAT_PRINTER",
  "DTF_PRINTER",
  "SUBLIMATION_PRINTER",
  "UV_PRINTER",
  "OTHER",
] as const;
export const MACHINE_CONNECTION_MODES = ["SYSTEM_PRINT", "RIP_FILE", "VENDOR_FILE", "WEB_SERIAL"] as const;

export type MachineOutputFormat = (typeof MACHINE_OUTPUT_FORMATS)[number];
export type MachineOrigin = (typeof MACHINE_ORIGINS)[number];
export type MachineDeviceType = (typeof MACHINE_DEVICE_TYPES)[number];
export type MachineConnectionMode = (typeof MACHINE_CONNECTION_MODES)[number];

export type DesignMachineProfile = {
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  deviceType?: MachineDeviceType;
  connectionMode?: MachineConnectionMode;
  outputFormat: MachineOutputFormat;
  bedWidthMm: number;
  bedHeightMm: number;
  unitsPerMm: number;
  baudRate: number;
  usbVendorId?: number | null;
  usbProductId?: number | null;
  origin: MachineOrigin;
  mirrorDefault: boolean;
  isDefault: boolean;
  isActive: boolean;
};

export const DEFAULT_MACHINE_PROFILE_INPUT = {
  name: "Generic SVG cutter",
  manufacturer: null,
  model: null,
  deviceType: "CUTTER_PLOTTER" as const,
  connectionMode: "VENDOR_FILE" as const,
  outputFormat: "SVG_CUT" as const,
  bedWidthMm: 305,
  bedHeightMm: 508,
  unitsPerMm: 40,
  baudRate: 9600,
  usbVendorId: null,
  usbProductId: null,
  origin: "BOTTOM_LEFT" as const,
  mirrorDefault: true,
  isDefault: true,
  isActive: true,
};

export function normalizeMachineOutputFormat(value: unknown): MachineOutputFormat {
  return typeof value === "string" && MACHINE_OUTPUT_FORMATS.includes(value as MachineOutputFormat)
    ? value as MachineOutputFormat
    : "SVG_CUT";
}

export function normalizeMachineOrigin(value: unknown): MachineOrigin {
  return typeof value === "string" && MACHINE_ORIGINS.includes(value as MachineOrigin)
    ? value as MachineOrigin
    : "BOTTOM_LEFT";
}

export function normalizeMachineDeviceType(value: unknown): MachineDeviceType {
  return typeof value === "string" && MACHINE_DEVICE_TYPES.includes(value as MachineDeviceType)
    ? value as MachineDeviceType
    : "CUTTER_PLOTTER";
}

export function normalizeMachineConnectionMode(value: unknown, outputFormat?: MachineOutputFormat): MachineConnectionMode {
  if (typeof value === "string" && MACHINE_CONNECTION_MODES.includes(value as MachineConnectionMode)) {
    return value as MachineConnectionMode;
  }
  if (outputFormat === "HPGL") return "WEB_SERIAL";
  if (outputFormat === "PRINT_RIP") return "SYSTEM_PRINT";
  return "VENDOR_FILE";
}

export function productionWorkflowForProfile(profile: Pick<DesignMachineProfile, "outputFormat">): ProductionMachineProfile {
  if (profile.outputFormat === "HPGL") return "HPGL / PLT cutter";
  if (profile.outputFormat === "PRINT_RIP") return "Print/RIP";
  if (profile.outputFormat === "DXF") return "VinylMaster";
  return "Generic SVG";
}
