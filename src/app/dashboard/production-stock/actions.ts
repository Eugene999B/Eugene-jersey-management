"use server";

import {
  Prisma,
  ProductionInventoryKind,
  ProductionInventoryMovementType,
  ProductionInventoryUnit,
  Role,
  SupplierAccountEntryType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { requireBusinessModuleAccess } from "@/lib/business-module-access";
import { prisma } from "@/lib/db";
import {
  applyProductionInventoryMovement,
  calculateProductionCost,
  productionInventoryKey,
} from "@/lib/production-inventory";
import { permissions } from "@/lib/rbac";

const submissionIdSchema = z.string().uuid();

async function lockShopSubmission(tx: Prisma.TransactionClient, shopId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Shop"
    WHERE "id" = ${shopId}
    FOR UPDATE
  `);
  if (!rows.length) throw new Error("SHOP_NOT_FOUND");
}

const inventoryItemSchema = z.object({
  kind: z.nativeEnum(ProductionInventoryKind),
  name: z.string().trim().min(2).max(160),
  colour: z.string().trim().max(80).optional(),
  size: z.string().trim().max(40).optional(),
  unit: z.nativeEnum(ProductionInventoryUnit),
  sourceResourceId: z.string().trim().max(160).optional(),
  productVariantId: z.string().trim().max(160).optional(),
  openingQuantity: z.coerce.number().min(0).max(10_000_000),
  unitCost: z.coerce.number().min(0).max(100_000_000),
  lowStockLevel: z.coerce.number().min(0).max(10_000_000),
});

async function stockSession() {
  const session = await requireRole(permissions.suppliers);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  await requireBusinessModuleAccess(session.shopId, "SUPPLIERS_PURCHASING");
  return { session, shopId: session.shopId };
}

export async function createProductionInventoryItemAction(formData: FormData) {
  const { session, shopId } = await stockSession();
  const parsed = inventoryItemSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    colour: formData.get("colour") || undefined,
    size: formData.get("size") || undefined,
    unit: formData.get("unit"),
    sourceResourceId: formData.get("sourceResourceId") || undefined,
    productVariantId: formData.get("productVariantId") || undefined,
    openingQuantity: formData.get("openingQuantity") || 0,
    unitCost: formData.get("unitCost") || 0,
    lowStockLevel: formData.get("lowStockLevel") || 0,
  });
  if (!parsed.success) redirect("/dashboard/production-stock?error=item");

  if (parsed.data.productVariantId) {
    const variant = await prisma.productVariant.findFirst({ where: { id: parsed.data.productVariantId, product: { shopId } }, select: { id: true } });
    if (!variant) redirect("/dashboard/production-stock?error=variant");
  }
  const inventoryKey = productionInventoryKey(parsed.data);
  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.productionInventoryItem.create({
        data: {
          shopId,
          inventoryKey,
          kind: parsed.data.kind,
          name: parsed.data.name,
          colour: parsed.data.colour,
          size: parsed.data.size,
          unit: parsed.data.unit,
          sourceResourceId: parsed.data.sourceResourceId,
          productVariantId: parsed.data.productVariantId,
          quantity: 0,
          unitCost: parsed.data.unitCost,
          lowStockLevel: parsed.data.lowStockLevel,
        },
      });
      if (parsed.data.openingQuantity > 0) {
        await applyProductionInventoryMovement(tx, {
          shopId,
          inventoryItemId: created.id,
          type: ProductionInventoryMovementType.OPENING_BALANCE,
          quantity: parsed.data.openingQuantity,
          unitCostSnapshot: parsed.data.unitCost,
          referenceType: "OPENING_BALANCE",
          referenceId: created.id,
          note: "Opening production stock balance.",
          idempotencyKey: `opening:${created.id}`,
          createdById: session.id,
        });
      }
      return created;
    });
    await audit({ shopId, userId: session.id, action: "production.stock.item-created", entityType: "ProductionInventoryItem", entityId: item.id, metadata: { kind: item.kind, unit: item.unit, sourceResourceId: item.sourceResourceId } });
  } catch {
    redirect("/dashboard/production-stock?error=item-duplicate");
  }
  revalidatePath("/dashboard/production-stock");
}

const adjustSchema = z.object({
  submissionId: submissionIdSchema,
  inventoryItemId: z.string().min(1).max(160),
  type: z.enum(["WASTE", "DAMAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "FINISHED_GOOD_IN"]),
  quantity: z.coerce.number().positive().max(10_000_000),
  note: z.string().trim().min(2).max(600),
});

export async function adjustProductionInventoryAction(formData: FormData) {
  const { session, shopId } = await stockSession();
  const parsed = adjustSchema.safeParse({
    submissionId: formData.get("submissionId"),
    inventoryItemId: formData.get("inventoryItemId"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    note: formData.get("note"),
  });
  if (!parsed.success) redirect("/dashboard/production-stock?error=adjustment");
  const idempotencyKey = `manual-adjustment:${parsed.data.submissionId}`;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockShopSubmission(tx, shopId);
      const existing = await tx.productionInventoryMovement.findFirst({ where: { shopId, idempotencyKey } });
      if (existing) return { movement: existing, created: false };
      const movement = await applyProductionInventoryMovement(tx, {
        shopId,
        inventoryItemId: parsed.data.inventoryItemId,
        type: ProductionInventoryMovementType[parsed.data.type],
        quantity: parsed.data.quantity,
        referenceType: "MANUAL_ADJUSTMENT",
        note: parsed.data.note,
        idempotencyKey,
        createdById: session.id,
      });
      return { movement, created: true };
    });
    if (result.created) {
      await audit({ shopId, userId: session.id, action: "production.stock.adjusted", entityType: "ProductionInventoryItem", entityId: parsed.data.inventoryItemId, metadata: { type: parsed.data.type, quantity: parsed.data.quantity, note: parsed.data.note } });
    }
  } catch {
    redirect("/dashboard/production-stock?error=adjustment-stock");
  }
  revalidatePath("/dashboard/production-stock");
}

const supplierPaymentSchema = z.object({
  submissionId: submissionIdSchema,
  supplierId: z.string().min(1).max(160),
  amount: z.coerce.number().positive().max(100_000_000),
  reference: z.string().trim().max(160).optional(),
  note: z.string().trim().max(600).optional(),
});

export async function recordSupplierPaymentAction(formData: FormData) {
  const { session, shopId } = await stockSession();
  const parsed = supplierPaymentSchema.safeParse({
    submissionId: formData.get("submissionId"),
    supplierId: formData.get("supplierId"),
    amount: formData.get("amount"),
    reference: formData.get("reference") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/production-stock?error=payment");
  const supplier = await prisma.supplier.findFirst({ where: { id: parsed.data.supplierId, shopId }, select: { id: true } });
  if (!supplier) redirect("/dashboard/production-stock?error=supplier");
  const idempotencyKey = `supplier-payment:${parsed.data.submissionId}`;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockShopSubmission(tx, shopId);
      const existing = await tx.supplierAccountEntry.findFirst({ where: { shopId, idempotencyKey } });
      if (existing) return { entry: existing, created: false };
      const entry = await tx.supplierAccountEntry.create({
        data: {
          shopId,
          supplierId: supplier.id,
          type: SupplierAccountEntryType.PAYMENT,
          amount: -parsed.data.amount,
          reference: parsed.data.reference,
          note: parsed.data.note,
          idempotencyKey,
          createdById: session.id,
        },
      });
      return { entry, created: true };
    });
    if (result.created) {
      await audit({ shopId, userId: session.id, action: "supplier.payment-recorded", entityType: "SupplierAccountEntry", entityId: result.entry.id, metadata: { supplierId: supplier.id, amount: parsed.data.amount, reference: parsed.data.reference ?? null } });
    }
  } catch {
    redirect("/dashboard/production-stock?error=payment");
  }
  revalidatePath("/dashboard/production-stock");
  revalidatePath("/dashboard/suppliers");
}

const supplierReturnSchema = z.object({
  submissionId: submissionIdSchema,
  supplierId: z.string().min(1).max(160),
  inventoryItemId: z.string().min(1).max(160),
  quantity: z.coerce.number().positive().max(10_000_000),
  unitCost: z.coerce.number().min(0).max(100_000_000),
  reason: z.string().trim().min(3).max(600),
  reference: z.string().trim().max(160).optional(),
});

export async function recordSupplierReturnAction(formData: FormData) {
  const { session, shopId } = await stockSession();
  const parsed = supplierReturnSchema.safeParse({
    submissionId: formData.get("submissionId"),
    supplierId: formData.get("supplierId"),
    inventoryItemId: formData.get("inventoryItemId"),
    quantity: formData.get("quantity"),
    unitCost: formData.get("unitCost"),
    reason: formData.get("reason"),
    reference: formData.get("reference") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/production-stock?error=return");
  const supplier = await prisma.supplier.findFirst({ where: { id: parsed.data.supplierId, shopId }, select: { id: true } });
  const item = await prisma.productionInventoryItem.findFirst({ where: { id: parsed.data.inventoryItemId, shopId, isActive: true }, select: { id: true } });
  if (!supplier || !item) redirect("/dashboard/production-stock?error=return-tenant");
  const idempotencyKey = `supplier-return:${parsed.data.submissionId}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockShopSubmission(tx, shopId);
      const existing = await tx.supplierStockReturn.findFirst({ where: { shopId, idempotencyKey } });
      if (existing) return { row: existing, created: false };
      const row = await tx.supplierStockReturn.create({
        data: {
          shopId,
          supplierId: supplier.id,
          productionInventoryItemId: item.id,
          quantity: parsed.data.quantity,
          unitCost: parsed.data.unitCost,
          reason: parsed.data.reason,
          reference: parsed.data.reference,
          idempotencyKey,
          createdById: session.id,
        },
      });
      await applyProductionInventoryMovement(tx, {
        shopId,
        inventoryItemId: item.id,
        type: ProductionInventoryMovementType.SUPPLIER_RETURN,
        quantity: parsed.data.quantity,
        unitCostSnapshot: parsed.data.unitCost,
        referenceType: "SUPPLIER_RETURN",
        referenceId: row.id,
        note: parsed.data.reason,
        idempotencyKey: `${idempotencyKey}:stock`,
        createdById: session.id,
      });
      await tx.supplierAccountEntry.create({
        data: {
          shopId,
          supplierId: supplier.id,
          type: SupplierAccountEntryType.RETURN_CREDIT,
          amount: -(parsed.data.quantity * parsed.data.unitCost),
          reference: parsed.data.reference,
          note: parsed.data.reason,
          idempotencyKey: `${idempotencyKey}:credit`,
          createdById: session.id,
        },
      });
      return { row, created: true };
    });
    if (result.created) {
      await audit({ shopId, userId: session.id, action: "supplier.stock-returned", entityType: "SupplierStockReturn", entityId: result.row.id, metadata: { supplierId: supplier.id, inventoryItemId: item.id, quantity: parsed.data.quantity, unitCost: parsed.data.unitCost } });
    }
  } catch {
    redirect("/dashboard/production-stock?error=return-stock");
  }
  revalidatePath("/dashboard/production-stock");
  revalidatePath("/dashboard/suppliers");
}

