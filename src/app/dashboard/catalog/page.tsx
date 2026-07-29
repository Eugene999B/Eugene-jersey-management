import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { ProductCondition } from "@prisma/client";
import { ProductVariantFields } from "@/components/catalog/product-variant-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createCategoryAction, createProductAction, updateCategoryAction, updateProductAction } from "@/app/dashboard/catalog/actions";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { hasRole, permissions } from "@/lib/rbac";
import { firstProductImage } from "@/lib/product-images";
import { activeProductVariants, productVariantLabel, productVariantSize } from "@/lib/product-variants";
import { requireRole } from "@/lib/auth";

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

const errorCopy: Record<string, string> = {
  product: "Enter a product name, valid price and at least one size/stock row.",
  "product-update": "Check the product details and size rows, then try again.",
  "category-not-found": "That category is not available in this shop.",
  "product-not-found": "That product or size record could not be found.",
  "sku-exists": "One of the SKUs is already being used. Leave SKU blank for automatic generation or enter a unique value.",
  "plan-product-limit": "This shop has reached the product limit in its assigned plan. Review Subscription & usage before creating another product.",
  "plan-feature": "Inventory and product creation are not included in this shop's assigned plan.",
  "subscription-blocked": "This shop's subscription term or grace period prevents new commercial changes. Review Subscription & usage.",
};

type Props = {
  searchParams?: Promise<{ q?: string; category?: string; stock?: string; error?: string }>;
};

function stockTone(stock: number, threshold: number) {
  if (stock <= 0) return "red";
  if (stock <= threshold) return "orange";
  return "green";
}

