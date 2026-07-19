import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role, PlanTier, ProductCondition, OrderChannel, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const demoShop = await prisma.shop.upsert({
    where: { slug: "accra-pro-sports" },
    update: {},
    create: {
      name: "Accra Pro Sports",
      slug: "accra-pro-sports",
      logoUrl: "/brand/accra-pro.svg",
      primaryColor: "#0f766e",
      secondaryColor: "#f97316",
      planTier: PlanTier.PRO,
      city: "Accra",
      country: "Ghana",
      currency: "GHS",
      paymentConfig: {
        create: {
          allowCash: true,
          allowCard: true,
          allowMomo: true,
          momoProvider: "Paystack",
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "super@ypms.test" },
    update: { passwordHash },
    create: {
      email: "super@ypms.test",
      passwordHash,
      name: "YPMS Super Admin",
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  const users = [
    ["owner@accra.test", "Ama Mensah", Role.OWNER],
    ["manager@accra.test", "Kofi Boateng", Role.MANAGER],
    ["cashier@accra.test", "Esi Adjei", Role.CASHIER],
    ["designer@accra.test", "Nana Print Studio", Role.DESIGNER],
    ["accountant@accra.test", "Yaw Accounts", Role.ACCOUNTANT],
  ] as const;

  for (const [email, name, role] of users) {
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, shopId: demoShop.id, role },
      create: {
        email,
        passwordHash,
        name,
        role,
        shopId: demoShop.id,
        phone: "+233200000000",
      },
    });
  }

  const apparel = await prisma.attributeTemplate.upsert({
    where: { shopId_name: { shopId: demoShop.id, name: "Apparel" } },
    update: {},
    create: {
      shopId: demoShop.id,
      name: "Apparel",
      fields: {
        create: [
          { name: "Size", type: "SELECT", options: ["XS", "S", "M", "L", "XL", "XXL"], required: true },
          { name: "Color", type: "TEXT", required: true },
          { name: "Material", type: "TEXT" },
        ],
      },
    },
  });

  const equipment = await prisma.attributeTemplate.upsert({
    where: { shopId_name: { shopId: demoShop.id, name: "Equipment" } },
    update: {},
    create: {
      shopId: demoShop.id,
      name: "Equipment",
      fields: {
        create: [
          { name: "Model", type: "TEXT" },
          { name: "Weight", type: "NUMBER" },
          { name: "Warranty", type: "TEXT" },
        ],
      },
    },
  });

  const jerseys = await prisma.category.upsert({
    where: { shopId_name: { shopId: demoShop.id, name: "Team Jerseys" } },
    update: {},
    create: { shopId: demoShop.id, name: "Team Jerseys", attributeTemplateId: apparel.id },
  });

  const boots = await prisma.category.upsert({
    where: { shopId_name: { shopId: demoShop.id, name: "Boots & Equipment" } },
    update: {},
    create: { shopId: demoShop.id, name: "Boots & Equipment", attributeTemplateId: equipment.id },
  });

  const services = await prisma.category.upsert({
    where: { shopId_name: { shopId: demoShop.id, name: "Services" } },
    update: {},
    create: { shopId: demoShop.id, name: "Services" },
  });

  const productData = [
    {
      categoryId: jerseys.id,
      name: "Home Match Jersey",
      brand: "YPMS Elite",
      condition: ProductCondition.NEW,
      isPersonalizable: true,
      basePrice: "180.00",
      lowStockThreshold: 8,
      variants: [
        { sku: "JER-HOME-S", stockQty: 24, attributes: { size: "S", color: "Emerald" } },
        { sku: "JER-HOME-M", stockQty: 17, attributes: { size: "M", color: "Emerald" } },
        { sku: "JER-HOME-L", stockQty: 5, attributes: { size: "L", color: "Emerald" } },
      ],
    },
    {
      categoryId: jerseys.id,
      name: "Away Training Kit",
      brand: "YPMS Elite",
      condition: ProductCondition.NEW,
      isPersonalizable: true,
      basePrice: "145.00",
      lowStockThreshold: 6,
      variants: [
        { sku: "KIT-AWAY-M", stockQty: 11, attributes: { size: "M", color: "Ivory" } },
        { sku: "KIT-AWAY-XL", stockQty: 2, attributes: { size: "XL", color: "Ivory" } },
      ],
    },
    {
      categoryId: boots.id,
      name: "Turf Control Boots",
      brand: "KenteSport",
      condition: ProductCondition.NEW,
      isRentable: false,
      basePrice: "390.00",
      lowStockThreshold: 4,
      variants: [
        { sku: "BOOT-TURF-42", stockQty: 9, attributes: { size: "42", color: "Black/Gold" } },
        { sku: "BOOT-TURF-43", stockQty: 3, attributes: { size: "43", color: "Black/Gold" } },
      ],
    },
    {
      categoryId: services.id,
      name: "Name & Number Printing",
      brand: "In-house",
      condition: ProductCondition.NEW,
      isService: true,
      basePrice: "55.00",
      serviceDurationMins: 20,
      lowStockThreshold: 0,
      variants: [
        { sku: "SVC-PRINT-NAME-NUMBER", stockQty: 9999, attributes: { service: "printing" } },
      ],
    },
  ];

  for (const item of productData) {
    const existing = await prisma.product.findFirst({
      where: { shopId: demoShop.id, name: item.name },
      include: { variants: true },
    });

    const product = existing ?? await prisma.product.create({
      data: {
        shopId: demoShop.id,
        categoryId: item.categoryId,
        name: item.name,
        brand: item.brand,
        condition: item.condition,
        isPersonalizable: Boolean(item.isPersonalizable),
        isService: Boolean(item.isService),
        isRentable: Boolean(item.isRentable),
        basePrice: item.basePrice,
        serviceDurationMins: item.serviceDurationMins,
        lowStockThreshold: item.lowStockThreshold,
        description: "Seeded demo inventory for the launch-ready sports shop workflow.",
      },
    });

    for (const variant of item.variants) {
      await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: {
          stockQty: variant.stockQty,
          attributes: variant.attributes,
        },
        create: {
          productId: product.id,
          sku: variant.sku,
          stockQty: variant.stockQty,
          attributes: variant.attributes,
        },
      });
    }
  }

  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@accra.test" } });
  const customer = await prisma.customer.upsert({
    where: { id: "demo-customer-akua" },
    update: {},
    create: {
      id: "demo-customer-akua",
      shopId: demoShop.id,
      name: "Akua United FC",
      phone: "+233240000000",
      email: "akua@example.com",
      group: "VIP",
      loyaltyPoints: 240,
    },
  });

  const firstVariant = await prisma.productVariant.findFirstOrThrow({
    where: { product: { shopId: demoShop.id, name: "Home Match Jersey" } },
  });

  const order = await prisma.order.upsert({
    where: { receiptNumber: "APS-10001" },
    update: {},
    create: {
      shopId: demoShop.id,
      customerId: customer.id,
      processedById: owner.id,
      status: OrderStatus.IN_PRODUCTION,
      channel: OrderChannel.POS,
      totalAmount: "360.00",
      receiptNumber: "APS-10001",
      notes: "Rush jersey set for weekend fixture.",
      rush: true,
      items: {
        create: [
          {
            productVariantId: firstVariant.id,
            quantity: 2,
            unitPrice: "180.00",
            personalizationData: { name: "AKUA", number: "10", notes: "Gold letters" },
          },
        ],
      },
      payments: {
        create: {
          method: PaymentMethod.MOMO,
          amount: "360.00",
          status: PaymentStatus.SUCCESS,
          providerReference: "DEMO-PAYSTACK-MOMO",
        },
      },
    },
  });

  await prisma.announcement.create({
    data: {
      shopId: demoShop.id,
      title: "Welcome to the launch workspace",
      body: "Catalog, POS, custom orders, reports, and tenant controls are ready for your team to test.",
    },
  });

  await prisma.auditLog.create({
    data: {
      shopId: demoShop.id,
      userId: owner.id,
      action: "seed.demo_ready",
      entityType: "Order",
      entityId: order.id,
      metadata: { source: "prisma/seed.ts" },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete. Demo password for all accounts: ChangeMe123!");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
