from pathlib import Path

path = Path("scripts/seed-e2e.ts")
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one seed match, found {count}: {old[:160]!r}")
    text = text.replace(old, new, 1)


replace_once(
    '''  owner: {
    email: "browser-owner@ejm.test",
    loginId: "EJM-E2E-OWNER",
    name: "EJM Browser Shop Owner",
  },
  designer: {
''',
    '''  owner: {
    email: "browser-owner@ejm.test",
    loginId: "EJM-E2E-OWNER",
    name: "EJM Browser Shop Owner",
  },
  catalogOwner: {
    email: "browser-catalog-owner@ejm.test",
    loginId: "EJM-E2E-CATALOG",
    name: "EJM Browser Catalogue Owner",
  },
  designer: {
''',
)

replace_once(
    '''  await prisma.user.upsert({
    where: { email: identities.designer.email },
''',
    '''  await prisma.user.upsert({
    where: { email: identities.catalogOwner.email },
    update: {
      adminLoginId: identities.catalogOwner.loginId,
      name: identities.catalogOwner.name,
      passwordHash,
      role: Role.OWNER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
      sessionVersion: 0,
    },
    create: {
      adminLoginId: identities.catalogOwner.loginId,
      email: identities.catalogOwner.email,
      name: identities.catalogOwner.name,
      passwordHash,
      role: Role.OWNER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: identities.designer.email },
''',
)

replace_once(
    '''  await prisma.rateLimitBucket.deleteMany({
    where: { key: { contains: "ejm-e2e" } },
  });
''',
    '''  const phase7Category = await prisma.category.upsert({
    where: { shopId_name: { shopId: shop.id, name: "Phase 7 Catalogue" } },
    update: {},
    create: { shopId: shop.id, name: "Phase 7 Catalogue" },
  });
  await prisma.product.deleteMany({
    where: { shopId: shop.id, name: "Phase 7 exact option item" },
  });
  await prisma.product.create({
    data: {
      shopId: shop.id,
      categoryId: phase7Category.id,
      name: "Phase 7 exact option item",
      brand: "ESM Test",
      productType: "Stocked product",
      condition: "NEW",
      basePrice: 100,
      lowStockThreshold: 2,
      variants: {
        create: [
          {
            sku: "EJM-P7-BLACK-XL",
            stockQty: 5,
            priceOverride: 125,
            attributes: { size: "XL", color: "Black", material: "Cotton", custom_sleeve: "Long" },
          },
          {
            sku: "EJM-P7-BLUE-M",
            stockQty: 0,
            priceOverride: 110,
            attributes: { size: "M", color: "Blue", material: "Cotton" },
          },
        ],
      },
    },
  });

  await prisma.rateLimitBucket.deleteMany({
    where: { key: { contains: "ejm-e2e" } },
  });
''',
)

path.write_text(text)
print("Phase 7 disposable catalogue owner and exact-option item seeded.")
