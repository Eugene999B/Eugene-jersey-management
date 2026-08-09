import type { Prisma } from "@prisma/client";

export type ProductionMaterialSpec = {
  id: string;
  name: string;
  type: string;
  brand: string;
  colour: string;
  rollWidthMm: number;
  remainingLengthM: number;
  costPerMetre: number;
  blade: string;
  cutterForce: number;
  cutterSpeed: number;
  passes: number;
  mirrorRequired: boolean;
  pressTemperatureC: number;
  pressDurationSeconds: number;
  pressure: string;
  peelType: string;
  repressSeconds: number;
  compatibleFabrics: string[];
  warnings: string;
  isActive: boolean;
};

export type ProductionGarmentSpec = {
  id: string;
  name: string;
  garmentType: string;
  colour: string;
  fabric: string;
  sizes: string[];
  cost: number;
  sellingPrice: number;
  supplier: string;
  maxPressTemperatureC: number;
  heatRestrictions: string;
  isActive: boolean;
};

export type ProductionPlacementSpec = {
  id: string;
  name: string;
  location: string;
  garmentId: string;
  defaultWidthMm: number;
  defaultHeightMm: number;
  sizeRules: Record<string, { widthMm: number; heightMm: number }>;
  notes: string;
  isActive: boolean;
};

export type HeatPressProfile = {
  name: string;
  plateWidthMm: number;
  plateHeightMm: number;
  minimumTemperatureC: number;
  maximumTemperatureC: number;
  pressureControl: string;
  timerControl: string;
  notes: string;
};

export type ProductionLibrary = {
  version: 1;
  heatPress: HeatPressProfile;
  materials: ProductionMaterialSpec[];
  garments: ProductionGarmentSpec[];
  placements: ProductionPlacementSpec[];
};

type JsonRecord = Record<string, Prisma.JsonValue>;

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveInteger(value: unknown, fallback = 1) {
  const parsed = finiteNumber(value, fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item)).filter(Boolean))];
}

function sizeRules(value: unknown): ProductionPlacementSpec["sizeRules"] {
  const input = record(value);
  const normalized: ProductionPlacementSpec["sizeRules"] = {};
  for (const [size, dimensions] of Object.entries(input)) {
    const entry = record(dimensions);
    const widthMm = finiteNumber(entry.widthMm);
    const heightMm = finiteNumber(entry.heightMm);
    if (size.trim() && widthMm > 0 && heightMm > 0) {
      normalized[size.trim()] = { widthMm, heightMm };
    }
  }
  return normalized;
}

function material(value: unknown): ProductionMaterialSpec | null {
  const item = record(value);
  const id = text(item.id);
  const name = text(item.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    type: text(item.type, "Heat-transfer vinyl"),
    brand: text(item.brand),
    colour: text(item.colour),
    rollWidthMm: finiteNumber(item.rollWidthMm, 500),
    remainingLengthM: finiteNumber(item.remainingLengthM),
    costPerMetre: finiteNumber(item.costPerMetre),
    blade: text(item.blade),
    cutterForce: finiteNumber(item.cutterForce),
    cutterSpeed: finiteNumber(item.cutterSpeed),
    passes: positiveInteger(item.passes),
    mirrorRequired: booleanValue(item.mirrorRequired, true),
    pressTemperatureC: finiteNumber(item.pressTemperatureC, 150),
    pressDurationSeconds: finiteNumber(item.pressDurationSeconds, 12),
    pressure: text(item.pressure, "Medium"),
    peelType: text(item.peelType, "Warm"),
    repressSeconds: finiteNumber(item.repressSeconds),
    compatibleFabrics: textList(item.compatibleFabrics),
    warnings: text(item.warnings),
    isActive: booleanValue(item.isActive, true),
  };
}

function garment(value: unknown): ProductionGarmentSpec | null {
  const item = record(value);
  const id = text(item.id);
  const name = text(item.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    garmentType: text(item.garmentType, "T-shirt"),
    colour: text(item.colour),
    fabric: text(item.fabric),
    sizes: textList(item.sizes),
    cost: finiteNumber(item.cost),
    sellingPrice: finiteNumber(item.sellingPrice),
    supplier: text(item.supplier),
    maxPressTemperatureC: finiteNumber(item.maxPressTemperatureC, 170),
    heatRestrictions: text(item.heatRestrictions),
    isActive: booleanValue(item.isActive, true),
  };
}

function placement(value: unknown): ProductionPlacementSpec | null {
  const item = record(value);
  const id = text(item.id);
  const name = text(item.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    location: text(item.location, "CUSTOM"),
    garmentId: text(item.garmentId),
    defaultWidthMm: finiteNumber(item.defaultWidthMm),
    defaultHeightMm: finiteNumber(item.defaultHeightMm),
    sizeRules: sizeRules(item.sizeRules),
    notes: text(item.notes),
    isActive: booleanValue(item.isActive, true),
  };
}

function heatPress(value: unknown): HeatPressProfile {
  const item = record(value);
  return {
    name: text(item.name, "Manual heat press"),
    plateWidthMm: finiteNumber(item.plateWidthMm),
    plateHeightMm: finiteNumber(item.plateHeightMm),
    minimumTemperatureC: finiteNumber(item.minimumTemperatureC, 80),
    maximumTemperatureC: finiteNumber(item.maximumTemperatureC, 220),
    pressureControl: text(item.pressureControl, "Manual adjustment"),
    timerControl: text(item.timerControl, "Built-in timer"),
    notes: text(item.notes),
  };
}

export function readProductionLibrary(value: Prisma.JsonValue | null | undefined): ProductionLibrary {
  const root = record(value);
  const library = record(root.library);
  return {
    version: 1,
    heatPress: heatPress(library.heatPress),
    materials: Array.isArray(library.materials) ? library.materials.map(material).filter((item): item is ProductionMaterialSpec => Boolean(item)) : [],
    garments: Array.isArray(library.garments) ? library.garments.map(garment).filter((item): item is ProductionGarmentSpec => Boolean(item)) : [],
    placements: Array.isArray(library.placements) ? library.placements.map(placement).filter((item): item is ProductionPlacementSpec => Boolean(item)) : [],
  };
}

export function productionSetupRecord(value: Prisma.JsonValue | null | undefined) {
  return record(value);
}

export function productionLibraryJson(existing: Prisma.JsonValue | null | undefined, library: ProductionLibrary): Prisma.InputJsonObject {
  const root = productionSetupRecord(existing);
  return {
    ...root,
    configured: true,
    manualHeatPress: true,
    productionLibraryVersion: 1,
    library: library as unknown as Prisma.InputJsonObject,
  };
}

export function upsertProductionResource<T extends { id: string }>(items: readonly T[], next: T) {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) return [...items, next];
  return items.map((item) => item.id === next.id ? next : item);
}

export function archiveProductionResource<T extends { id: string; isActive: boolean }>(items: readonly T[], id: string, isActive: boolean) {
  return items.map((item) => item.id === id ? { ...item, isActive } : item);
}
