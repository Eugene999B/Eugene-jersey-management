import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentRefundStatus,
  PaymentStatus,
  PrismaClient,
  ProductionInventoryKind,
  ProductionInventoryMovementType,
  ProductionInventoryUnit,
  Role,
  ShopVerificationStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? "") });

const IDS = {
  shop: "phase17-canary-shop",
  user: "phase17-canary-user",
  category: "phase17-canary-category",
  product: "phase17-canary-product",
  variant: "phase17-canary-variant",
  customer: "phase17-canary-customer",
  order: "phase17-canary-order",
  orderItem: "phase17-canary-order-item",
  payment: "phase17-canary-payment",
  refund: "phase17-canary-refund",
  inventory: "phase17-canary-inventory",
  movement: "phase17-canary-movement",
} as const;

function guard() {
  if (process.env.PHASE17_RELEASE_REHEARSAL !== "true") {
    throw new Error("PHASE17_RELEASE_REHEARSAL=true is required.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Phase 17 release rehearsal refuses to run in production.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
}

async function seed() {
  await prisma.shop.upsert({
    where: { id: IDS.shop },
    update: {
      name: "Phase 17 Release Canary",
      slug: "phase17-release-canary",
      currency: "GHS",
      isActive: true,
      verificationStatus: ShopVerificationStatus.VERIFIED,
      publicOrderingEnabled: false,
      storefrontEnabled: false,
    },
    create: {
      id: IDS.shop,
      name: "Phase 17 Release Canary",
      slug: "phase17-release-canary",
      currency: "GHS",
      isActive: true,
      verificationStatus: ShopVerificationStatus.VERIFIED,
      publicOrderingEnabled: false,
      storefrontEnabled: false,
    },
  });

  await prisma.user.upsert({
    where: { id: IDS.user },
    update: {
      shopId: IDS.shop,
      adminLoginId: "EJM-PHASE17-CANARY",
      email: "phase17-canary-owner@example.test",
      passwordHash: "phase17-release-rehearsal-disabled-login",
      name: "Phase 17 Canary Owner",
      role: Role.OWNER,
      isActive: false,
    },
    create: {
      id: IDS.user,
      shopId: IDS.shop,
      adminLoginId: "EJM-PHASE17-CANARY",
      email: "phase17-canary-owner@example.test",
      passwordHash: "phase17-release-rehearsal-disabled-login",
      name: "Phase 17 Canary Owner",
      role: Role.OWNER,
      isActive: false,
    },
  });

  await prisma.category.upsert({
    where: { id: IDS.category },
    update: { shopId: IDS.shop, name: "Phase 17 Canary Category" },
    create: { id: IDS.category, shopId: IDS.shop, name: "Phase 17 Canary Category" },
  });

  await prisma.product.upsert({
    where: { id: IDS.product },
    update: { shopId: IDS.shop, categoryId: IDS.category, name: "Phase 17 Canary Product", basePrice: 80, isPersonalizable: true },
    create: { id: IDS.product, shopId: IDS.shop, categoryId: IDS.category, name: "Phase 17 Canary Product", basePrice: 80, isPersonalizable: true },
  });

  await prisma.productVariant.upsert({
    where: { id: IDS.variant },
    update: { productId: IDS.product, sku: "PHASE17-CANARY-SKU", attributes: { size: "M", colour: "Black" }, stockQty: 7, priceOverride: 80 },
    create: { id: IDS.variant, productId: IDS.product, sku: "PHASE17-CANARY-SKU", attributes: { size: "M", colour: "Black" }, stockQty: 7, priceOverride: 80 },
  });

  await prisma.customer.upsert({
    where: { id: IDS.customer },
    update: { shopId: IDS.shop, name: "Phase 17 Canary Customer", phone: "+233200001717", email: "phase17-canary@example.test" },
    create: { id: IDS.customer, shopId: IDS.shop, name: "Phase 17 Canary Customer", phone: "+233200001717", email: "phase17-canary@example.test" },
  });

  await prisma.order.upsert({
    where: { id: IDS.order },
    update: {
      shopId: IDS.shop,
      customerId: IDS.customer,
      status: OrderStatus.COMPLETED,
      channel: OrderChannel.ONLINE,
      totalAmount: 80,
      receiptNumber: "PHASE17-CANARY-RECEIPT",
      publicAccessToken: "phase17-canary-public-access-token",
      idempotencyKey: "phase17:release-canary:order",
      notes: "Release rehearsal canary. Never production data.",
    },
    create: {
      id: IDS.order,
      shopId: IDS.shop,
      customerId: IDS.customer,
      status: OrderStatus.COMPLETED,
      channel: OrderChannel.ONLINE,
      totalAmount: 80,
      receiptNumber: "PHASE17-CANARY-RECEIPT",
      publicAccessToken: "phase17-canary-public-access-token",
      idempotencyKey: "phase17:release-canary:order",
      notes: "Release rehearsal canary. Never production data.",
    },
  });

  await prisma.orderItem.upsert({
    where: { id: IDS.orderItem },
    update: { orderId: IDS.order, productVariantId: IDS.variant, quantity: 1, unitPrice: 80, personalizationData: { name: "CANARY", number: "17" } },
    create: { id: IDS.orderItem, orderId: IDS.order, productVariantId: IDS.variant, quantity: 1, unitPrice: 80, personalizationData: { name: "CANARY", number: "17" } },
  });

  await prisma.payment.upsert({
    where: { id: IDS.payment },
    update: {
      orderId: IDS.order,
      method: PaymentMethod.CARD,
      amount: 80,
      status: PaymentStatus.SUCCESS,
      verifiedAt: new Date("2026-08-10T00:00:00.000Z"),
      providerReference: "PHASE17-CANARY-PAYMENT",
      providerChannel: "card",
      metadata: { refundProcessedAmount: 20, refundLastProcessedAt: "2026-08-10T00:05:00.000Z" },
    },
    create: {
      id: IDS.payment,
      orderId: IDS.order,
      method: PaymentMethod.CARD,
      amount: 80,
      status: PaymentStatus.SUCCESS,
      verifiedAt: new Date("2026-08-10T00:00:00.000Z"),
      providerReference: "PHASE17-CANARY-PAYMENT",
      providerChannel: "card",
      metadata: { refundProcessedAmount: 20, refundLastProcessedAt: "2026-08-10T00:05:00.000Z" },
    },
  });

  await prisma.paymentRefund.upsert({
    where: { id: IDS.refund },
    update: {
      shopId: IDS.shop,
      paymentId: IDS.payment,
      transactionReference: "PHASE17-CANARY-PAYMENT",
      provider: "paystack",
      providerRefundId: "171700001",
      providerRefundReference: "PHASE17-CANARY-REFUND",
      amount: 20,
      currency: "GHS",
      status: PaymentRefundStatus.PROCESSED,
      providerStatus: "processed",
      requestedById: IDS.user,
      reason: "Release rehearsal partial refund",
      providerResponse: { status: "processed", id: 171700001 },
      requestedAt: new Date("2026-08-10T00:04:00.000Z"),
      processedAt: new Date("2026-08-10T00:05:00.000Z"),
      failedAt: null,
    },
    create: {
      id: IDS.refund,
      shopId: IDS.shop,
      paymentId: IDS.payment,
      transactionReference: "PHASE17-CANARY-PAYMENT",
      provider: "paystack",
      providerRefundId: "171700001",
      providerRefundReference: "PHASE17-CANARY-REFUND",
      amount: 20,
      currency: "GHS",
      status: PaymentRefundStatus.PROCESSED,
      providerStatus: "processed",
      requestedById: IDS.user,
      reason: "Release rehearsal partial refund",
      providerResponse: { status: "processed", id: 171700001 },
      requestedAt: new Date("2026-08-10T00:04:00.000Z"),
      processedAt: new Date("2026-08-10T00:05:00.000Z"),
    },
  });

  await prisma.productionInventoryItem.upsert({
    where: { id: IDS.inventory },
    update: {
      shopId: IDS.shop,
      inventoryKey: "phase17|canary|vinyl",
      kind: ProductionInventoryKind.VINYL,
      name: "Phase 17 Canary HTV",
      colour: "White",
      unit: ProductionInventoryUnit.METRE,
      quantity: 9.5,
      unitCost: 12.8,
      lowStockLevel: 1,
      isActive: true,
    },
    create: {
      id: IDS.inventory,
      shopId: IDS.shop,
      inventoryKey: "phase17|canary|vinyl",
      kind: ProductionInventoryKind.VINYL,
      name: "Phase 17 Canary HTV",
      colour: "White",
      unit: ProductionInventoryUnit.METRE,
      quantity: 9.5,
      unitCost: 12.8,
      lowStockLevel: 1,
      isActive: true,
    },
  });

  await prisma.productionInventoryMovement.upsert({
    where: { id: IDS.movement },
    update: {
      shopId: IDS.shop,
      inventoryItemId: IDS.inventory,
      type: ProductionInventoryMovementType.PRODUCTION_USE,
      quantityDelta: -0.5,
      balanceAfter: 9.5,
      unitCostSnapshot: 12.8,
      referenceType: "PHASE17_RELEASE_REHEARSAL",
      referenceId: IDS.order,
      idempotencyKey: "phase17:release-canary:movement",
      createdById: IDS.user,
    },
    create: {
      id: IDS.movement,
      shopId: IDS.shop,
      inventoryItemId: IDS.inventory,
      type: ProductionInventoryMovementType.PRODUCTION_USE,
      quantityDelta: -0.5,
      balanceAfter: 9.5,
      unitCostSnapshot: 12.8,
      referenceType: "PHASE17_RELEASE_REHEARSAL",
      referenceId: IDS.order,
      idempotencyKey: "phase17:release-canary:movement",
      createdById: IDS.user,
    },
  });

  console.log("Phase 17 release canary seeded.");
}

async function snapshot() {
  const [shop, user, product, variant, customer, order, payment, refund, inventory, movement] = await Promise.all([
    prisma.shop.findUnique({ where: { id: IDS.shop } }),
    prisma.user.findUnique({ where: { id: IDS.user } }),
    prisma.product.findUnique({ where: { id: IDS.product } }),
    prisma.productVariant.findUnique({ where: { id: IDS.variant } }),
    prisma.customer.findUnique({ where: { id: IDS.customer } }),
    prisma.order.findUnique({ where: { id: IDS.order }, include: { items: true, payments: true } }),
    prisma.payment.findUnique({ where: { id: IDS.payment } }),
    prisma.paymentRefund.findUnique({ where: { id: IDS.refund } }),
    prisma.productionInventoryItem.findUnique({ where: { id: IDS.inventory } }),
    prisma.productionInventoryMovement.findUnique({ where: { id: IDS.movement } }),
  ]);
  if (!shop || !user || !product || !variant || !customer || !order || !payment || !refund || !inventory || !movement) {
    throw new Error("Phase 17 canary is incomplete.");
  }
  const payload = {
    shop: { id: shop.id, name: shop.name, slug: shop.slug, isActive: shop.isActive, verificationStatus: shop.verificationStatus, currency: shop.currency, storefrontEnabled: shop.storefrontEnabled, publicOrderingEnabled: shop.publicOrderingEnabled },
    actor: { id: user.id, shopId: user.shopId, email: user.email, role: user.role, isActive: user.isActive },
    product: { id: product.id, name: product.name, basePrice: product.basePrice.toString(), isPersonalizable: product.isPersonalizable },
    variant: { id: variant.id, sku: variant.sku, stockQty: variant.stockQty, priceOverride: variant.priceOverride?.toString() ?? null, attributes: variant.attributes },
    customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email },
    order: { id: order.id, receiptNumber: order.receiptNumber, status: order.status, channel: order.channel, totalAmount: order.totalAmount.toString(), itemCount: order.items.length, paymentCount: order.payments.length },
    payment: { id: payment.id, method: payment.method, status: payment.status, amount: payment.amount.toString(), providerReference: payment.providerReference, providerChannel: payment.providerChannel, verifiedAt: payment.verifiedAt?.toISOString() ?? null, metadata: payment.metadata },
    refund: { id: refund.id, shopId: refund.shopId, paymentId: refund.paymentId, transactionReference: refund.transactionReference, provider: refund.provider, providerRefundId: refund.providerRefundId, providerRefundReference: refund.providerRefundReference, amount: refund.amount.toString(), currency: refund.currency, status: refund.status, providerStatus: refund.providerStatus, requestedById: refund.requestedById, requestedAt: refund.requestedAt.toISOString(), processedAt: refund.processedAt?.toISOString() ?? null },
    inventory: { id: inventory.id, inventoryKey: inventory.inventoryKey, kind: inventory.kind, unit: inventory.unit, quantity: inventory.quantity.toString(), unitCost: inventory.unitCost.toString() },
    movement: { id: movement.id, type: movement.type, quantityDelta: movement.quantityDelta.toString(), balanceAfter: movement.balanceAfter.toString(), unitCostSnapshot: movement.unitCostSnapshot.toString(), referenceId: movement.referenceId, createdById: movement.createdById },
    financialTruth: { orderValue: "80", capturedGross: "80", refunded: "20", collectedNet: "60", materialUsedMetres: "0.5", materialUseCost: "6.4" },
  };
  const canonical = JSON.stringify(payload);
  return { version: 2, sha256: createHash("sha256").update(canonical).digest("hex"), payload };
}

async function capture(path: string) {
  const value = await snapshot();
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(`Phase 17 fingerprint written to ${path}: ${value.sha256}`);
}

async function verify(path: string) {
  const expected = JSON.parse(await readFile(path, "utf8")) as Awaited<ReturnType<typeof snapshot>>;
  const actual = await snapshot();
  if (expected.version !== actual.version || expected.sha256 !== actual.sha256 || JSON.stringify(expected.payload) !== JSON.stringify(actual.payload)) {
    console.error("Expected fingerprint:", JSON.stringify(expected, null, 2));
    console.error("Actual fingerprint:", JSON.stringify(actual, null, 2));
    throw new Error("Phase 17 data fingerprint changed after backup/restore rehearsal.");
  }
  console.log(`Phase 17 fingerprint verified: ${actual.sha256}`);
}

async function main() {
  guard();
  const command = process.argv[2];
  const path = process.argv[3] ?? "phase17-release-fingerprint.json";
  if (command === "seed") return seed();
  if (command === "capture") return capture(path);
  if (command === "verify") return verify(path);
  throw new Error("Usage: tsx scripts/phase17-release-rehearsal.ts <seed|capture|verify> [fingerprint.json]");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });