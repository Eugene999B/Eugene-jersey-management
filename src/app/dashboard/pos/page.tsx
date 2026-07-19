import { PosTerminal } from "@/components/pos/pos-terminal";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { firstProductImage } from "@/lib/product-images";

export default async function PosPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const products = await prisma.product.findMany({
    where: { shopId: shop.id },
    include: {
      category: true,
      variants: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <PosTerminal
      currencyCode={shop.currency}
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
