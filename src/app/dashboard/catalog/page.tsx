import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { ProductCondition } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createCategoryAction, createProductAction } from "@/app/dashboard/catalog/actions";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { hasRole, permissions } from "@/lib/rbac";
import { firstProductImage } from "@/lib/product-images";

type Props = {
  searchParams?: Promise<{ q?: string; category?: string; stock?: string }>;
};

function stockTone(stock: number, threshold: number) {
  if (stock <= 0) return "red";
  if (stock <= threshold) return "orange";
  return "green";
}

const productTypes = [
  "Plain jersey",
  "Team jersey",
  "Custom print jersey",
  "Football boots",
  "Ball",
  "Protective gear",
  "Training cone",
  "Gym equipment",
  "Racket",
  "Gloves",
  "Bottle",
  "Service",
];

const sportTypes = ["Football", "Basketball", "Volleyball", "Tennis", "Running", "Gym", "Boxing", "Swimming", "Cycling", "General"];

const commonSizes = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Kids", "EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "One size"];

export default async function CatalogPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const { session, shop } = await getTenantContext();
  if (!shop) return null;

  const canWrite = hasRole(session, permissions.catalogWrite);
  const [categories, templates, products] = await Promise.all([
    prisma.category.findMany({ where: { shopId: shop.id }, orderBy: { name: "asc" } }),
    prisma.attributeTemplate.findMany({ where: { shopId: shop.id }, include: { fields: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: {
        shopId: shop.id,
        categoryId: params.category || undefined,
        name: params.q ? { contains: params.q, mode: "insensitive" } : undefined,
      },
      include: {
        category: true,
        variants: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const filteredProducts = products.filter((product) => {
    const totalStock = product.variants.reduce((sum, variant) => sum + variant.stockQty, 0);
    if (params.stock === "low") return totalStock <= product.lowStockThreshold;
    if (params.stock === "out") return totalStock === 0;
    return true;
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
      <section className="space-y-5">
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-[var(--shop-primary)]" />
            <h1 className="text-lg font-semibold">Add product</h1>
          </div>
          <form action={createProductAction} className="space-y-3">
            <input className="field" name="name" placeholder="Product name" disabled={!canWrite} required />
            <textarea className="field min-h-20" name="description" placeholder="Description" disabled={!canWrite} />
            <div className="grid grid-cols-2 gap-3">
              <select className="field" name="categoryId" disabled={!canWrite} required>
                <option value="">Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <input className="field" name="brand" placeholder="Brand" disabled={!canWrite} />
            </div>
            <input className="field" name="imageUrl" type="url" placeholder="Product photo URL" disabled={!canWrite} />
            <div className="grid grid-cols-2 gap-3">
              <select className="field" name="productType" disabled={!canWrite}>
                <option value="">Product type</option>
                {productTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select className="field" name="sportType" disabled={!canWrite}>
                <option value="">Sport</option>
                {sportTypes.map((sport) => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="field" name="teamName" placeholder="Team name, if any" disabled={!canWrite} />
              <input className="field" name="equipmentGroup" placeholder="Equipment group" disabled={!canWrite} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select className="field" name="size" disabled={!canWrite}>
                <option value="">Default size</option>
                {commonSizes.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <input className="field" name="color" placeholder="Color or team color" disabled={!canWrite} />
            </div>
            <input className="field" name="sizeGuide" placeholder="Available sizes, comma separated: S, M, L, XL, XXL" disabled={!canWrite} />
            <div className="grid grid-cols-2 gap-3">
              <select className="field" name="condition" defaultValue={ProductCondition.NEW} disabled={!canWrite}>
                {Object.values(ProductCondition).map((condition) => (
                  <option key={condition} value={condition}>{titleCase(condition)}</option>
                ))}
              </select>
              <input className="field" name="basePrice" type="number" min="0" step="0.01" placeholder="Base price" disabled={!canWrite} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input className="field" name="sku" placeholder="SKU" disabled={!canWrite} />
              <input className="field" name="stockQty" type="number" min="0" placeholder="Stock" disabled={!canWrite} required />
              <input className="field" name="lowStockThreshold" type="number" min="0" defaultValue="5" disabled={!canWrite} />
            </div>
            <div className="grid gap-2 text-sm text-slate-700">
              {[
                ["isPersonalizable", "Name/number personalization"],
                ["isService", "Service item"],
                ["isRentable", "Available for rental"],
              ].map(([name, label]) => (
                <label key={name} className="flex items-center gap-2 rounded-[8px] bg-white px-3 py-2">
                  <input name={name} type="checkbox" disabled={!canWrite} />
                  {label}
                </label>
              ))}
            </div>
            <Button className="w-full" disabled={!canWrite}>Create product</Button>
          </form>
        </div>

        <div className="panel p-5">
          <h2 className="text-lg font-semibold">Categories</h2>
          <form action={createCategoryAction} className="mt-4 space-y-3">
            <input className="field" name="name" placeholder="Category name" disabled={!canWrite} required />
            <select className="field" name="attributeTemplateId" disabled={!canWrite}>
              <option value="">No template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.fields.length} fields)
                </option>
              ))}
            </select>
            <Button variant="outline" className="w-full" disabled={!canWrite}>Create category</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category.id}>{category.name}</Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Catalog</h1>
              <p className="text-sm text-slate-500">Flexible products, variants, services, rental flags, and low-stock visibility.</p>
            </div>
            <Badge tone="green">{filteredProducts.length} live</Badge>
          </div>
          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
            <label className="flex items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3">
              <Search size={16} className="text-slate-400" />
              <input className="min-h-10 flex-1 bg-transparent text-sm outline-none" name="q" placeholder="Search product name" defaultValue={params.q ?? ""} />
            </label>
            <select className="field" name="category" defaultValue={params.category ?? ""}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select className="field" name="stock" defaultValue={params.stock ?? ""}>
              <option value="">Any stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
            <Button variant="outline">
              <SlidersHorizontal size={16} /> Filter
            </Button>
          </form>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 2xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const totalStock = product.variants.reduce((sum, variant) => sum + variant.stockQty, 0);
            const image = firstProductImage(product.images);
            return (
              <article key={product.id} className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
                <div
                  aria-label={product.name}
                  className="mb-4 flex aspect-[4/3] w-full items-center justify-center rounded-[8px] bg-[#f6f4ef] bg-cover bg-center text-sm font-semibold text-slate-400"
                  role="img"
                  style={image ? { backgroundImage: `url(${image})` } : undefined}
                >
                  {image ? null : "No photo"}
                </div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-950">{product.name}</h2>
                    <p className="text-sm text-slate-500">{product.category.name} {product.brand ? `- ${product.brand}` : ""}</p>
                  </div>
                  <Badge tone={stockTone(totalStock, product.lowStockThreshold)}>{totalStock} stock</Badge>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge>{titleCase(product.condition)}</Badge>
                  {product.productType ? <Badge>{product.productType}</Badge> : null}
                  {product.sportType ? <Badge tone="blue">{product.sportType}</Badge> : null}
                  {product.teamName ? <Badge tone="orange">{product.teamName}</Badge> : null}
                  {product.isPersonalizable ? <Badge tone="blue">Personalized</Badge> : null}
                  {product.isService ? <Badge tone="orange">Service</Badge> : null}
                  {product.isRentable ? <Badge tone="green">Rental</Badge> : null}
                </div>
                {Array.isArray(product.sizeGuide) && product.sizeGuide.length ? (
                  <p className="mb-3 text-sm text-slate-500">Sizes: {product.sizeGuide.join(", ")}</p>
                ) : null}
                <p className="text-2xl font-semibold">{currency(product.basePrice.toString(), shop.currency)}</p>
                <div className="mt-4 space-y-2">
                  {product.variants.map((variant) => (
                    <div key={variant.id} className="flex items-center justify-between rounded-[8px] bg-[#f6f4ef] px-3 py-2 text-sm">
                      <span className="font-semibold">{variant.sku}</span>
                      <span className="text-slate-600">{variant.stockQty} units</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
