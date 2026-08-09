import type { Prisma } from "@prisma/client";

export const HEAT_PRESS_QUALITY_KEYS = [
  "designCentred",
  "correctSize",
  "correctColour",
  "noLiftedEdges",
  "noScorchMarks",
  "noVinylDamage",
  "carrierRemovedCorrectly",
  "customerInstructionsSatisfied",
] as const;

export type HeatPressQualityKey = typeof HEAT_PRESS_QUALITY_KEYS[number];
export type HeatPressQualityChecklist = Record<HeatPressQualityKey, boolean>;

export const EMPTY_HEAT_PRESS_QUALITY: HeatPressQualityChecklist = {
  designCentred: false,
  correctSize: false,
  correctColour: false,
  noLiftedEdges: false,
  noScorchMarks: false,
  noVinylDamage: false,
  carrierRemovedCorrectly: false,
  customerInstructionsSatisfied: false,
};

export const HEAT_PRESS_QUALITY_LABELS: Record<HeatPressQualityKey, string> = {
  designCentred: "Design is centred and positioned correctly",
  correctSize: "Correct garment size was pressed",
  correctColour: "Correct garment and material colour were used",
  noLiftedEdges: "No lifted vinyl edges",
  noScorchMarks: "No scorch or heat marks",
  noVinylDamage: "No vinyl cracking, melting or damage",
  carrierRemovedCorrectly: "Carrier was removed using the correct peel method",
  customerInstructionsSatisfied: "Customer instructions and placement were satisfied",
};

type JsonRecord = Record<string, Prisma.JsonValue>;

export function heatPressRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export type HeatPressRecipeSnapshot = {
  materialName: string;
  materialColour: string;
  garmentName: string;
  garmentType: string;
  garmentColour: string;
  garmentFabric: string;
  garmentSize: string;
  placementName: string;
  placementLocation: string;
  pressTemperatureC: number;
  pressDurationSeconds: number;
  pressure: string;
  peelType: string;
  repressSeconds: number;
  heatRestriction: string;
  materialWarning: string;
};

export function heatPressRecipeFromBrief(input: {
  materialSnapshot: Prisma.JsonValue;
  garmentSnapshot: Prisma.JsonValue;
  placementSnapshot: Prisma.JsonValue;
  garmentSize: string;
}): HeatPressRecipeSnapshot {
  const material = heatPressRecord(input.materialSnapshot);
  const garment = heatPressRecord(input.garmentSnapshot);
  const placement = heatPressRecord(input.placementSnapshot);
  return {
    materialName: text(material.name, "Production material"),
    materialColour: text(material.colour),
    garmentName: text(garment.name, "Garment"),
    garmentType: text(garment.garmentType),
    garmentColour: text(garment.colour),
    garmentFabric: text(garment.fabric),
    garmentSize: input.garmentSize,
    placementName: text(placement.name, "Placement"),
    placementLocation: text(placement.location),
    pressTemperatureC: finite(material.pressTemperatureC),
    pressDurationSeconds: Math.max(0, finite(material.pressDurationSeconds)),
    pressure: text(material.pressure, "Confirm pressure manually"),
    peelType: text(material.peelType, "Confirm peel method"),
    repressSeconds: Math.max(0, finite(material.repressSeconds)),
    heatRestriction: text(garment.heatRestrictions),
    materialWarning: text(material.warnings),
  };
}

export function heatPressTimerElapsedMs(input: {
  timerElapsedMs: number;
  timerStartedAt: Date | string | null;
}, now = new Date()) {
  const stored = Math.max(0, Math.round(input.timerElapsedMs));
  if (!input.timerStartedAt) return stored;
  const started = input.timerStartedAt instanceof Date ? input.timerStartedAt : new Date(input.timerStartedAt);
  if (Number.isNaN(started.getTime())) return stored;
  return stored + Math.max(0, now.getTime() - started.getTime());
}

export function heatPressQualityComplete(value: unknown): value is HeatPressQualityChecklist {
  const checklist = heatPressRecord(value);
  return HEAT_PRESS_QUALITY_KEYS.every((key) => checklist[key] === true);
}

export function normalizeHeatPressQuality(value: unknown): HeatPressQualityChecklist {
  const checklist = heatPressRecord(value);
  return Object.fromEntries(HEAT_PRESS_QUALITY_KEYS.map((key) => [key, checklist[key] === true])) as HeatPressQualityChecklist;
}

export function heatPressTargetMs(mode: "FIRST_PRESS" | "REPRESS", recipe: Pick<HeatPressRecipeSnapshot, "pressDurationSeconds" | "repressSeconds">) {
  const seconds = mode === "FIRST_PRESS" ? recipe.pressDurationSeconds : recipe.repressSeconds;
  return Math.max(0, Math.round(seconds * 1000));
}

export function heatPressPhotoMimeAllowed(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType.toLowerCase());
}

export const MAX_HEAT_PRESS_EVIDENCE_BYTES = 5 * 1024 * 1024;