const costingRoles: Role[] = [Role.OWNER, Role.MANAGER, Role.ACCOUNTANT];
const costSchema = z.object({
  designProductionBriefId: z.string().min(1).max(160),
  garmentInventoryItemId: z.string().min(1).max(160),
  materialInventoryItemId: z.string().min(1).max(160),
  materialUsedMetres: z.coerce.number().min(0).max(100_000),
  materialWasteMetres: z.coerce.number().min(0).max(100_000),
  labourCost: z.coerce.number().min(0).max(100_000_000),
  designCharge: z.coerce.number().min(0).max(100_000_000),
  pressingCharge: z.coerce.number().min(0).max(100_000_000),
  additionalServicesCost: z.coerce.number().min(0).max(100_000_000),
  revenue: z.coerce.number().min(0).max(100_000_000),
});

export async function saveProductionCostAction(formData: FormData) {
  const session = await requireRole(costingRoles);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;
  await requireBusinessModuleAccess(shopId, "PRINTING_PRODUCTION");
  const parsed = costSchema.safeParse({
    designProductionBriefId: formData.get("designProductionBriefId"),
    garmentInventoryItemId: formData.get("garmentInventoryItemId"),
    materialInventoryItemId: formData.get("materialInventoryItemId"),
    materialUsedMetres: formData.get("materialUsedMetres") || 0,
    materialWasteMetres: formData.get("materialWasteMetres") || 0,
    labourCost: formData.get("labourCost") || 0,
    designCharge: formData.get("designCharge") || 0,
    pressingCharge: formData.get("pressingCharge") || 0,
    additionalServicesCost: formData.get("additionalServicesCost") || 0,
    revenue: formData.get("revenue") || 0,
  });
  if (!parsed.success) redirect("/dashboard/production-stock?error=cost");

  const [brief, garment, material] = await Promise.all([
    prisma.designProductionBrief.findFirst({ where: { id: parsed.data.designProductionBriefId, shopId, status: "REVIEWED" }, select: { id: true, designJobId: true, cutSheetWidthMm: true, cutSheetHeightMm: true } }),
    prisma.productionInventoryItem.findFirst({ where: { id: parsed.data.garmentInventoryItemId, shopId, kind: ProductionInventoryKind.GARMENT, isActive: true } }),
    prisma.productionInventoryItem.findFirst({ where: { id: parsed.data.materialInventoryItemId, shopId, kind: ProductionInventoryKind.VINYL, isActive: true } }),
  ]);
  if (!brief || !garment || !material) redirect("/dashboard/production-stock?error=cost-stock");
  const design = await prisma.designJob.findFirst({ where: { id: brief.designJobId, shopId }, select: { id: true, orderId: true } });
  if (!design) redirect("/dashboard/production-stock?error=cost-design");

  const totals = calculateProductionCost({
    garmentCost: Number(garment.unitCost),
    materialUnitCost: Number(material.unitCost),
    materialUsedMetres: parsed.data.materialUsedMetres,
    materialWasteMetres: parsed.data.materialWasteMetres,
    labourCost: parsed.data.labourCost,
    designCharge: parsed.data.designCharge,
    pressingCharge: parsed.data.pressingCharge,
    additionalServicesCost: parsed.data.additionalServicesCost,
    revenue: parsed.data.revenue,
  });
  const materialUsedAreaMm2 = Math.max(0, brief.cutSheetWidthMm * brief.cutSheetHeightMm);
  const existing = await prisma.productionCostSnapshot.findUnique({ where: { shopId_designProductionBriefId: { shopId, designProductionBriefId: brief.id } }, select: { inventoryPostedAt: true } });
  if (existing?.inventoryPostedAt) redirect("/dashboard/production-stock?error=cost-posted");

  const cost = await prisma.productionCostSnapshot.upsert({
    where: { shopId_designProductionBriefId: { shopId, designProductionBriefId: brief.id } },
    create: {
      shopId,
      designProductionBriefId: brief.id,
      designJobId: design.id,
      orderId: design.orderId,
      garmentInventoryItemId: garment.id,
      materialInventoryItemId: material.id,
      materialUsedAreaMm2,
      ...totals,
      createdById: session.id,
      updatedById: session.id,
    },
    update: {
      garmentInventoryItemId: garment.id,
      materialInventoryItemId: material.id,
      materialUsedAreaMm2,
      ...totals,
      updatedById: session.id,
    },
  });
  await audit({ shopId, userId: session.id, action: "production.cost.saved", entityType: "ProductionCostSnapshot", entityId: cost.id, metadata: { designProductionBriefId: brief.id, materialUsedAreaMm2, totalCost: totals.totalCost, revenue: totals.revenue, profit: totals.profit, marginPercent: totals.marginPercent } });
  revalidatePath("/dashboard/production-stock");
}

