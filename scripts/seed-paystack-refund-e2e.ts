import "dotenv/config";
import { PaymentMethod, PaymentRefundStatus, PaymentStatus, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? "") });

const IDS = {
  order: "e2e-paystack-refund-order",
  payment: "e2e-paystack-refund-payment",
  refund: "e2e-paystack-refund-ledger",
} as const;

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Refund browser fixture seeding is allowed only with E2E_TESTING=true outside production.");
  }

  const [shop, owner, variant] = await Promise.all([
    prisma.shop.findUnique({ where: { slug: "ejm-browser-test-shop" } }),
    prisma.user.findUnique({ where: { email: "browser-owner@ejm.test" } }),
    prisma.productVariant.findUnique({ where: { sku: "EJM-P7-BLACK-XL" } }),
  ]);
  if (!shop || !owner || !variant) throw new Error("Run the base E2E seed before the refund fixture seed.");

  await prisma.paymentRefund.deleteMany({ where: { id: IDS.refund } });
  await prisma.paymentRefund.deleteMany({ where: { paymentId: IDS.payment } });
  await prisma.order.deleteMany({ where: { id: IDS.order } });

  await prisma.order.create({
    data: {
      id: IDS.order,
      shopId: shop.id,
      processedById: owner.id,
      status: "COMPLETED",
      channel: "ONLINE",
      totalAmount: 80,
      receiptNumber: "EJM-REFUND-E2E-001",
      publicAccessToken: "ejm-refund-e2e-public-access",
      notes: "Deterministic Paystack refund acceptance fixture.",
      items: {
        create: {
          productVariantId: variant.id,
          quantity: 1,
          unitPrice: 80,
        },
      },
      payments: {
        create: {
          id: IDS.payment,
          method: PaymentMethod.CARD,
          amount: 80,
          status: PaymentStatus.SUCCESS,
          providerReference: "EJM-REFUND-E2E-TXN-001",
          providerChannel: "card",
          gatewayResponse: "Successful",
          verifiedAt: new Date("2026-08-10T12:00:00.000Z"),
          metadata: {
            refundProcessedAmount: 20,
            refundLastProcessedAt: "2026-08-10T12:05:00.000Z",
          },
        },
      },
    },
  });

  await prisma.paymentRefund.create({
    data: {
      id: IDS.refund,
      shopId: shop.id,
      paymentId: IDS.payment,
      transactionReference: "EJM-REFUND-E2E-TXN-001",
      provider: "paystack",
      providerRefundId: "900000001",
      providerRefundReference: "EJM-REFUND-E2E-REF-001",
      amount: 20,
      currency: "GHS",
      status: PaymentRefundStatus.PROCESSED,
      providerStatus: "processed",
      reason: "Browser acceptance partial refund",
      customerNote: "Partial refund fixture",
      merchantNote: "E2E fixture only",
      requestedById: owner.id,
      providerResponse: { status: "processed", id: 900000001 },
      requestedAt: new Date("2026-08-10T12:04:00.000Z"),
      processedAt: new Date("2026-08-10T12:05:00.000Z"),
    },
  });

  console.log(`Refund browser fixture ready: /dashboard/orders/${IDS.order}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
