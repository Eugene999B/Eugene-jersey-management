"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  archiveProductionResource,
  productionLibraryJson,
  readProductionLibrary,
  upsertProductionResource,
  type ProductionGarmentSpec,
  type ProductionMaterialSpec,
  type ProductionPlacementSpec,
} from "@/lib/production-specs";
import { permissions } from "@/lib/rbac";

const optionalText = (max: number) => z.preprocess(
  (value) => String(value ?? "").trim(),
  z.string().max(max),
);
const positive = z.coerce.number().finite().gt(0);
const nonNegative = z.coerce.number().finite().min(0);

async function settingsContext() {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  return { session, shopId: session.shopId };
}

async function loadLibrary(shopId: string) {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId },
    select: { productionSetup: true },
  });
  if (!shop) redirect("/dashboard?error=missing-shop");
  return { setup: shop.productionSetup, library: readProductionLibrary(shop.productionSetup) };
}

async function saveLibrary(input: {
  shopId: string;
  userId: string;
  setup: Parameters<typeof productionLibraryJson>[0];
  library: ReturnType<typeof readProductionLibrary>;
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.shop.update({
    where: { id: input.shopId },
    data: { productionSetup: productionLibraryJson(input.setup, input.library) },
  });
  await audit({
    shopId: input.shopId,
    userId: input.userId,
    action: input.action,
    entityType: "ProductionLibrary",
    entityId: input.entityId ?? input.shopId,
    metadata: input.metadata ?? {},
  });
  revalidatePath("/dashboard/designs");
  revalidatePath("/dashboard/designs/materials");
  revalidatePath("/dashboard/designs/production");
}

function csv(value: string) {
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))].slice(0, 40);
}

const heatPressSchema = z.object({
  name: z.string().trim().min(2).max(120),
  plateWidthMm: positive.max(2_000),
  plateHeightMm: positive.max(2_000),
  minimumTemperatureC: z.coerce.number().int().min(0).max(400),
  maximumTemperatureC: z.coerce.number().int().min(1).max(400),
  pressureControl: z.string().trim().min(2).max(120),
  timerControl: z.string().trim().min(2).max(120),
  notes: optionalText(1_500),
}).refine((value) => value.maximumTemperatureC >= value.minimumTemperatureC);

export async function saveHeatPressProfileAction(formData: FormData) {
  const { session, shopId } = await settingsContext();
  const parsed = heatPressSchema.safeParse({
    name: formData.get("name"),
    plateWidthMm: formData.get("plateWidthMm"),
    plateHeightMm: formData.get("plateHeightMm"),
    minimumTemperatureC: formData.get("minimumTemperatureC"),
    maximumTemperatureC: formData.get("maximumTemperatureC"),
    pressureControl: formData.get("pressureControl"),
    timerControl: formData.get("timerControl"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirect("/dashboard/designs/materials?error=heat-press");

  const current = await loadLibrary(shopId);
  current.library.heatPress = parsed.data;
  await saveLibrary({
    shopId,
    userId: session.id,
    setup: current.setup,
    library: current.library,
    action: "production.heat-press.updated",
    metadata: {
      name: parsed.data.name,
      plateWidthMm: parsed.data.plateWidthMm,
      plateHeightMm: parsed.data.plateHeightMm,
    },
  });
  redirect("/dashboard/designs/materials?saved=heat-press");
}

const materialSchema = z.object({
  id: optionalText(80),
  name: z.string().trim().min(2).max(120),
  type: z.string().trim().min(2).max(100),
  brand: optionalText(100),
  colour: optionalText(80),
  rollWidthMm: positive.max(2_000),
  remainingLengthM: nonNegative.max(100_000),
  costPerMetre: nonNegative.max(1_000_000),
  blade: optionalText(120),
  cutterForce: nonNegative.max(100_000),
  cutterSpeed: nonNegative.max(100_000),
  passes: z.coerce.number().int().min(1).max(20),
  pressTemperatureC: z.coerce.number().int().min(0).max(400),
  pressDurationSeconds: nonNegative.max(3_600),
  pressure: z.string().trim().min(2).max(80),
  peelType: z.string().trim().min(2).max(80),
  repressSeconds: nonNegative.max(3_600),
  compatibleFabrics: optionalText(1_000),
  warnings: optionalText(2_000),
});

export async function saveProductionMaterialAction(formData: FormData) {
  const { session, shopId } = await settingsContext();
  const parsed = materialSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    type: formData.get("type"),
    brand: formData.get("brand"),
    colour: formData.get("colour"),
    rollWidthMm: formData.get("rollWidthMm"),
    remainingLengthM: formData.get("remainingLengthM"),
    costPerMetre: formData.get("costPerMetre"),
    blade: formData.get("blade"),
    cutterForce: formData.get("cutterForce"),
    cutterSpeed: formData.get("cutterSpeed"),
    passes: formData.get("passes"),
    pressTemperatureC: formData.get("pressTemperatureC"),
    pressDurationSeconds: formData.get("pressDurationSeconds"),
    pressure: formData.get("pressure"),
    peelType: formData.get("peelType"),
    repressSeconds: formData.get("repressSeconds"),
    compatibleFabrics: formData.get("compatibleFabrics"),
    warnings: formData.get("warnings"),
  });
  if (!parsed.success) redirect("/dashboard/designs/materials?error=material");

  const current = await loadLibrary(shopId);
  const existing = current.library.materials.find((item) => item.id === parsed.data.id);
  const id = existing?.id || parsed.data.id || randomUUID();
  const item: ProductionMaterialSpec = {
    id,
    name: parsed.data.name,
    type: parsed.data.type,
    brand: parsed.data.brand,
    colour: parsed.data.colour,
    rollWidthMm: parsed.data.rollWidthMm,
    remainingLengthM: parsed.data.remainingLengthM,
    costPerMetre: parsed.data.costPerMetre,
    blade: parsed.data.blade,
    cutterForce: parsed.data.cutterForce,
    cutterSpeed: parsed.data.cutterSpeed,
    passes: parsed.data.passes,
    mirrorRequired: formData.get("mirrorRequired") === "on",
    pressTemperatureC: parsed.data.pressTemperatureC,
    pressDurationSeconds: parsed.data.pressDurationSeconds,
    pressure: parsed.data.pressure,
    peelType: parsed.data.peelType,
    repressSeconds: parsed.data.repressSeconds,
    compatibleFabrics: csv(parsed.data.compatibleFabrics),
    warnings: parsed.data.warnings,
    isActive: existing?.isActive ?? true,
  };
  if (current.library.materials.some((candidate) => candidate.id !== id && candidate.name.toLowerCase() === item.name.toLowerCase())) {
    redirect("/dashboard/designs/materials?error=duplicate-material");
  }
  current.library.materials = upsertProductionResource(current.library.materials, item);
  await saveLibrary({
    shopId,
    userId: session.id,
    setup: current.setup,
    library: current.library,
    action: existing ? "production.material.updated" : "production.material.created",
    entityId: id,
    metadata: { name: item.name, type: item.type, colour: item.colour, rollWidthMm: item.rollWidthMm },
  });
  redirect("/dashboard/designs/materials?saved=material");
}

const garmentSchema = z.object({
  id: optionalText(80),
  name: z.string().trim().min(2).max(120),
  garmentType: z.string().trim().min(2).max(100),
  colour: optionalText(80),
  fabric: z.string().trim().min(2).max(120),
  sizes: z.string().trim().min(1).max(1_000),
  cost: nonNegative.max(1_000_000),
  sellingPrice: nonNegative.max(1_000_000),
  supplier: optionalText(160),
  maxPressTemperatureC: z.coerce.number().int().min(0).max(400),
  heatRestrictions: optionalText(2_000),
});

export async function saveProductionGarmentAction(formData: FormData) {
  const { session, shopId } = await settingsContext();
  const parsed = garmentSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    garmentType: formData.get("garmentType"),
    colour: formData.get("colour"),
    fabric: formData.get("fabric"),
    sizes: formData.get("sizes"),
    cost: formData.get("cost"),
    sellingPrice: formData.get("sellingPrice"),
    supplier: formData.get("supplier"),
    maxPressTemperatureC: formData.get("maxPressTemperatureC"),
    heatRestrictions: formData.get("heatRestrictions"),
  });
  if (!parsed.success) redirect("/dashboard/designs/materials?error=garment");

  const current = await loadLibrary(shopId);
  const existing = current.library.garments.find((item) => item.id === parsed.data.id);
  const id = existing?.id || parsed.data.id || randomUUID();
  const sizes = csv(parsed.data.sizes);
  if (!sizes.length) redirect("/dashboard/designs/materials?error=garment-sizes");
  const item: ProductionGarmentSpec = {
    id,
    name: parsed.data.name,
    garmentType: parsed.data.garmentType,
    colour: parsed.data.colour,
    fabric: parsed.data.fabric,
    sizes,
    cost: parsed.data.cost,
    sellingPrice: parsed.data.sellingPrice,
    supplier: parsed.data.supplier,
    maxPressTemperatureC: parsed.data.maxPressTemperatureC,
    heatRestrictions: parsed.data.heatRestrictions,
    isActive: existing?.isActive ?? true,
  };
  if (current.library.garments.some((candidate) => candidate.id !== id && candidate.name.toLowerCase() === item.name.toLowerCase())) {
    redirect("/dashboard/designs/materials?error=duplicate-garment");
  }
  current.library.garments = upsertProductionResource(current.library.garments, item);
  await saveLibrary({
    shopId,
    userId: session.id,
    setup: current.setup,
    library: current.library,
    action: existing ? "production.garment.updated" : "production.garment.created",
    entityId: id,
    metadata: { name: item.name, garmentType: item.garmentType, fabric: item.fabric, sizes: item.sizes },
  });
  redirect("/dashboard/designs/materials?saved=garment");
}

