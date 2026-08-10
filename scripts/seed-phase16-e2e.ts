import "dotenv/config";
import {
  DesignJobStatus,
  DesignProductionBriefStatus,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductionInventoryKind,
  ProductionInventoryMovementType,
  ProductionInventoryUnit,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? "") });

const SHOP_SLUG = "ejm-browser-test-shop";
const OWNER_EMAIL = "browser-owner@ejm.test";
const VARIANT_SKU = "EJM-P15-CUSTOM-M";
const RECEIPT_NUMBER = "EJM-P16-FIN-TRUTH";
const ORDER_IDEMPOTENCY_KEY = "e2e:phase16:financial-truth";
const JOB_TITLE = "E2E Phase 16 Financial Truth Job";
const GARMENT_KEY = "e2e|phase16|garment-m";
const VINYL_KEY = "e2e|phase16|vinyl-white";

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Phase 16 browser acceptance seeding is allowed only with E2E_TESTING=true outside production.");
  }

  const [shop, owner, variant] = await Promise.all([
    prisma.shop.findUnique({ where: { slug: SHOP_SLUG } }),
    prisma.user.findUnique({ where: { email: OWNER_EMAIL } }),
    prisma.productVariant.findUnique({ where: { sku: VARIANT_SKU } }),
  ]);
  if (!shop || !owner || owner.shopId !== shop.id || !variant) {
    throw new Error("Run the base and Phase 15 E2E seeds before the Phase 16 reporting seed.");
  }

  const existingCustomer = await prisma.customer.findFirst({ where: { shopId: shop.id, phone: "+233200000116" } });
  const customer = existingCustomer
    ? await prisma.customer.update({ where: { id: existingCustomer.id }, data: { name: "E2E Phase 16 Financial Buyer", email: "phase16-buyer@ejm.test" } })
    : await prisma.customer.create({ data: { shopId: shop.id, name: "E2E Phase 16 Financial Buyer", phone: "+233200000116", email: "phase16-buyer@ejm.test", group: "Phase 16 reporting" } });

  const existingOrder = await prisma.order.findUnique({ where: { idempotencyKey: ORDER_IDEMPOTENCY_KEY } });
  const order = existingOrder
    ? await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          shopId: shop.id,
          customerId: customer.id,
          processedById: owner.id,
          status: OrderStatus.COMPLETED,
          channel: OrderChannel.ONLINE,
          totalAmount: 80,
          receiptNumber: RECEIPT_NUMBER,
          notes: "Deterministic Phase 16 financial truth fixture.",
          createdAt: new Date(),
        },
      })
    : await prisma.order.create({
        data: {
          shopId: shop.id,
          customerId: customer.id,
          processedById: owner.id,
          status: OrderStatus.COMPLETED,
          channel: OrderChannel.ONLINE,
          totalAmount: 80,
          receiptNumber: RECEIPT_NUMBER,
          publicAccessToken: "e2e-phase16-financial-truth-token",
          idempotencyKey: ORDER_IDEMPOTENCY_KEY,
          notes: "Deterministic Phase 16 financial truth fixture.",
        },
      });

  const existingOrderItem = await prisma.orderItem.findFirst({ where: { orderId: order.id, productVariantId: variant.id } });
  if (existingOrderItem) {
    await prisma.orderItem.update({ where: { id: existingOrderItem.id }, data: { quantity: 1, unitPrice: 80 } });
  } else {
    await prisma.orderItem.create({ data: { orderId: order.id, productVariantId: variant.id, quantity: 1, unitPrice: 80 } });
  }

  const existingPayment = await prisma.payment.findFirst({ where: { orderId: order.id, providerReference: "E2E-P16-PAYMENT" } });
  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: { method: PaymentMethod.CASH, amount: 80, status: PaymentStatus.SUCCESS, verifiedAt: new Date(), createdAt: new Date() },
    });
  } else {
    await prisma.payment.create({
      data: { orderId: order.id, method: PaymentMethod.CASH, amount: 80, status: PaymentStatus.SUCCESS, providerReference: "E2E-P16-PAYMENT", verifiedAt: new Date(), metadata: { fixture: "phase16-financial-truth" } },
    });
  }

  const garment = await prisma.productionInventoryItem.upsert({
    where: { shopId_inventoryKey: { shopId: shop.id, inventoryKey: GARMENT_KEY } },
    update: { name: "E2E Phase 16 Black Tee", kind: ProductionInventoryKind.GARMENT, colour: "Black", size: "M", unit: ProductionInventoryUnit.PIECE, quantity: 9, unitCost: 25, lowStockLevel: 2, isActive: true, productVariantId: variant.id },
    create: { shopId: shop.id, inventoryKey: GARMENT_KEY, name: "E2E Phase 16 Black Tee", kind: ProductionInventoryKind.GARMENT, colour: "Black", size: "M", unit: ProductionInventoryUnit.PIECE, quantity: 9, unitCost: 25, lowStockLevel: 2, isActive: true, productVariantId: variant.id },
  });
  const vinyl = await prisma.productionInventoryItem.upsert({
    where: { shopId_inventoryKey: { shopId: shop.id, inventoryKey: VINYL_KEY } },
    update: { name: "E2E Phase 16 White HTV", kind: ProductionInventoryKind.VINYL, colour: "White", unit: ProductionInventoryUnit.METRE, quantity: 9.4, unitCost: 12.8, lowStockLevel: 1, isActive: true, sourceResourceId: "e2e-phase16-report-vinyl" },
    create: { shopId: shop.id, inventoryKey: VINYL_KEY, name: "E2E Phase 16 White HTV", kind: ProductionInventoryKind.VINYL, colour: "White", unit: ProductionInventoryUnit.METRE, quantity: 9.4, unitCost: 12.8, lowStockLevel: 1, isActive: true, sourceResourceId: "e2e-phase16-report-vinyl" },
  });

  await prisma.productionInventoryMovement.upsert({
    where: { shopId_idempotencyKey: { shopId: shop.id, idempotencyKey: "e2e:p16:vinyl-use" } },
    update: { inventoryItemId: vinyl.id, type: ProductionInventoryMovementType.PRODUCTION_USE, quantityDelta: -0.5, balanceAfter: 9.5, unitCostSnapshot: 12.8, referenceType: "PHASE16_FINANCIAL_TRUTH", referenceId: order.id, note: "Phase 16 financial truth material use.", createdById: owner.id, createdAt: new Date() },
    create: { shopId: shop.id, inventoryItemId: vinyl.id, type: ProductionInventoryMovementType.PRODUCTION_USE, quantityDelta: -0.5, balanceAfter: 9.5, unitCostSnapshot: 12.8, referenceType: "PHASE16_FINANCIAL_TRUTH", referenceId: order.id, note: "Phase 16 financial truth material use.", idempotencyKey: "e2e:p16:vinyl-use", createdById: owner.id },
  });
  await prisma.productionInventoryMovement.upsert({
    where: { shopId_idempotencyKey: { shopId: shop.id, idempotencyKey: "e2e:p16:vinyl-waste" } },
    update: { inventoryItemId: vinyl.id, type: ProductionInventoryMovementType.WASTE, quantityDelta: -0.1, balanceAfter: 9.4, unitCostSnapshot: 12.8, referenceType: "PHASE16_FINANCIAL_TRUTH", referenceId: order.id, note: "Phase 16 financial truth material waste.", createdById: owner.id, createdAt: new Date() },
    create: { shopId: shop.id, inventoryItemId: vinyl.id, type: ProductionInventoryMovementType.WASTE, quantityDelta: -0.1, balanceAfter: 9.4, unitCostSnapshot: 12.8, referenceType: "PHASE16_FINANCIAL_TRUTH", referenceId: order.id, note: "Phase 16 financial truth material waste.", idempotencyKey: "e2e:p16:vinyl-waste", createdById: owner.id },
  });

  const existingDesign = await prisma.designJob.findFirst({ where: { shopId: shop.id, title: JOB_TITLE } });
  const design = existingDesign
    ? await prisma.designJob.update({ where: { id: existingDesign.id }, data: { orderId: order.id, customerId: customer.id, status: DesignJobStatus.APPROVED, canvasJson: { fixture: "phase16-financial-truth" } } })
    : await prisma.designJob.create({ data: { shopId: shop.id, orderId: order.id, customerId: customer.id, title: JOB_TITLE, status: DesignJobStatus.APPROVED, canvasJson: { fixture: "phase16-financial-truth" } } });

  const brief = await prisma.designProductionBrief.upsert({
    where: { shopId_designJobId: { shopId: shop.id, designJobId: design.id } },
    update: {
      garmentId: "e2e-phase15-garment",
      garmentSize: "M",
      placementId: "e2e-phase15-left-chest",
      materialId: "e2e-phase16-report-vinyl",
      garmentSnapshot: { id: "e2e-phase15-garment", name: "E2E Phase 16 Black Tee", colour: "Black", cost: 25 },
      placementSnapshot: { id: "e2e-phase15-left-chest", name: "E2E Phase 15 Left chest", location: "LEFT_CHEST" },
      materialSnapshot: { id: "e2e-phase16-report-vinyl", name: "E2E Phase 16 White HTV", colour: "White", costPerMetre: 12.8 },
      cutSheetWidthMm: 100,
      cutSheetHeightMm: 100,
      artworkWidthMm: 80,
      artworkHeightMm: 60,
      placementWidthMm: 105,
      placementHeightMm: 95,
      materialWidthMm: 500,
      mirror: true,
      status: DesignProductionBriefStatus.REVIEWED,
      reviewedAt: new Date(),
      reviewedById: owner.id,
      createdById: owner.id,
    },
    create: {
      shopId: shop.id,
      designJobId: design.id,
      garmentId: "e2e-phase15-garment",
      garmentSize: "M",
      placementId: "e2e-phase15-left-chest",
      materialId: "e2e-phase16-report-vinyl",
      garmentSnapshot: { id: "e2e-phase15-garment", name: "E2E Phase 16 Black Tee", colour: "Black", cost: 25 },
      placementSnapshot: { id: "e2e-phase15-left-chest", name: "E2E Phase 15 Left chest", location: "LEFT_CHEST" },
      materialSnapshot: { id: "e2e-phase16-report-vinyl", name: "E2E Phase 16 White HTV", colour: "White", costPerMetre: 12.8 },
      cutSheetWidthMm: 100,
      cutSheetHeightMm: 100,
      artworkWidthMm: 80,
      artworkHeightMm: 60,
      placementWidthMm: 105,
      placementHeightMm: 95,
      materialWidthMm: 500,
      mirror: true,
      status: DesignProductionBriefStatus.REVIEWED,
      reviewedAt: new Date(),
      reviewedById: owner.id,
      createdById: owner.id,
    },
  });

  await prisma.productionCostSnapshot.upsert({
    where: { shopId_designProductionBriefId: { shopId: shop.id, designProductionBriefId: brief.id } },
    update: {
      designJobId: design.id,
      orderId: order.id,
      garmentInventoryItemId: garment.id,
      materialInventoryItemId: vinyl.id,
      garmentCost: 25,
      materialUsedAreaMm2: 10_000,
      materialUsedMetres: 0.5,
      materialWasteMetres: 0.1,
      materialCost: 6.4,
      wasteCost: 1.28,
      labourCost: 5,
      designCharge: 3,
      pressingCharge: 2,
      additionalServicesCost: 1,
      totalCost: 43.68,
      revenue: 80,
      profit: 36.32,
      marginPercent: 45.4,
      inventoryPostedAt: new Date(),
      updatedById: owner.id,
    },
    create: {
      shopId: shop.id,
      designProductionBriefId: brief.id,
      designJobId: design.id,
      orderId: order.id,
      garmentInventoryItemId: garment.id,
      materialInventoryItemId: vinyl.id,
      garmentCost: 25,
      materialUsedAreaMm2: 10_000,
      materialUsedMetres: 0.5,
      materialWasteMetres: 0.1,
      materialCost: 6.4,
      wasteCost: 1.28,
      labourCost: 5,
      designCharge: 3,
      pressingCharge: 2,
      additionalServicesCost: 1,
      totalCost: 43.68,
      revenue: 80,
      profit: 36.32,
      marginPercent: 45.4,
      inventoryPostedAt: new Date(),
      createdById: owner.id,
      updatedById: owner.id,
    },
  });

  console.log("Phase 16 deterministic financial truth fixture is ready: 80.00 - 43.68 = 36.32.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
