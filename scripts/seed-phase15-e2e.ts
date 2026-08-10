import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  productionLibraryJson,
  readProductionLibrary,
  upsertProductionResource,
  type ProductionGarmentSpec,
  type ProductionPlacementSpec,
} from "../src/lib/production-specs";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

const SHOP_SLUG = "ejm-browser-test-shop";
const BUYER_PHONE = "+233200000115";
const BUYER_EMAIL = "browser-phase15-buyer@ejm.test";
const PRODUCT_SKU = "EJM-P15-CUSTOM-M";
const GARMENT_ID = "e2e-phase15-garment";
const PLACEMENT_ID = "e2e-phase15-left-chest";

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Phase 15 browser acceptance seeding is allowed only with E2E_TESTING=true outside production.");
  }
  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 12) throw new Error("Set E2E_PASSWORD to a disposable test password of at least 12 characters.");
  const passwordHash = await bcrypt.hash(password, 12);

  const existingShop = await prisma.shop.findUnique({ where: { slug: SHOP_SLUG } });
  if (!existingShop) throw new Error("Run the base E2E seed before the Phase 15 seed.");

  const garment: ProductionGarmentSpec = {
    id: GARMENT_ID,
    name: "E2E Phase 15 Tee",
    garmentType: "T-shirt",
    colour: "Black",
    fabric: "100% cotton",
    sizes: ["M", "L"],
    cost: 25,
    sellingPrice: 80,
    supplier: "E2E Browser Supply Partner",
    maxPressTemperatureC: 170,
    heatRestrictions: "Browser acceptance fixture",
    isActive: true,
  };
  const placement: ProductionPlacementSpec = {
    id: PLACEMENT_ID,
    name: "E2E Phase 15 Left chest",
    location: "LEFT_CHEST",
    garmentId: GARMENT_ID,
    defaultWidthMm: 105,
    defaultHeightMm: 95,
    sizeRules: { M: { widthMm: 105, heightMm: 95 }, L: { widthMm: 110, heightMm: 100 } },
    notes: "Browser acceptance placement fixture.",
    isActive: true,
  };
  const library = readProductionLibrary(existingShop.productionSetup);
  const nextLibrary = {
    ...library,
    garments: upsertProductionResource(library.garments, garment),
    placements: upsertProductionResource(library.placements, placement),
  };
  const enabledModules = [...new Set([
    ...existingShop.enabledModules,
    "MARKETPLACE",
    "ONLINE_SELLING",
    "PRINTING_PRODUCTION",
  ])];
  const shop = await prisma.shop.update({
    where: { id: existingShop.id },
    data: {
      storefrontEnabled: true,
      publicOrderingEnabled: true,
      enabledModules,
      productionSetup: productionLibraryJson(existingShop.productionSetup, nextLibrary),
    },
  });

  await prisma.buyerAccount.upsert({
    where: { phone: BUYER_PHONE },
    update: {
      email: BUYER_EMAIL,
      name: "E2E Phase 15 Buyer",
      passwordHash,
      phoneVerifiedAt: new Date(),
      isActive: true,
    },
    create: {
      phone: BUYER_PHONE,
      email: BUYER_EMAIL,
      name: "E2E Phase 15 Buyer",
      passwordHash,
      phoneVerifiedAt: new Date(),
      isActive: true,
    },
  });

  const category = await prisma.category.upsert({
    where: { shopId_name: { shopId: shop.id, name: "Phase 15 Custom Production" } },
    update: {},
    create: { shopId: shop.id, name: "Phase 15 Custom Production" },
  });
  const existingVariant = await prisma.productVariant.findUnique({ where: { sku: PRODUCT_SKU }, include: { product: true } });
  if (existingVariant && existingVariant.product.shopId !== shop.id) throw new Error(`${PRODUCT_SKU} already belongs to another shop.`);
  if (existingVariant) {
    await prisma.product.update({
      where: { id: existingVariant.productId },
      data: {
        categoryId: category.id,
        name: "E2E Phase 15 Custom Jersey",
        description: "Custom-production browser acceptance listing.",
        brand: "ESM Test",
        condition: "NEW",
        isPersonalizable: true,
        isService: false,
        isRentable: false,
        productType: "Custom jersey",
        basePrice: 80,
      },
    });
    await prisma.productVariant.update({
      where: { id: existingVariant.id },
      data: { stockQty: 10, priceOverride: 80, attributes: { size: "M", colour: "Black", custom: true } },
    });
  } else {
    await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: category.id,
        name: "E2E Phase 15 Custom Jersey",
        description: "Custom-production browser acceptance listing.",
        brand: "ESM Test",
        condition: "NEW",
        isPersonalizable: true,
        isService: false,
        isRentable: false,
        productType: "Custom jersey",
        basePrice: 80,
        variants: {
          create: {
            sku: PRODUCT_SKU,
            stockQty: 10,
            priceOverride: 80,
            attributes: { size: "M", colour: "Black", custom: true },
          },
        },
      },
    });
  }

  console.log("Phase 15 browser acceptance fixtures are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
