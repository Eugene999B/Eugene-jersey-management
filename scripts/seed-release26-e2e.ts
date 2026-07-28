import "dotenv/config";
import { PlanTier, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

const applicationEmails = [
  "release26-shop-applicant@ejm.test",
  "release26-supplier-applicant@ejm.test",
];

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Release 26 browser seeding is allowed only with E2E_TESTING=true outside production.");
  }

  await prisma.businessApplication.deleteMany({
    where: { email: { in: applicationEmails } },
  });
  await prisma.shop.deleteMany({
    where: { slug: { in: ["ejm-e2e-approved-shop"] } },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { in: applicationEmails } },
        { adminLoginId: { in: ["EJM-E2E-APPROVED-SHOP", "EJM-E2E-APPROVED-SUPPLIER"] } },
      ],
    },
  });
  await prisma.rateLimitBucket.deleteMany({
    where: { key: { startsWith: "application:" } },
  });

  await prisma.subscriptionPlan.upsert({
    where: { tier: PlanTier.BASIC },
    update: {
      name: "E2E Application Plan",
      description: "Disposable configured plan for Release 26 browser acceptance.",
      currency: "GHS",
      monthlyPrice: 100,
      yearlyPrice: 1000,
      trialDays: 14,
      gracePeriodDays: 7,
      includedStaffAccounts: 10,
      maxProducts: 1000,
      maxOrdersPerMonth: 10000,
      features: ["pos", "inventory", "marketplace"],
      isConfigured: true,
      isPublic: true,
      isActive: true,
    },
    create: {
      tier: PlanTier.BASIC,
      name: "E2E Application Plan",
      description: "Disposable configured plan for Release 26 browser acceptance.",
      currency: "GHS",
      monthlyPrice: 100,
      yearlyPrice: 1000,
      trialDays: 14,
      gracePeriodDays: 7,
      includedStaffAccounts: 10,
      maxProducts: 1000,
      maxOrdersPerMonth: 10000,
      features: ["pos", "inventory", "marketplace"],
      isConfigured: true,
      isPublic: true,
      isActive: true,
    },
  });

  console.log("Release 26 business application fixtures are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
