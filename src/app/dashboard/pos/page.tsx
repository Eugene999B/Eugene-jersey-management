import { PosTerminal } from "@/components/pos/pos-terminal";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { firstProductImage } from "@/lib/product-images";
import { activeProductVariants } from "@/lib/product-variants";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export default async function PosPage() {
  await requireRole(permissions.pos);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [products, customers, openDebts] = await Promise.all([
    prisma.product.findMany({
      where: { shopId: shop.id },
      include: { category: true, variants: { orderBy: { createdAt: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { shopId: shop.id },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.debt.findMany({
      where: { shopId: shop.id, status: { notIn: ["PAID", "WRITTEN_OFF"] } },
      select: { customerId: true, principalAmount: true, paidAmount: true },
    }),
  ]);
  const outstandingByCustomer = new Map<string, number>();
  for (const debt of openDebts) {
    outstandingByCustomer.set(
      debt.customerId,
      (outstandingByCustomer.get(debt.customerId) ?? 0) + Number(debt.principalAmount) - Number(debt.paidAmount),
    );
  }

  const posProducts = products.flatMap((product) => {
    const variants = activeProductVariants(product.variants);
    if (!variants.length) return [];
    return [{
      id: product.id,
      name: product.name,
      itemType: product.productType ?? (product.isService ? "Service" : product.isRentable ? "Rental asset" : "Stocked product"),
      category: product.category.name,
      brand: product.brand,
      imageUrl: firstProductImage(product.images),
      isPersonalizable: product.isPersonalizable,
      isService: product.isService,
      basePrice: Number(product.basePrice),
      variants: variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        stockQty: variant.stockQty,
        attributes: variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes)
          ? variant.attributes as Record<string, unknown>
          : {},
        price: Number(variant.priceOverride ?? product.basePrice),
      })),
    }];
  });

  return (
    <PosTerminal
      currencyCode={shop.currency}
      customers={customers.map((customer) => ({ ...customer, outstandingBalance: outstandingByCustomer.get(customer.id) ?? 0 }))}
      products={posProducts}
    />
  );
}
