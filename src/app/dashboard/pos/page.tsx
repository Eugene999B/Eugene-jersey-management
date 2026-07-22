import { PosTerminal } from "@/components/pos/pos-terminal";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { firstProductImage } from "@/lib/product-images";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export default async function PosPage() {
  await requireRole(permissions.pos);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [products, customers] = await Promise.all([
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
  ]);

  return (
    <PosTerminal
      currencyCode={shop.currency}
      customers={customers}
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category.name,
        brand: product.brand,
        imageUrl: firstProductImage(product.images),
        isPersonalizable: product.isPersonalizable,
        isService: product.isService,
        basePrice: Number(product.basePrice),
        variants: product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          stockQty: variant.stockQty,
          attributes: variant.attributes as Record<string, unknown>,
          price: Number(variant.priceOverride ?? product.basePrice),
        })),
      }))}
    />
  );
}
