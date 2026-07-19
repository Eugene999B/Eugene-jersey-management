import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, Search, ShoppingBag, Timer, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { currency } from "@/lib/format";
import { firstProductImage } from "@/lib/product-images";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ q?: string; error?: string }>;
};

export default async function PublicShopPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = (await searchParams)?.q ?? "";
  const shop = await prisma.shop.findUnique({
    where: { slug },
    include: {
      products: {
        where: {
          name: query ? { contains: query, mode: "insensitive" } : undefined,
        },
        include: { category: true, variants: { orderBy: { createdAt: "asc" } } },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!shop || !shop.isActive || !shop.storefrontEnabled) notFound();

  const style = {
    "--shop-primary": shop.primaryColor,
    "--shop-secondary": shop.secondaryColor,
  } as React.CSSProperties;

  return (
    <main style={style} className="min-h-screen bg-[#f6f4ef]">
      <header className="border-b border-[#ded8cd] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href={`/shop/${shop.slug}`} className="flex items-center gap-3">
            <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={44} height={44} className="rounded-[8px]" />
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--shop-primary)]">Official shop</p>
              <h1 className="text-xl font-semibold">{shop.name}</h1>
            </div>
          </Link>
          <Badge tone={shop.publicOrderingEnabled ? "green" : "orange"}>
            {shop.publicOrderingEnabled ? "Online ordering open" : "Browsing only"}
          </Badge>
          <Link className="rounded-[8px] bg-[#111827] px-4 py-2 text-sm font-semibold text-white" href={`/shop/${shop.slug}/chat`}>
            Chat with shop
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div>
            <h2 className="text-3xl font-semibold">Shop catalog</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Search products, order jerseys, add print details, pay online, or reserve for cash pickup.
            </p>
          </div>
          <form className="flex items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input className="min-h-11 flex-1 bg-transparent text-sm outline-none" name="q" placeholder="Search products" defaultValue={query} />
            <button className="text-sm font-semibold text-[var(--shop-primary)]">Search</button>
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shop.products.map((product) => {
            const variant = product.variants[0];
            const image = firstProductImage(product.images);
            const stock = product.variants.reduce((sum, item) => sum + item.stockQty, 0);
            return (
              <article key={product.id} className="rounded-[8px] border border-[#ded8cd] bg-white">
                <div
                  className="aspect-[4/3] rounded-t-[8px] bg-[#e8e2d6] bg-cover bg-center"
                  role="img"
                  aria-label={product.name}
                  style={image ? { backgroundImage: `url(${image})` } : undefined}
                />
                <div className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-slate-500">{product.category.name}</p>
                    </div>
                    <Badge tone={stock > product.lowStockThreshold ? "green" : "orange"}>{stock} left</Badge>
                  </div>
                  <p className="text-2xl font-semibold">{currency(variant?.priceOverride?.toString() ?? product.basePrice.toString(), shop.currency)}</p>
                  {shop.publicOrderingEnabled && variant ? (
                    <form action="/api/public-order" method="post" className="mt-4 space-y-3">
                      <input type="hidden" name="shopSlug" value={shop.slug} />
                      <input type="hidden" name="variantId" value={variant.id} />
                      <input className="field" name="customerName" placeholder="Your name" required />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="field" name="customerPhone" placeholder="Phone" />
                        <input className="field" name="customerEmail" type="email" placeholder="Email" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input className="field" name="quantity" type="number" min="1" max={product.isService ? 100 : Math.max(stock, 1)} defaultValue="1" />
                        <input className="field" name="personalizationName" placeholder="Name" />
                        <input className="field" name="personalizationNumber" placeholder="No." />
                      </div>
                      <textarea className="field min-h-20" name="notes" placeholder="Size, delivery, or design notes" />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-[#f6f4ef] px-2 py-2 text-sm font-semibold">
                          <input type="radio" name="paymentChoice" value="PAYSTACK" defaultChecked />
                          <CreditCard size={16} /> Paystack
                        </label>
                        <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-[#f6f4ef] px-2 py-2 text-sm font-semibold">
                          <input type="radio" name="paymentChoice" value="CASH" />
                          <Wallet size={16} /> Cash
                        </label>
                      </div>
                      <Button className="w-full"><ShoppingBag size={16} /> Place order</Button>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Timer size={13} /> Cash reservations expire after {shop.cashOrderHoldMinutes} minutes.
                      </p>
                    </form>
                  ) : (
                    <p className="mt-4 rounded-[8px] bg-[#f6f4ef] p-3 text-sm text-slate-500">Online ordering is currently closed.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {!shop.products.length ? <p className="rounded-[8px] bg-white p-6 text-sm text-slate-500">No products match this search.</p> : null}
      </section>
    </main>
  );
}
