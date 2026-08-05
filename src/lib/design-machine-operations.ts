import type { DesignMachineProfile } from "@/lib/design-machine-profile";

export const MACHINE_JOB_STATUSES = ["PREPARED", "SENDING", "SENT", "FAILED", "CANCELLED"] as const;
export type MachineJobStatus = (typeof MACHINE_JOB_STATUSES)[number];

export const CUTTER_CHECKLIST_ITEMS = [
  { key: "materialLoaded", label: "Material is loaded straight and covers the full production width." },
  { key: "pinchRollersLocked", label: "Pinch rollers are locked on the grit rollers, not outside them." },
  { key: "bladeChecked", label: "Blade depth, holder and pressure match this material." },
  { key: "originSet", label: "The cutter origin is set at the intended lower-left or upper-left start point." },
  { key: "areaClear", label: "The carriage path, roll feed and floor area are clear." },
  { key: "testCutPassed", label: "A small machine-panel test cut was weeded and passed before production." },
] as const;

export type CutterChecklistKey = (typeof CUTTER_CHECKLIST_ITEMS)[number]["key"];
export type CutterChecklist = Record<CutterChecklistKey, boolean>;

export const EMPTY_CUTTER_CHECKLIST: CutterChecklist = {
  materialLoaded: false,
  pinchRollersLocked: false,
  bladeChecked: false,
  originSet: false,
  areaClear: false,
  testCutPassed: false,
};

export function cutterChecklistComplete(checklist: CutterChecklist) {
  return CUTTER_CHECKLIST_ITEMS.every((item) => checklist[item.key]);
}

export function machineProductionAreaError(input: {
  profile: Pick<DesignMachineProfile, "bedWidthMm" | "bedHeightMm">;
  materialWidthMm: number;
  sheet: { width: number; height: number };
}) {
  if (!Number.isFinite(input.materialWidthMm) || input.materialWidthMm < 20 || input.materialWidthMm > 2_000) {
    return "Enter the actual loaded material width between 20 mm and 2,000 mm.";
  }
  if (input.materialWidthMm + 0.01 < input.sheet.width) {
    return "The loaded material is narrower than the saved production area.";
  }
  if (input.sheet.width > input.profile.bedWidthMm + 0.01 || input.sheet.height > input.profile.bedHeightMm + 0.01) {
    return "The saved production area exceeds the selected cutter profile.";
  }
  return null;
}

export function directCutterIdentity(profile: Pick<DesignMachineProfile, "name" | "manufacturer" | "model">) {
  return [profile.manufacturer?.trim(), profile.model?.trim()].filter(Boolean).join(" ") || profile.name;
}
