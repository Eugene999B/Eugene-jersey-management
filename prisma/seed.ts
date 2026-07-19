import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role, PlanTier, ProductCondition, OrderChannel, OrderStatus, PaymentMethod, PaymentStatus, ShopVerificationStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

async function main() {
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Ghana123";
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const demoShop = await prisma.shop.upsert({
    where: { slug: "accra-pro-sports" },
    update: {
      networkCode: "APS-001",
      staffLoginId: "APS-STAFF",
      verificationStatus: ShopVerificationStatus.VERIFIED,
      legalBusinessName: "Accra Pro Sports Limited",
      businessRegistrationNumber: "RGD-APS-2026",
      taxIdentificationNumber: "TIN-APS-0001",
      ownerGovernmentId: "GHANA-CARD-DEMO-APS",
      credentialContactName: "Ama Mensah",
      credentialPhone: "+233200000001",
      credentialEmail: "owner@accra.test",
      credentialAddress: "Osu Sports Avenue, Accra, Ghana",
      verifiedAt: new Date(),
      storefrontEnabled: true,
      publicOrderingEnabled: true,
      paymentConfig: {
        upsert: {
          create: {
            allowCash: true,
            allowCard: true,
            allowMomo: true,
            momoProvider: "Paystack",
            paystackChargeBearer: "subaccount",
          },
          update: {
            allowCash: true,
            allowCard: true,
            allowMomo: true,
            momoProvider: "Paystack",
            paystackChargeBearer: "subaccount",
          },
        },
      },
    },
    create: {
      name: "Accra Pro Sports",
      slug: "accra-pro-sports",
      logoUrl: "/brand/accra-pro.svg",
      primaryColor: "#0f766e",
      secondaryColor: "#f97316",
      networkCode: "APS-001",
      staffLoginId: "APS-STAFF",
      verificationStatus: ShopVerificationStatus.VERIFIED,
      legalBusinessName: "Accra Pro Sports Limited",
      businessRegistrationNumber: "RGD-APS-2026",
      taxIdentificationNumber: "TIN-APS-0001",
      ownerGovernmentId: "GHANA-CARD-DEMO-APS",
      credentialContactName: "Ama Mensah",
      credentialPhone: "+233200000001",
      credentialEmail: "owner@accra.test",
      credentialAddress: "Osu Sports Avenue, Accra, Ghana",
      verifiedAt: new Date(),
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
          paystackChargeBearer: "subaccount",
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "super@ypms.test" },
    update: {
      passwordHash,
      failedLoginCount: 0,
      lockUntil: null,
      isActive: true,
    },
    create: {
      email: "super@ypms.test",
      passwordHash,
      name: "YPMS Super Admin",
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  const users = [
    ["owner@accra.test", "Ama Mensah", Role.OWNER, "+233200000001"],
    ["manager@accra.test", "Kofi Boateng", Role.MANAGER, "+233200000002"],
    ["cashier@accra.test", "Esi Adjei", Role.CASHIER, "+233200000003"],
    ["designer@accra.test", "Nana Print Studio", Role.DESIGNER, "+233200000004"],
    ["accountant@accra.test", "Yaw Accounts", Role.ACCOUNTANT, "+233200000005"],
  ] as const;

  for (const [email, name, role, phone] of users) {
    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        shopId: demoShop.id,
        role,
        phone,
        failedLoginCount: 0,
        lockUntil: null,
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        name,
        role,
        shopId: demoShop.id,
        phone,
      },
    });
  }

  const supplierUser = await prisma.user.upsert({
    where: { email: "supplier@accra.test" },
    update: {
      passwordHash,
      shopId: demoShop.id,
      role: Role.SUPPLIER,
      failedLoginCount: 0,
      lockUntil: null,
      isActive: true,
    },
    create: {
      email: "supplier@accra.test",
      passwordHash,
      name: "Elite Kits Supply",
      role: Role.SUPPLIER,
      shopId: demoShop.id,
      phone: "+233270000000",
      isActive: true,
    },
  });

  const demoSupplier = await prisma.supplier.upsert({
    where: { id: "demo-supplier-elitekits" },
    update: {
      shopId: demoShop.id,
      portalUserId: supplierUser.id,
      name: "Elite Kits Supply",
      contactName: "Mavis Osei",
      email: "supplier@accra.test",
      phone: "+233270000000",
      categories: "Blank jerseys, HTV vinyl, heat press supplies",
      paymentTerms: "50% deposit, balance on delivery",
      leadTimeDays: 5,
      rating: 5,
      isActive: true,
    },
    create: {
      id: "demo-supplier-elitekits",
      shopId: demoShop.id,
      portalUserId: supplierUser.id,
      name: "Elite Kits Supply",
      contactName: "Mavis Osei",
      email: "supplier@accra.test",
      phone: "+233270000000",
      categories: "Blank jerseys, HTV vinyl, heat press supplies",
      paymentTerms: "50% deposit, balance on delivery",
      leadTimeDays: 5,
      rating: 5,
    },
  });

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

  const balls = await prisma.category.upsert({
    where: { shopId_name: { shopId: demoShop.id, name: "Balls & Training" } },
    update: {},
    create: { shopId: demoShop.id, name: "Balls & Training", attributeTemplateId: equipment.id },
  });

  const protection = await prisma.category.upsert({
    where: { shopId_name: { shopId: demoShop.id, name: "Protective Gear" } },
    update: {},
    create: { shopId: demoShop.id, name: "Protective Gear", attributeTemplateId: equipment.id },
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
      productType: "Team jersey",
      sportType: "Football",
      teamName: "Accra Pro",
      sizeGuide: ["S", "M", "L", "XL", "XXL"],
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
      productType: "Custom print jersey",
      sportType: "Football",
      teamName: "Training",
      sizeGuide: ["XS", "S", "M", "L", "XL"],
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
      productType: "Football boots",
      sportType: "Football",
      teamName: "",
      sizeGuide: ["EU 40", "EU 41", "EU 42", "EU 43", "EU 44"],
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
      categoryId: balls.id,
      name: "FIFA Quality Football",
      brand: "KenteSport",
      productType: "Ball",
      sportType: "Football",
      teamName: "",
      sizeGuide: ["Size 4", "Size 5"],
      condition: ProductCondition.NEW,
      isPersonalizable: false,
      basePrice: "120.00",
      lowStockThreshold: 10,
      variants: [
        { sku: "BALL-FIFA-4", stockQty: 18, attributes: { size: "4", color: "White/Orange", equipmentGroup: "Match ball" } },
        { sku: "BALL-FIFA-5", stockQty: 25, attributes: { size: "5", color: "White/Orange", equipmentGroup: "Match ball" } },
      ],
    },
    {
      categoryId: protection.id,
      name: "Carbon Shin Guards",
      brand: "SafePlay",
      productType: "Protective gear",
      sportType: "Football",
      teamName: "",
      sizeGuide: ["S", "M", "L"],
      condition: ProductCondition.NEW,
      isPersonalizable: false,
      basePrice: "75.00",
      lowStockThreshold: 6,
      variants: [
        { sku: "SHIN-CARBON-S", stockQty: 14, attributes: { size: "S", color: "Black", equipmentGroup: "Shin guards" } },
        { sku: "SHIN-CARBON-M", stockQty: 10, attributes: { size: "M", color: "Black", equipmentGroup: "Shin guards" } },
        { sku: "SHIN-CARBON-L", stockQty: 4, attributes: { size: "L", color: "Black", equipmentGroup: "Shin guards" } },
      ],
    },
    {
      categoryId: balls.id,
      name: "Agility Cone Set",
      brand: "CoachLine",
      productType: "Training cone",
      sportType: "General",
      teamName: "",
      sizeGuide: ["20-pack", "50-pack"],
      condition: ProductCondition.NEW,
      isPersonalizable: false,
      basePrice: "95.00",
      lowStockThreshold: 5,
      variants: [
        { sku: "CONE-SET-20", stockQty: 12, attributes: { size: "20-pack", color: "Orange", equipmentGroup: "Training" } },
        { sku: "CONE-SET-50", stockQty: 6, attributes: { size: "50-pack", color: "Mixed", equipmentGroup: "Training" } },
      ],
    },
    {
      categoryId: services.id,
      name: "Name & Number Printing",
      brand: "In-house",
      productType: "Service",
      sportType: "General",
      teamName: "",
      sizeGuide: [],
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

    const productDataBase = {
        shopId: demoShop.id,
        categoryId: item.categoryId,
        name: item.name,
        brand: item.brand,
        productType: item.productType,
        sportType: item.sportType,
        teamName: item.teamName,
        sizeGuide: item.sizeGuide,
        condition: item.condition,
        isPersonalizable: Boolean(item.isPersonalizable),
        isService: Boolean(item.isService),
        isRentable: Boolean(item.isRentable),
        basePrice: item.basePrice,
        serviceDurationMins: item.serviceDurationMins,
        lowStockThreshold: item.lowStockThreshold,
        description: "Seeded demo inventory for the launch-ready sports shop workflow.",
    };

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: productDataBase,
        })
      : await prisma.product.create({
          data: productDataBase,
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

  const demoBuyer = await prisma.buyerAccount.upsert({
    where: { phone: "+233550000000" },
    update: {
      name: "Demo Buyer",
      email: "buyer@demo.test",
      phoneVerifiedAt: new Date(),
      isActive: true,
    },
    create: {
      name: "Demo Buyer",
      phone: "+233550000000",
      email: "buyer@demo.test",
      phoneVerifiedAt: new Date(),
      isActive: true,
    },
  });

  const reviewProducts = await prisma.product.findMany({
    where: { shopId: demoShop.id, name: { in: ["Home Match Jersey", "FIFA Quality Football"] } },
  });

  for (const product of reviewProducts) {
    await prisma.productReview.upsert({
      where: { productId_buyerId: { productId: product.id, buyerId: demoBuyer.id } },
      update: {
        rating: product.name === "Home Match Jersey" ? 5 : 4,
        comment: product.name === "Home Match Jersey"
          ? "Good jersey quality and the name print came out clean."
          : "Solid match ball for training and weekend games.",
        isApproved: true,
      },
      create: {
        shopId: demoShop.id,
        productId: product.id,
        buyerId: demoBuyer.id,
        rating: product.name === "Home Match Jersey" ? 5 : 4,
        comment: product.name === "Home Match Jersey"
          ? "Good jersey quality and the name print came out clean."
          : "Solid match ball for training and weekend games.",
      },
    });
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

  await prisma.supplierOrder.upsert({
    where: { orderNumber: "APS-PO-1001" },
    update: {},
    create: {
      shopId: demoShop.id,
      supplierId: demoSupplier.id,
      createdById: owner.id,
      orderNumber: "APS-PO-1001",
      status: "SENT",
      expectedAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      totalAmount: "1250.00",
      notes: "Demo incoming jerseys for supplier portal and receiving workflow.",
      items: {
        create: {
          productVariantId: firstVariant.id,
          description: "Home Match Jersey blanks",
          quantity: 25,
          unitCost: "50.00",
        },
      },
    },
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

  const launchAnnouncement = await prisma.announcement.findFirst({
    where: {
      shopId: demoShop.id,
      title: "Welcome to the launch workspace",
    },
  });

  if (!launchAnnouncement) {
    await prisma.announcement.create({
      data: {
        shopId: demoShop.id,
        title: "Welcome to the launch workspace",
        body: "Catalog, POS, custom orders, reports, and tenant controls are ready for your team to test.",
      },
    });
  }

  const existingSeedLog = await prisma.auditLog.findFirst({
    where: {
      shopId: demoShop.id,
      userId: owner.id,
      action: "seed.demo_ready",
      entityType: "Order",
      entityId: order.id,
    },
  });

  if (!existingSeedLog) {
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
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete. Demo account password was loaded from SEED_DEMO_PASSWORD when provided.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