export async function postProductionInventoryAction(formData: FormData) {
  const { session, shopId } = await stockSession();
  await requireBusinessModuleAccess(shopId, "PRINTING_PRODUCTION");
  const costId = String(formData.get("costId") ?? "");
  if (!costId) redirect("/dashboard/production-stock?error=post");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const cost = await tx.productionCostSnapshot.findFirst({ where: { id: costId, shopId } });
      if (!cost) throw new Error("COST_NOT_FOUND");
      if (cost.inventoryPostedAt) return { posted: cost, created: false };
      if (!cost.garmentInventoryItemId || !cost.materialInventoryItemId) throw new Error("COST_STOCK_MISSING");
      await applyProductionInventoryMovement(tx, {
        shopId,
        inventoryItemId: cost.garmentInventoryItemId,
        type: ProductionInventoryMovementType.PRODUCTION_USE,
        quantity: 1,
        unitCostSnapshot: Number(cost.garmentCost),
        referenceType: "PRODUCTION_COST",
        referenceId: cost.id,
        note: "Garment consumed by reviewed production job.",
        idempotencyKey: `production-cost:${cost.id}:garment`,
        createdById: session.id,
      });
      const used = Number(cost.materialUsedMetres);
      if (used > 0) {
        await applyProductionInventoryMovement(tx, {
          shopId,
          inventoryItemId: cost.materialInventoryItemId,
          type: ProductionInventoryMovementType.PRODUCTION_USE,
          quantity: used,
          unitCostSnapshot: used > 0 ? Number(cost.materialCost) / used : 0,
          referenceType: "PRODUCTION_COST",
          referenceId: cost.id,
          note: "Vinyl/material used by reviewed production job.",
          idempotencyKey: `production-cost:${cost.id}:material`,
          createdById: session.id,
        });
      }
      const waste = Number(cost.materialWasteMetres);
      if (waste > 0) {
        await applyProductionInventoryMovement(tx, {
          shopId,
          inventoryItemId: cost.materialInventoryItemId,
          type: ProductionInventoryMovementType.WASTE,
          quantity: waste,
          unitCostSnapshot: Number(cost.wasteCost) / waste,
          referenceType: "PRODUCTION_COST",
          referenceId: cost.id,
          note: "Recorded production material waste.",
          idempotencyKey: `production-cost:${cost.id}:waste`,
          createdById: session.id,
        });
      }
      const posted = await tx.productionCostSnapshot.update({ where: { id: cost.id }, data: { inventoryPostedAt: new Date(), updatedById: session.id } });
      return { posted, created: true };
    });
    if (result.created) {
      await audit({ shopId, userId: session.id, action: "production.cost.inventory-posted", entityType: "ProductionCostSnapshot", entityId: result.posted.id, metadata: { designJobId: result.posted.designJobId, garmentInventoryItemId: result.posted.garmentInventoryItemId, materialInventoryItemId: result.posted.materialInventoryItemId } });
    }
  } catch {
    redirect("/dashboard/production-stock?error=post-stock");
  }
  revalidatePath("/dashboard/production-stock");
  revalidatePath("/dashboard/designs/heat-press");
}
