import type { ProductionMachineProfile } from "@/lib/design-production";

export const MACHINE_OUTPUT_FORMATS = ["SVG_CUT", "HPGL", "DXF", "PRINT_RIP"] as const;
export const MACHINE_ORIGINS = ["BOTTOM_LEFT", "TOP_LEFT"] as const;

export type MachineOutputFormat = (typeof MACHINE_OUTPUT_FORMATS)[number];
export type MachineOrigin = (typeof MACHINE_ORIGINS)[number];

export type DesignMachineProfile = {
  id: string;
  name: string;
  outputFormat: MachineOutputFormat;
  bedWidthMm: number;
  bedHeightMm: number;
  unitsPerMm: number;
  baudRate: number;
  origin: MachineOrigin;
  mirrorDefault: boolean;
  isDefault: boolean;
  isActive: boolean;
};

export const DEFAULT_MACHINE_PROFILE_INPUT = {
  name: "Generic SVG cutter",
  outputFormat: "SVG_CUT" as const,
  bedWidthMm: 305,
  bedHeightMm: 508,
  unitsPerMm: 40,
  baudRate: 9600,
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

export function productionWorkflowForProfile(profile: Pick<DesignMachineProfile, "outputFormat">): ProductionMachineProfile {
  if (profile.outputFormat === "HPGL") return "HPGL / PLT cutter";
  if (profile.outputFormat === "PRINT_RIP") return "Print/RIP";
  if (profile.outputFormat === "DXF") return "VinylMaster";
  return "Generic SVG";
}