const placementSchema = z.object({
  id: optionalText(80),
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(100),
  garmentId: optionalText(80),
  defaultWidthMm: positive.max(2_000),
  defaultHeightMm: positive.max(2_000),
  sizeRules: optionalText(4_000),
  notes: optionalText(2_000),
});

function parseSizeRules(value: string) {
  const rules: ProductionPlacementSpec["sizeRules"] = {};
  for (const rawLine of value.split(/[\n,]+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^([^:]+):\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)$/i.exec(line);
    if (!match) return null;
    rules[match[1].trim()] = { widthMm: Number(match[2]), heightMm: Number(match[3]) };
  }
  return rules;
}

export async function saveProductionPlacementAction(formData: FormData) {
  const { session, shopId } = await settingsContext();
  const parsed = placementSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    location: formData.get("location"),
    garmentId: formData.get("garmentId"),
    defaultWidthMm: formData.get("defaultWidthMm"),
    defaultHeightMm: formData.get("defaultHeightMm"),
    sizeRules: formData.get("sizeRules"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirect("/dashboard/designs/materials?error=placement");
  const sizeRules = parseSizeRules(parsed.data.sizeRules);
  if (!sizeRules) redirect("/dashboard/designs/materials?error=size-rules");

  const current = await loadLibrary(shopId);
  if (parsed.data.garmentId && !current.library.garments.some((garment) => garment.id === parsed.data.garmentId)) {
    redirect("/dashboard/designs/materials?error=placement-garment");
  }
  const existing = current.library.placements.find((item) => item.id === parsed.data.id);
  const id = existing?.id || parsed.data.id || randomUUID();
  const item: ProductionPlacementSpec = {
    id,
    name: parsed.data.name,
    location: parsed.data.location,
    garmentId: parsed.data.garmentId,
    defaultWidthMm: parsed.data.defaultWidthMm,
    defaultHeightMm: parsed.data.defaultHeightMm,
    sizeRules,
    notes: parsed.data.notes,
    isActive: existing?.isActive ?? true,
  };
  if (current.library.placements.some((candidate) => candidate.id !== id && candidate.name.toLowerCase() === item.name.toLowerCase())) {
    redirect("/dashboard/designs/materials?error=duplicate-placement");
  }
  current.library.placements = upsertProductionResource(current.library.placements, item);
  await saveLibrary({
    shopId,
    userId: session.id,
    setup: current.setup,
    library: current.library,
    action: existing ? "production.placement.updated" : "production.placement.created",
    entityId: id,
    metadata: { name: item.name, location: item.location, garmentId: item.garmentId || null },
  });
  redirect("/dashboard/designs/materials?saved=placement");
}

const activeSchema = z.object({
  resource: z.enum(["material", "garment", "placement"]),
  id: z.string().min(1).max(100),
  nextActive: z.enum(["true", "false"]),
});

export async function setProductionResourceActiveAction(formData: FormData) {
  const { session, shopId } = await settingsContext();
  const parsed = activeSchema.safeParse({
    resource: formData.get("resource"),
    id: formData.get("id"),
    nextActive: formData.get("nextActive"),
  });
  if (!parsed.success) redirect("/dashboard/designs/materials?error=resource");

  const current = await loadLibrary(shopId);
  const active = parsed.data.nextActive === "true";
  let found = false;
  if (parsed.data.resource === "material") {
    found = current.library.materials.some((item) => item.id === parsed.data.id);
    current.library.materials = archiveProductionResource(current.library.materials, parsed.data.id, active);
  } else if (parsed.data.resource === "garment") {
    found = current.library.garments.some((item) => item.id === parsed.data.id);
    current.library.garments = archiveProductionResource(current.library.garments, parsed.data.id, active);
  } else {
    found = current.library.placements.some((item) => item.id === parsed.data.id);
    current.library.placements = archiveProductionResource(current.library.placements, parsed.data.id, active);
  }
  if (!found) redirect("/dashboard/designs/materials?error=missing-resource");

  await saveLibrary({
    shopId,
    userId: session.id,
    setup: current.setup,
    library: current.library,
    action: `production.${parsed.data.resource}.${active ? "reactivated" : "archived"}`,
    entityId: parsed.data.id,
    metadata: { active },
  });
  redirect(`/dashboard/designs/materials?saved=${active ? "reactivated" : "archived"}`);
}
