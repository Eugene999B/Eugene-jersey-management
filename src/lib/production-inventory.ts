import {
  type Prisma,
  ProductionInventoryMovementType,
  type ProductionInventoryKind,
  type ProductionInventoryUnit,
} from "@prisma/client";

export type InventoryIdentity = {
  kind: ProductionInventoryKind;
  name: string;
  colour?: string | null;
  size?: string | null;
  unit: ProductionInventoryUnit;
  sourceResourceId?: string | null;
  productVariantId?: string | null;
};

const OUTBOUND_MOVEMENT_TYPES: ReadonlySet<ProductionInventoryMovementType> = new Set([
  ProductionInventoryMovementType.PRODUCTION_USE,
  ProductionInventoryMovementType.WASTE,
  ProductionInventoryMovementType.DAMAGE,
  ProductionInventoryMovementType.ADJUSTMENT_OUT,
  ProductionInventoryMovementType.SUPPLIER_RETURN,
]);

const INVENTORY_UPDATE_RETRIES = 8;

function keyPart(value: string | null | undefined) {
  return (value ?? "-").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "-";
}

export function productionInventoryKey(input: InventoryIdentity) {
  return [
    input.kind,
    input.unit,
    input.sourceResourceId ? `resource:${keyPart(input.sourceResourceId)}` : `name:${keyPart(input.name)}`,
    `colour:${keyPart(input.colour)}`,
    `size:${keyPart(input.size)}`,
    input.productVariantId ? `variant:${keyPart(input.productVariantId)}` : "variant:-",
  ].join("|");
}

export function inventoryMovementDelta(type: ProductionInventoryMovementType, quantity: number) {
  const safe = Math.max(0, quantity);
  return OUTBOUND_MOVEMENT_TYPES.has(type) ? -safe : safe;
}

export function weightedUnitCost(input: {
  currentQuantity: number;
  currentUnitCost: number;
  receivedQuantity: number;
  receivedUnitCost: number;
}) {
  const currentQuantity = Math.max(0, input.currentQuantity);
  const receivedQuantity = Math.max(0, input.receivedQuantity);
  const totalQuantity = currentQuantity + receivedQuantity;
  if (!totalQuantity) return 0;
  return ((currentQuantity * Math.max(0, input.currentUnitCost)) + (receivedQuantity * Math.max(0, input.receivedUnitCost))) / totalQuantity;
}

export async function applyProductionInventoryMovement(
  tx: Prisma.TransactionClient,
  input: {
    shopId: string;
    inventoryItemId: string;
    type: ProductionInventoryMovementType;
    quantity: number;
    unitCostSnapshot?: number;
    referenceType?: string | null;
    referenceId?: string | null;
    note?: string | null;
    idempotencyKey?: string | null;
    createdById: string;
    updateWeightedCost?: boolean;
  },
) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Inventory movement quantity must be greater than zero.");

  for (let attempt = 0; attempt < INVENTORY_UPDATE_RETRIES; attempt += 1) {
    if (input.idempotencyKey) {
      const existing = await tx.productionInventoryMovement.findFirst({
        where: { shopId: input.shopId, idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const item = await tx.productionInventoryItem.findFirst({
      where: { id: input.inventoryItemId, shopId: input.shopId, isActive: true },
    });
    if (!item) throw new Error("Production inventory item was not found in this shop.");

    const delta = inventoryMovementDelta(input.type, input.quantity);
    const currentQuantity = Number(item.quantity);
    const nextQuantity = currentQuantity + delta;
    if (nextQuantity < -0.0001) throw new Error(`${item.name} does not have enough stock for this movement.`);

    const receivedUnitCost = Math.max(0, input.unitCostSnapshot ?? Number(item.unitCost));
    const nextUnitCost = input.updateWeightedCost && delta > 0
      ? weightedUnitCost({ currentQuantity, currentUnitCost: Number(item.unitCost), receivedQuantity: delta, receivedUnitCost })
      : Number(item.unitCost);

    const updated = await tx.productionInventoryItem.updateMany({
      where: {
        id: item.id,
        shopId: input.shopId,
        isActive: true,
        updatedAt: item.updatedAt,
      },
      data: {
        quantity: nextQuantity,
        ...(input.updateWeightedCost ? { unitCost: nextUnitCost } : {}),
      },
    });
    if (updated.count !== 1) continue;

    return tx.productionInventoryMovement.create({
      data: {
        shopId: input.shopId,
        inventoryItemId: item.id,
        type: input.type,
        quantityDelta: delta,
        balanceAfter: nextQuantity,
        unitCostSnapshot: receivedUnitCost,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdById: input.createdById,
      },
    });
  }

  throw new Error("Production inventory changed repeatedly while this movement was being recorded. Refresh and try again.");
}

export function calculateProductionCost(input: {
  garmentCost: number;
  materialUnitCost: number;
  materialUsedMetres: number;
  materialWasteMetres: number;
  labourCost: number;
  designCharge: number;
  pressingCharge: number;
  additionalServicesCost: number;
  revenue: number;
}) {
  const money = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
  const metres = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
  const garmentCost = money(input.garmentCost);
  const materialUsedMetres = metres(input.materialUsedMetres);
  const materialWasteMetres = metres(input.materialWasteMetres);
  const materialUnitCost = money(input.materialUnitCost);
  const materialCost = materialUsedMetres * materialUnitCost;
  const wasteCost = materialWasteMetres * materialUnitCost;
  const labourCost = money(input.labourCost);
  const designCharge = money(input.designCharge);
  const pressingCharge = money(input.pressingCharge);
  const additionalServicesCost = money(input.additionalServicesCost);
  const totalCost = garmentCost + materialCost + wasteCost + labourCost + designCharge + pressingCharge + additionalServicesCost;
  const revenue = money(input.revenue);
  const profit = revenue - totalCost;
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
  return {
    garmentCost,
    materialUsedMetres,
    materialWasteMetres,
    materialCost,
    wasteCost,
    labourCost,
    designCharge,
    pressingCharge,
    additionalServicesCost,
    totalCost,
    revenue,
    profit,
    marginPercent,
  };
}