function AdvancedProductFields({
  categories,
  product,
  disabled,
}: {
  categories: Array<{ id: string; name: string }>;
  product?: {
    categoryId: string;
    description: string | null;
    brand: string | null;
    productType: string | null;
    sportType: string | null;
    teamName: string | null;
    condition: ProductCondition;
    lowStockThreshold: number;
    isPersonalizable: boolean;
    isService: boolean;
    isRentable: boolean;
  };
  disabled: boolean;
}) {
  return (
    <details className="rounded-xl border border-[#ded8cd] bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold">Optional product details</summary>
      <div className="mt-3 space-y-3">
        <textarea className="field min-h-20" name="description" defaultValue={product?.description ?? ""} placeholder="Description" disabled={disabled} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-600">
            Category <span className="font-normal text-slate-400">(optional)</span>
            <select className="field mt-1" name="categoryId" defaultValue={product?.categoryId ?? ""} disabled={disabled}>
              <option value="">No category — use Uncategorised</option>
              {categories.filter((category) => category.name !== "Uncategorised").map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Brand <span className="font-normal text-slate-400">(optional)</span>
            <input className="field mt-1" name="brand" defaultValue={product?.brand ?? ""} placeholder="Nike, Adidas..." disabled={disabled} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="field" name="productType" defaultValue={product?.productType ?? ""} disabled={disabled}>
            <option value="">Product type (optional)</option>
            {productTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select className="field" name="sportType" defaultValue={product?.sportType ?? ""} disabled={disabled}>
            <option value="">Sport (optional)</option>
            {sportTypes.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="field" name="teamName" defaultValue={product?.teamName ?? ""} placeholder="Team name (optional)" disabled={disabled} />
          <input className="field" name="color" placeholder="Main colour (optional)" disabled={disabled} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="field" name="condition" defaultValue={product?.condition ?? ProductCondition.NEW} disabled={disabled}>
            {Object.values(ProductCondition).map((condition) => <option key={condition} value={condition}>{titleCase(condition)}</option>)}
          </select>
          <input className="field" name="lowStockThreshold" type="number" min="0" defaultValue={product?.lowStockThreshold ?? 5} placeholder="Low stock alert level" disabled={disabled} />
        </div>
        <input className="field" name="imageUrl" type="url" placeholder="Optional photo URL when no file is uploaded" disabled={disabled} />
        <div className="grid gap-2 text-sm text-slate-700">
          <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><input name="isPersonalizable" type="checkbox" defaultChecked={product?.isPersonalizable ?? false} disabled={disabled} />Name/number personalization</label>
          <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><input name="isService" type="checkbox" defaultChecked={product?.isService ?? false} disabled={disabled} />Service item — stock is not limited</label>
          <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><input name="isRentable" type="checkbox" defaultChecked={product?.isRentable ?? false} disabled={disabled} />Available for rental</label>
        </div>
      </div>
    </details>
  );
}

export default async function CatalogPage({ searchParams }: Props) {
  await requireRole(permissions.catalogRead);
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
      include: { category: true, variants: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const filteredProducts = products.filter((product) => {
    const variants = activeProductVariants(product.variants);
    const totalStock = product.isService ? 1 : variants.reduce((sum, variant) => sum + variant.stockQty, 0);
    if (params.stock === "low") return !product.isService && totalStock <= product.lowStockThreshold;
    if (params.stock === "out") return !product.isService && totalStock === 0;
    return true;
  });

  return (
    <div className="space-y-5">
      {params.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{errorCopy[params.error] ?? "The catalog change could not be saved."}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <section className="space-y-5">
          <div className="panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plus size={18} className="text-[var(--shop-primary)]" />
              <div><h1 className="text-lg font-semibold">Add product</h1><p className="mt-1 text-xs text-slate-500">Only the name and base price are essential. Category and all other details are optional.</p></div>
            </div>
            <form action={createProductAction} encType="multipart/form-data" className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Product name<input className="field mt-1" name="name" placeholder="Manchester United away jersey 2012" disabled={!canWrite} required /></label>
              <label className="block text-sm font-semibold text-slate-700">Base price<input className="field mt-1" name="basePrice" type="number" min="0.01" step="0.01" placeholder="0.00" disabled={!canWrite} required /></label>
              <label className="block rounded-xl border border-[#ded8cd] bg-white p-3 text-sm">
                <span className="mb-2 block font-semibold text-slate-700">Product photo <span className="font-normal text-slate-400">(optional)</span></span>
                <input className="block w-full text-sm" name="photo" type="file" accept="image/*,.heic,.heif,.tif,.tiff,.svg" disabled={!canWrite} />
                <span className="mt-2 block text-xs text-slate-500">The image is compressed and stored automatically.</span>
              </label>
              <ProductVariantFields disabled={!canWrite} />
              <AdvancedProductFields categories={categories} disabled={!canWrite} />
              <Button className="w-full" disabled={!canWrite}>Create product</Button>
            </form>
          </div>

          <div className="panel p-5">
            <h2 className="text-lg font-semibold">Categories</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Categories are optional. They organise filters and reports; leaving the field empty places a product under Uncategorised automatically.</p>
            <form action={createCategoryAction} className="mt-4 space-y-3">
              <input className="field" name="name" placeholder="Category name" disabled={!canWrite} required />
              <select className="field" name="attributeTemplateId" disabled={!canWrite}>
                <option value="">No template</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name} ({template.fields.length} fields)</option>)}
              </select>
              <Button variant="outline" className="w-full" disabled={!canWrite}>Create category</Button>
            </form>
            <div className="mt-4 space-y-2">
              {categories.map((category) => (
                <details key={category.id} className="rounded-lg border border-[#ded8cd] bg-white p-3">
                  <summary className="cursor-pointer text-sm font-semibold">{category.name} <span className="text-xs font-normal text-slate-500">— edit</span></summary>
                  <form action={updateCategoryAction} className="mt-3 space-y-2">
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input className="field" name="name" defaultValue={category.name} disabled={!canWrite} required />
                    <select className="field" name="attributeTemplateId" defaultValue={category.attributeTemplateId ?? ""} disabled={!canWrite}>
                      <option value="">No template</option>
                      {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                    </select>
                    <Button variant="outline" className="w-full" disabled={!canWrite}>Save category</Button>
                  </form>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h1 className="text-xl font-semibold">Catalog</h1><p className="text-sm text-slate-500">One product can hold many sizes, with independent stock and optional size prices.</p></div>
              <Badge tone="green">{filteredProducts.length} live</Badge>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
              <label className="flex items-center gap-2 rounded-lg border border-[#ded8cd] bg-white px-3"><Search size={16} className="text-slate-400" /><input className="min-h-10 flex-1 bg-transparent text-sm outline-none" name="q" placeholder="Search product name" defaultValue={params.q ?? ""} /></label>
              <select className="field" name="category" defaultValue={params.category ?? ""}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <select className="field" name="stock" defaultValue={params.stock ?? ""}><option value="">Any stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
              <Button variant="outline"><SlidersHorizontal size={16} />Filter</Button>
            </form>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const variants = activeProductVariants(product.variants);
              const totalStock = product.isService ? 0 : variants.reduce((sum, variant) => sum + variant.stockQty, 0);
              const image = firstProductImage(product.images);
              return (
                <article key={product.id} className="rounded-xl border border-[#ded8cd] bg-white p-4">
                  <div aria-label={product.name} className="mb-4 flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-[#f6f4ef] bg-cover bg-center text-sm font-semibold text-slate-400" role="img" style={image ? { backgroundImage: `url(${image})` } : undefined}>{image ? null : "No photo"}</div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div><h2 className="font-semibold text-slate-950">{product.name}</h2><p className="text-sm text-slate-500">{product.category.name}{product.brand ? ` · ${product.brand}` : ""}</p></div>
                    <Badge tone={product.isService ? "blue" : stockTone(totalStock, product.lowStockThreshold)}>{product.isService ? "Service" : `${totalStock} stock`}</Badge>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2"><Badge>{titleCase(product.condition)}</Badge>{product.productType ? <Badge>{product.productType}</Badge> : null}{product.sportType ? <Badge tone="blue">{product.sportType}</Badge> : null}{product.teamName ? <Badge tone="orange">{product.teamName}</Badge> : null}</div>
                  <p className="text-2xl font-semibold">{currency(product.basePrice.toString(), shop.currency)}</p>
                  <div className="mt-4 space-y-2">
                    {variants.map((variant) => (
                      <div key={variant.id} className="rounded-lg bg-[#f6f4ef] px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2"><span className="font-semibold">{productVariantLabel(variant, { includeStock: false })}</span><span className="text-slate-600">{product.isService ? "Available" : `${variant.stockQty} units`}</span></div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500"><span>{variant.sku}</span>{variant.priceOverride ? <span>{currency(variant.priceOverride.toString(), shop.currency)}</span> : <span>Base price</span>}</div>
                      </div>
                    ))}
                  </div>

                  {canWrite ? (
                    <details className="mt-4 rounded-lg border border-[#ded8cd] bg-[#f9f8f5] p-3">
                      <summary className="cursor-pointer text-sm font-semibold">Edit product and size stock</summary>
                      <form action={updateProductAction} encType="multipart/form-data" className="mt-3 space-y-4">
                        <input type="hidden" name="productId" value={product.id} />
                        <label className="block text-xs font-semibold text-slate-600">Product name<input className="field mt-1" name="name" defaultValue={product.name} required /></label>
                        <label className="block text-xs font-semibold text-slate-600">Base price<input className="field mt-1" name="basePrice" type="number" min="0.01" step="0.01" defaultValue={product.basePrice.toString()} required /></label>
                        <ProductVariantFields initialVariants={variants.map((variant) => ({ id: variant.id, size: productVariantSize(variant.attributes), stockQty: product.isService ? 0 : variant.stockQty, sku: variant.sku, priceOverride: variant.priceOverride?.toString() ?? "" }))} />
                        <label className="block rounded-lg border border-[#ded8cd] bg-white p-2 text-xs"><span className="mb-1 block font-semibold">Replace photo (optional)</span><input name="photo" type="file" accept="image/*,.heic,.heif,.tif,.tiff,.svg" /></label>
                        <AdvancedProductFields categories={categories} product={product} disabled={false} />
                        <Button className="w-full">Save product changes</Button>
                      </form>
                    </details>
                  ) : null}
                </article>
              );
            })}
            {!filteredProducts.length ? <p className="rounded-xl bg-white p-6 text-sm text-slate-500 md:col-span-2 2xl:col-span-3">No products match this filter.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
