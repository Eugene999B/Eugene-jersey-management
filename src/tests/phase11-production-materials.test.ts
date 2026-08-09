import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  archiveProductionResource,
  productionLibraryJson,
  readProductionLibrary,
  upsertProductionResource,
  type ProductionMaterialSpec,
} from "@/lib/production-specs";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const material: ProductionMaterialSpec = {
  id: "material-white-htv",
  name: "White standard HTV",
  type: "Heat-transfer vinyl",
  brand: "",
  colour: "White",
  rollWidthMm: 500,
  remainingLengthM: 18.5,
  costPerMetre: 12,
  blade: "45° blade",
  cutterForce: 90,
  cutterSpeed: 300,
  passes: 1,
  mirrorRequired: true,
  pressTemperatureC: 150,
  pressDurationSeconds: 12,
  pressure: "Medium",
  peelType: "Warm",
  repressSeconds: 3,
  compatibleFabrics: ["Cotton", "Poly-cotton"],
  warnings: "Test heat-sensitive garments first.",
  isActive: true,
};

describe("Phase 11 production materials, garments and heat press", () => {
  it("preserves legacy production setup while adding the structured library", () => {
    const legacy = {
      configured: true,
      cutterName: "Existing cutter",
      materials: "Legacy free-text material notes",
      garmentTypes: "Legacy garment notes",
    };
    const library = readProductionLibrary(legacy);
    library.materials = [material];
    const merged = productionLibraryJson(legacy, library) as Record<string, unknown>;

    expect(merged.cutterName).toBe("Existing cutter");
    expect(merged.materials).toBe("Legacy free-text material notes");
    expect(merged.garmentTypes).toBe("Legacy garment notes");
    expect(merged.manualHeatPress).toBe(true);
    expect(merged.productionLibraryVersion).toBe(1);
    const structured = merged.library as { materials: ProductionMaterialSpec[] };
    expect(structured.materials[0]).toMatchObject({ name: "White standard HTV", mirrorRequired: true, pressTemperatureC: 150 });
  });

  it("normalizes structured recipes without inventing electronic heat-press control", () => {
    const parsed = readProductionLibrary({
      library: {
        heatPress: { name: "Manual clamshell", plateWidthMm: 380, plateHeightMm: 380 },
        materials: [material],
        garments: [{
          id: "tee-black",
          name: "Black cotton tee",
          garmentType: "T-shirt",
          colour: "Black",
          fabric: "100% cotton",
          sizes: ["S", "M", "L"],
          cost: 25,
          sellingPrice: 45,
          supplier: "",
          maxPressTemperatureC: 170,
          heatRestrictions: "",
          isActive: true,
        }],
        placements: [{
          id: "left-chest",
          name: "Left chest",
          location: "LEFT_CHEST",
          garmentId: "tee-black",
          defaultWidthMm: 100,
          defaultHeightMm: 100,
          sizeRules: { S: { widthMm: 90, heightMm: 90 }, L: { widthMm: 110, heightMm: 110 } },
          notes: "",
          isActive: true,
        }],
      },
    });

    expect(parsed.heatPress.name).toBe("Manual clamshell");
    expect(parsed.materials[0].compatibleFabrics).toEqual(["Cotton", "Poly-cotton"]);
    expect(parsed.garments[0].sizes).toEqual(["S", "M", "L"]);
    expect(parsed.placements[0].sizeRules.L).toEqual({ widthMm: 110, heightMm: 110 });
  });

  it("updates and archives resources without deleting their stable identity", () => {
    const updated = upsertProductionResource([material], { ...material, remainingLengthM: 14.25 });
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe(material.id);
    expect(updated[0].remainingLengthM).toBe(14.25);

    const archived = archiveProductionResource(updated, material.id, false);
    expect(archived[0].id).toBe(material.id);
    expect(archived[0].isActive).toBe(false);
  });

  it("keeps production configuration tenant-authorized and audit-backed", () => {
    const actions = source("../app/dashboard/designs/materials/actions.ts");
    expect(actions).toContain("requireRole(permissions.settings)");
    expect(actions).toContain("where: { id: input.shopId }");
    expect(actions).toContain('entityType: "ProductionLibrary"');
    expect(actions).toContain("production.material.created");
    expect(actions).toContain("production.garment.created");
    expect(actions).toContain("production.placement.created");
    expect(actions).not.toContain("deleteMany");
  });

  it("exposes the production library from both Design Studio and cutter operations", () => {
    const studio = source("../app/dashboard/designs/page.tsx");
    const cutter = source("../app/dashboard/designs/production/page.tsx");
    const workspace = source("../app/dashboard/designs/materials/page.tsx");
    expect(studio).toContain('/dashboard/designs/materials');
    expect(cutter).toContain('/dashboard/designs/materials');
    expect(workspace).toContain("Materials, garments & press recipes");
    expect(workspace).toContain("Material library");
    expect(workspace).toContain("Garment library");
    expect(workspace).toContain("Placement templates");
    expect(workspace).toContain("does not claim electronic control of a manual heat press");
  });
});
