import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  designArtworkBounds,
  designCutSheetSize,
  placementDimensions,
  productionSelectionFingerprint,
  reviewDesignProduction,
} from "@/lib/design-production-brief";
import type { ProductionGarmentSpec, ProductionMaterialSpec, ProductionPlacementSpec } from "@/lib/production-specs";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const garment: ProductionGarmentSpec = {
  id: "garment-1",
  name: "Black cotton tee",
  garmentType: "T-shirt",
  colour: "Black",
  fabric: "100% cotton",
  sizes: ["S", "M", "L"],
  cost: 25,
  sellingPrice: 45,
  supplier: "",
  maxPressTemperatureC: 160,
  heatRestrictions: "",
  isActive: true,
};

const placement: ProductionPlacementSpec = {
  id: "placement-1",
  name: "Left chest",
  location: "LEFT_CHEST",
  garmentId: "garment-1",
  defaultWidthMm: 100,
  defaultHeightMm: 100,
  sizeRules: { M: { widthMm: 110, heightMm: 105 } },
  notes: "",
  isActive: true,
};

const material: ProductionMaterialSpec = {
  id: "material-1",
  name: "White HTV",
  type: "Heat-transfer vinyl",
  brand: "",
  colour: "White",
  rollWidthMm: 500,
  remainingLengthM: 20,
  costPerMetre: 12,
  blade: "45 degree blade",
  cutterForce: 90,
  cutterSpeed: 300,
  passes: 1,
  mirrorRequired: true,
  pressTemperatureC: 170,
  pressDurationSeconds: 12,
  pressure: "Medium",
  peelType: "Warm",
  repressSeconds: 3,
  compatibleFabrics: ["Cotton"],
  warnings: "",
  isActive: true,
};

const canvas = {
  sheet: "custom",
  customWidth: 300,
  customHeight: 500,
  layers: [
    { id: "a", kind: "rectangle", visible: true, x: 100, y: 100, width: 60, height: 40, rotation: 0 },
    { id: "b", kind: "circle", visible: true, x: 145, y: 100, width: 20, height: 20, rotation: 0 },
  ],
};

describe("Phase 12 guided production", () => {
  it("derives real cut sheet and artwork bounds from saved artwork", () => {
    expect(designCutSheetSize(canvas)).toEqual({ width: 300, height: 500 });
    expect(designArtworkBounds(canvas)).toEqual({ width: 85, height: 40, count: 2 });
  });

  it("uses exact garment-size placement rules before defaults", () => {
    expect(placementDimensions(placement, "M")).toEqual({ width: 110, height: 105, source: "size" });
    expect(placementDimensions(placement, "S")).toEqual({ width: 100, height: 100, source: "default" });
  });

  it("approves dimensions independently from heat-process warnings", () => {
    const review = reviewDesignProduction({ canvas, garment, garmentSize: "M", placement, material });
    expect(review.errors).toEqual([]);
    expect(review.warnings.join(" ")).toContain("above this garment's 160 °C heat limit");
    expect(review.measurements).toMatchObject({
      cutSheetWidthMm: 300,
      artworkWidthMm: 85,
      artworkHeightMm: 40,
      placementWidthMm: 110,
      placementHeightMm: 105,
      materialWidthMm: 500,
      mirror: true,
    });
  });

  it("blocks wrong size, oversized artwork and material-width mismatch", () => {
    const review = reviewDesignProduction({
      canvas: { ...canvas, customWidth: 610, layers: [{ id: "x", visible: true, x: 100, y: 100, width: 150, height: 130, rotation: 0 }] },
      garment,
      garmentSize: "XL",
      placement,
      material,
    });
    expect(review.errors.join(" ")).toContain("XL is not available");
    expect(review.errors.join(" ")).toContain("wider than the 500.0 mm material roll");
    expect(review.errors.join(" ")).toContain("allows 100.0 × 100.0 mm");
  });

  it("fingerprints the exact physical selection", () => {
    expect(productionSelectionFingerprint({ designJobId: "d", garmentId: "g", garmentSize: "M", placementId: "p", materialId: "m" })).toBe("d:g:M:p:m");
  });

  it("adds production briefs additively without rewriting existing designs", () => {
    const migration = source("../../prisma/migrations/20260809090000_phase12_guided_design_production_brief/migration.sql");
    expect(migration).toContain('CREATE TABLE "DesignProductionBrief"');
    expect(migration).toContain('FOREIGN KEY ("designJobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE');
    expect(migration).not.toContain('ALTER TABLE "DesignJob" ADD COLUMN');
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("DELETE FROM");
  });

  it("keeps production review tenant-scoped, origin-checked and audit-backed", () => {
    const route = source("../app/api/design-production-briefs/route.ts");
    expect(route).toContain("requireRole(permissions.designs)");
    expect(route).toContain("isTrustedApplicationOrigin(request)");
    expect(route).toContain("where: { id: parsed.data.designJobId, shopId }");
    expect(route).toContain("where: { shopId_designJobId: { shopId, designJobId: design.id } }");
    expect(route).toContain("garmentSnapshot");
    expect(route).toContain("placementSnapshot");
    expect(route).toContain("materialSnapshot");
    expect(route).toContain('"design.production.reviewed"');
  });

  it("requires explicit choices and hands reviewed jobs to the existing cutter queue", () => {
    const workflow = source("../components/design/guided-production-workflow.tsx");
    const cutterPage = source("../app/dashboard/designs/production/page.tsx");
    expect(workflow).toContain("Exact size");
    expect(workflow).toContain("Print placement");
    expect(workflow).toContain("Production material");
    expect(workflow).toContain("Approve production review");
    expect(workflow).toContain("Continue to cutter");
    expect(workflow).toContain("/dashboard/designs/production?design=");
    expect(cutterPage).toContain("Reviewed guided-production job selected");
    expect(cutterPage).toContain("CutterOperationsConsole");
  });
});
