import "dotenv/config";
import { BillingCycle, PaymentStatus, PlanTier, Prisma, PrismaClient, SubscriptionInvoiceStatus, SubscriptionStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? "") });

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Release 38 browser seeding is allowed only with E2E_TESTING=true outside production.");
  }
  const shop = await prisma.shop.findUnique({ where: { slug: "ejm-browser-test-shop" } });
  const owner = await prisma.user.findUnique({ where: { email: "browser-release25-owner@ejm.test" } });
  if (!shop || !owner) throw new Error("Run the main and Release 25 E2E seeds before Release 38.");

  const snapshot = {
    tier: PlanTier.PRO,
    name: "EJM Browser Pro",
    description: "Release 38 subscription billing acceptance plan",
    currency: "GHS",
    monthlyPrice: "150.00",
    yearlyPrice: "1500.00",
    trialDays: 14,
    gracePeriodDays: 7,
    includedStaffAccounts: 5,
    maxProducts: 500,
    maxOrdersPerMonth: 1000,
    features: ["STOREFRONT", "POS", "INVENTORY", "DESIGN_STUDIO", "SUPPLIERS", "SHOP_NETWORK", "CUSTOMER_MESSAGING", "ADVANCED_REPORTS"],
    isConfigured: true,
    isPublic: true,
    isActive: true,
    version: 38,
  } satisfies Prisma.InputJsonObject;

  const plan = await prisma.subscriptionPlan.upsert({
    where: { tier: PlanTier.PRO },
    update: {
      name: snapshot.name,
      description: snapshot.description,
      currency: snapshot.currency,
      monthlyPrice: snapshot.monthlyPrice,
      yearlyPrice: snapshot.yearlyPrice,
      trialDays: snapshot.trialDays,
      gracePeriodDays: snapshot.gracePeriodDays,
      includedStaffAccounts: snapshot.includedStaffAccounts,
      maxProducts: snapshot.maxProducts,
      maxOrdersPerMonth: snapshot.maxOrdersPerMonth,
      features: snapshot.features,
      isConfigured: true,
      isPublic: true,
      isActive: true,
      version: snapshot.version,
    },
    create: {
      tier: PlanTier.PRO,
      name: snapshot.name,
      description: snapshot.description,
      currency: snapshot.currency,
      monthlyPrice: snapshot.monthlyPrice,
      yearlyPrice: snapshot.yearlyPrice,
      trialDays: snapshot.trialDays,
      gracePeriodDays: snapshot.gracePeriodDays,
      includedStaffAccounts: snapshot.includedStaffAccounts,
      maxProducts: snapshot.maxProducts,
      maxOrdersPerMonth: snapshot.maxOrdersPerMonth,
      features: snapshot.features,
      isConfigured: true,
      isPublic: true,
      isActive: true,
      version: snapshot.version,
    },
  });

  const dueAt = new Date();
  dueAt.setUTCDate(dueAt.getUTCDate() + 10);
  dueAt.setUTCHours(12, 0, 0, 0);
  const periodEnd = new Date(dueAt);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const contract = await prisma.shopSubscriptionContract.upsert({
    where: { shopId: shop.id },
    update: {
      planId: plan.id,
      planVersion: snapshot.version,
      billingCycle: BillingCycle.MONTHLY,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      monthlyPrice: snapshot.monthlyPrice,
      yearlyPrice: snapshot.yearlyPrice,
      trialEndsAt: null,
      renewalAt: dueAt,
      graceEndsAt: null,
      termsSnapshot: snapshot,
      assignedById: owner.id,
      assignmentReason: "Release 38 browser acceptance contract",
    },
    create: {
      shopId: shop.id,
      planId: plan.id,
      planVersion: snapshot.version,
      billingCycle: BillingCycle.MONTHLY,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      monthlyPrice: snapshot.monthlyPrice,
      yearlyPrice: snapshot.yearlyPrice,
      renewalAt: dueAt,
      termsSnapshot: snapshot,
      assignedById: owner.id,
      assignmentReason: "Release 38 browser acceptance contract",
    },
  });

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      planTier: PlanTier.PRO,
      billingCycle: BillingCycle.MONTHLY,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      monthlyPrice: snapshot.monthlyPrice,
      yearlyPrice: snapshot.yearlyPrice,
      subscriptionRenewalAt: dueAt,
      credentialEmail: owner.email,
    },
  });

  const invoice = await prisma.subscriptionInvoice.upsert({
    where: { invoiceNumber: "EJM-E2E-R38-INVOICE" },
    update: {
      shopId: shop.id,
      contractId: contract.id,
      amount: snapshot.monthlyPrice,
      currency: snapshot.currency,
      billingCycle: BillingCycle.MONTHLY,
      periodStart: dueAt,
      periodEnd,
      dueAt,
      status: SubscriptionInvoiceStatus.OPEN,
      planVersion: snapshot.version,
      planName: snapshot.name,
      description: "EJM Browser Pro monthly subscription renewal",
      termsSnapshot: snapshot,
      nextReminderAt: dueAt,
      voidedAt: null,
      voidReason: null,
      paidAt: null,
    },
    create: {
      shopId: shop.id,
      contractId: contract.id,
      invoiceNumber: "EJM-E2E-R38-INVOICE",
      amount: snapshot.monthlyPrice,
      currency: snapshot.currency,
      billingCycle: BillingCycle.MONTHLY,
      periodStart: dueAt,
      periodEnd,
      dueAt,
      status: SubscriptionInvoiceStatus.OPEN,
      planVersion: snapshot.version,
      planName: snapshot.name,
      description: "EJM Browser Pro monthly subscription renewal",
      termsSnapshot: snapshot,
      nextReminderAt: dueAt,
      createdById: owner.id,
    },
  });

  await prisma.subscriptionPaymentAttempt.upsert({
    where: { reference: "EJM-E2E-R38-FAILED" },
    update: {
      invoiceId: invoice.id,
      shopId: shop.id,
      amount: invoice.amount,
      currency: invoice.currency,
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
      gatewayResponse: "E2E simulated failed attempt",
      createdById: owner.id,
    },
    create: {
      invoiceId: invoice.id,
      shopId: shop.id,
      reference: "EJM-E2E-R38-FAILED",
      amount: invoice.amount,
      currency: invoice.currency,
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
      gatewayResponse: "E2E simulated failed attempt",
      createdById: owner.id,
    },
  });

  console.log(`Release 38 subscription billing ready: ${invoice.invoiceNumber}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
