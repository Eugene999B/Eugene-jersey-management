import type {
  ProductionGarmentSpec,
  ProductionMaterialSpec,
  ProductionPlacementSpec,
} from "@/lib/production-specs";

export type DesignProductionCanvas = Record<string, unknown>;

export type DesignProductionSelection = {
  designJobId: string;
  garmentId: string;
  garmentSize: string;
  placementId: string;
  materialId: string;
};

export type DesignProductionMeasurements = {
  cutSheetWidthMm: number;
  cutSheetHeightMm: number;
  artworkWidthMm: number;
  artworkHeightMm: number;
  placementWidthMm: number;
  placementHeightMm: number;
  materialWidthMm: number;
  mirror: boolean;
};

export type DesignProductionReview = {
  measurements: DesignProductionMeasurements;
  errors: string[];
  warnings: string[];
  checks: Array<{ key: string; label: string; passed: boolean }>;
};

const sheetPresets: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  "12x20": { width: 305, height: 508 },
  "15x20": { width: 381, height: 508 },
};

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function visibleLayers(canvas: DesignProductionCanvas) {
  return Array.isArray(canvas.layers)
    ? canvas.layers.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value) && value.visible !== false)
    : [];
}

export function designCutSheetSize(canvas: DesignProductionCanvas) {
  const preset = text(canvas.sheet, "a3");
  if (preset === "custom") {
    return {
      width: Math.max(1, numberValue(canvas.customWidth, 300)),
      height: Math.max(1, numberValue(canvas.customHeight, 500)),
    };
  }
  return sheetPresets[preset] ?? sheetPresets.a3;
}

export function designArtworkBounds(canvas: DesignProductionCanvas) {
  const layers = visibleLayers(canvas);
  if (!layers.length) return { width: 0, height: 0, count: 0 };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const layer of layers) {
    const width = Math.max(0, numberValue(layer.width));
    const height = Math.max(0, numberValue(layer.height));
    const radians = numberValue(layer.rotation) * Math.PI / 180;
    const rotatedWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
    const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
    const x = numberValue(layer.x);
    const y = numberValue(layer.y);
    minX = Math.min(minX, x - rotatedWidth / 2);
    maxX = Math.max(maxX, x + rotatedWidth / 2);
    minY = Math.min(minY, y - rotatedHeight / 2);
    maxY = Math.max(maxY, y + rotatedHeight / 2);
  }

  return {
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    count: layers.length,
  };
}

export function placementDimensions(placement: ProductionPlacementSpec, garmentSize: string) {
  const rule = placement.sizeRules[garmentSize];
  return rule
    ? { width: rule.widthMm, height: rule.heightMm, source: "size" as const }
    : { width: placement.defaultWidthMm, height: placement.defaultHeightMm, source: "default" as const };
}

export function reviewDesignProduction(input: {
  canvas: DesignProductionCanvas;
  garment: ProductionGarmentSpec;
  garmentSize: string;
  placement: ProductionPlacementSpec;
  material: ProductionMaterialSpec;
}): DesignProductionReview {
  const cutSheet = designCutSheetSize(input.canvas);
  const artwork = designArtworkBounds(input.canvas);
  const placement = placementDimensions(input.placement, input.garmentSize);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.garment.sizes.includes(input.garmentSize)) {
    errors.push(`${input.garmentSize || "The selected size"} is not available for ${input.garment.name}.`);
  }
  if (input.placement.garmentId && input.placement.garmentId !== input.garment.id) {
    errors.push(`${input.placement.name} is not configured for ${input.garment.name}.`);
  }
  if (!artwork.count) errors.push("The saved design has no visible artwork to produce.");
  if (cutSheet.width > input.material.rollWidthMm + 0.01) {
    errors.push(`The ${cutSheet.width.toFixed(1)} mm cut sheet is wider than the ${input.material.rollWidthMm.toFixed(1)} mm material roll.`);
  }
  if (artwork.width > placement.width + 0.01 || artwork.height > placement.height + 0.01) {
    errors.push(`The artwork is ${artwork.width.toFixed(1)} × ${artwork.height.toFixed(1)} mm but ${input.placement.name} allows ${placement.width.toFixed(1)} × ${placement.height.toFixed(1)} mm for ${input.garmentSize}.`);
  }
  if (input.material.pressTemperatureC > input.garment.maxPressTemperatureC) {
    warnings.push(`${input.material.name} defaults to ${input.material.pressTemperatureC} °C, above this garment's ${input.garment.maxPressTemperatureC} °C heat limit. Test and approve a safer process before pressing.`);
  }
  if (!input.material.blade || input.material.cutterForce <= 0 || input.material.cutterSpeed <= 0) {
    warnings.push("The material recipe is missing a complete blade, force or speed reference. Confirm the cutter-panel settings before the test cut.");
  }
  if (placement.source === "default") {
    warnings.push(`No ${input.garmentSize}-specific placement rule is saved; the ${input.placement.name} default dimensions are being used.`);
  }

  const measurements: DesignProductionMeasurements = {
    cutSheetWidthMm: cutSheet.width,
    cutSheetHeightMm: cutSheet.height,
    artworkWidthMm: artwork.width,
    artworkHeightMm: artwork.height,
    placementWidthMm: placement.width,
    placementHeightMm: placement.height,
    materialWidthMm: input.material.rollWidthMm,
    mirror: input.material.mirrorRequired,
  };

  return {
    measurements,
    errors,
    warnings,
    checks: [
      { key: "garment", label: `Garment: ${input.garment.name}`, passed: Boolean(input.garment.id) },
      { key: "size", label: `Exact size: ${input.garmentSize}`, passed: input.garment.sizes.includes(input.garmentSize) },
      { key: "placement", label: `Placement: ${input.placement.name}`, passed: !input.placement.garmentId || input.placement.garmentId === input.garment.id },
      { key: "material", label: `Material: ${input.material.name}`, passed: input.material.isActive },
      { key: "artwork", label: `Artwork: ${artwork.width.toFixed(1)} × ${artwork.height.toFixed(1)} mm`, passed: artwork.count > 0 && artwork.width <= placement.width + 0.01 && artwork.height <= placement.height + 0.01 },
      { key: "roll", label: `Cut sheet: ${cutSheet.width.toFixed(1)} × ${cutSheet.height.toFixed(1)} mm on ${input.material.rollWidthMm.toFixed(1)} mm roll`, passed: cutSheet.width <= input.material.rollWidthMm + 0.01 },
      { key: "mirror", label: input.material.mirrorRequired ? "Mirroring required for this material" : "Mirroring not required for this material", passed: true },
    ],
  };
}

export function productionSelectionFingerprint(selection: DesignProductionSelection) {
  return [selection.designJobId, selection.garmentId, selection.garmentSize, selection.placementId, selection.materialId].join(":");
}
