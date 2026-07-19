import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  Bike,
  CreditCard,
  LogIn,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Timer,
  Wallet,
} from "lucide-react";
import { ShopVerificationStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addCartItemAction } from "@/app/cart/actions";
import { createProductReviewAction } from "@/app/shop/[slug]/review-actions";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import { getBuyerSession } from "@/lib/buyer-session";
import { firstProductImage } from "@/lib/product-images";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ q?: string; error?: string }>;
};

const errorCopy: Record<string, string> = {
  invalid: "Check the order details and try again.",
  delivery: "Delivery orders need a delivery address.",
  closed: "This shop is not accepting public orders right now.",
  stock: "That item does not have enough stock right now.",
  review: "The review could not be saved.",
};

function variantLabel(variant: { sku: string; stockQty: number; attributes: unknown }) {
  const attributes = variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes)
    ? Object.entries(variant.attributes as Record<string, unknown>)
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
        .map(([key, value]) => `${titleCase(key)}: ${String(value)}`)
    : [];

  return [variant.sku, ...attributes, `${variant.stockQty} left`].join(" | ");
}

function averageRating(reviews: { rating: number }[]) {
  if (!reviews.length) return null;
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}

export default async function PublicShopPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = (await searchParams)?.q ?? "";
  const errorCode = (await searchParams)?.error;
  const buyer = await getBuyerSession();
  const shop = await prisma.shop.findUnique({
    where: { slug },
    include: {
      products: {
        where: {
          OR: query
            ? [
                { name: { contains: query, mode: "insensitive" } },
                { brand: { contains: query, mode: "insensitive" } },
                { teamName: { contains: query, mode: "insensitive" } },
                { sportType: { contains: query, mode: "insensitive" } },
                { category: { name: { contains: query, mode: "insensitive" } } },
              ]
            : undefined,
        },
        include: {
          category: true,
          variants: { orderBy: { createdAt: "asc" } },
          reviews: {
            where: { isApproved: true },
            include: { buyer: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 4,
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!shop || !shop.isActive || !shop.storefrontEnabled || shop.verificationStatus !== ShopVerificationStatus.VERIFIED) notFound();

  const style = {
    "--shop-primary": shop.primaryColor,
    "--shop-secondary": shop.secondaryColor,
  } as CSSProperties;

  return (
    <main style={style} className="min-h-screen bg-[#f6f4ef]">
      <header className="sticky top-0 z-20 border-b border-[#ded8cd] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <Link href={`/shop/${shop.slug}`} className="flex min-w-0 items-center gap-3">
            <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={42} height={42} className="rounded-[8px]" />
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-semibold uppercase text-[var(--shop-primary)]">
                <ShieldCheck size={13} /> Verified shop
              </p>
              <h1 className="truncate text-lg font-semibold sm:text-xl">{shop.name}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {buyer ? (
              <>
                <Badge tone="green" className="hidden sm:inline-flex">{buyer.name}</Badge>
                <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-3 text-sm font-semibold text-white" href="/cart">
                  <ShoppingBag size={15} /> Cart
                </Link>
              </>
            ) : (
              <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-3 text-sm font-semibold text-white" href={`/buyer/login?next=/shop/${shop.slug}`}>
                <LogIn size={15} /> Login
              </Link>
            )}
            <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm font-semibold" href={`/shop/${shop.slug}/chat`}>
              <MessageCircle size={15} /> Chat
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
          <div className="rounded-[8px] bg-[#111827] p-5 text-white sm:p-7">
            <div className="flex flex-wrap gap-2">
              <Badge tone={shop.publicOrderingEnabled ? "green" : "orange"}>
                {shop.publicOrderingEnabled ? "Online ordering open" : "Browsing only"}
              </Badge>
              <Badge tone="blue">Pickup code</Badge>
              <Badge tone="orange">Card / Mastercard / Visa</Badge>
            </div>
            <h2 className="mt-6 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
              Jerseys, team kits, equipment, and custom print orders.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
              Choose a size or equipment variant, pay online through Paystack, reserve for cash pickup, or chat with the shop before ordering.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <div className="rounded-[8px] border border-white/10 bg-white/[0.06] p-3 text-sm">
                <CreditCard size={18} className="text-[#f97316]" />
                <p className="mt-2 font-semibold">Secure online pay</p>
                <p className="mt-1 text-xs text-white/55">Cards, Mastercard, Visa, and mobile money.</p>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-white/[0.06] p-3 text-sm">
                <PackageCheck size={18} className="text-[#f97316]" />
                <p className="mt-2 font-semibold">Pickup proof</p>
                <p className="mt-1 text-xs text-white/55">Special code plus phone verification.</p>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-white/[0.06] p-3 text-sm">
                <Bike size={18} className="text-[#f97316]" />
                <p className="mt-2 font-semibold">Delivery verify</p>
                <p className="mt-1 text-xs text-white/55">Customer confirms after delivery.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Search size={17} className="text-[var(--shop-primary)]" />
              <h3 className="font-semibold">Find products</h3>
            </div>
            <form className="flex gap-2">
              <input className="field" name="q" placeholder="Search team, item, size, sport" defaultValue={query} />
              <button className="rounded-[8px] bg-[#111827] px-3 text-sm font-semibold text-white">Search</button>
            </form>
            {errorCode ? (
              <p className="mt-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorCopy[errorCode] ?? errorCopy.invalid}
              </p>
            ) : null}
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-[8px] bg-[#f6f4ef] px-3 py-2">
                <span className="font-semibold">Shop ID</span>
                <span>{shop.networkCode ?? shop.slug}</span>
              </div>
              <div className="flex items-center justify-between rounded-[8px] bg-[#f6f4ef] px-3 py-2">
                <span className="font-semibold">Cash hold</span>
                <span>{shop.cashOrderHoldMinutes} minutes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shop.products.map((product) => {
            const image = firstProductImage(product.images);
            const stock = product.variants.reduce((sum, item) => sum + item.stockQty, 0);
            const variants = product.variants.filter((variant) => product.isService || variant.stockQty > 0);
            const rating = averageRating(product.reviews);
            return (
              <article key={product.id} className="overflow-hidden rounded-[8px] border border-[#ded8cd] bg-white">
                <div
                  className="aspect-[4/3] bg-[#e8e2d6] bg-cover bg-center"
                  role="img"
                  aria-label={product.name}
                  style={image ? { backgroundImage: `url(${image})` } : undefined}
                />
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {product.category.name}{product.brand ? ` | ${product.brand}` : ""}
                      </p>
                    </div>
                    <Badge tone={stock > product.lowStockThreshold ? "green" : stock > 0 ? "orange" : "red"}>{product.isService ? "Service" : `${stock} left`}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {product.productType ? <Badge>{product.productType}</Badge> : null}
                    {product.sportType ? <Badge tone="blue">{product.sportType}</Badge> : null}
                    {product.teamName ? <Badge tone="orange">{product.teamName}</Badge> : null}
                    {product.isPersonalizable ? <Badge tone="green">Can customize</Badge> : <Badge>No design needed</Badge>}
                  </div>

                  <p className="text-2xl font-semibold">{currency(variants[0]?.priceOverride?.toString() ?? product.basePrice.toString(), shop.currency)}</p>
                  {rating ? (
                    <p className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                      <Star size={15} className="fill-orange-400 text-orange-400" /> {rating.toFixed(1)} from {product.reviews.length} review{product.reviews.length === 1 ? "" : "s"}
                    </p>
                  ) : null}

                  {shop.publicOrderingEnabled && variants.length && buyer ? (
                    <form action="/api/public-order" method="post" className="space-y-3 rounded-[8px] bg-[#f8fafc] p-3">
                      <input type="hidden" name="shopSlug" value={shop.slug} />
                      <select className="field" name="variantId" required>
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>{variantLabel(variant)}</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        <input className="field" name="quantity" type="number" min="1" max={product.isService ? 100 : Math.max(stock, 1)} defaultValue="1" />
                        <input className="field" name="personalizationName" placeholder="Name" disabled={!product.isPersonalizable} />
                        <input className="field" name="personalizationNumber" placeholder="No." disabled={!product.isPersonalizable} />
                      </div>
                      <textarea className="field min-h-20" name="notes" placeholder="Design notes, preferred size notes, team color, or extra request" />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-2 text-sm font-semibold">
                          <input type="radio" name="fulfillmentType" value="PICKUP" defaultChecked />
                          <Store size={16} /> Pickup
                        </label>
                        <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-2 text-sm font-semibold">
                          <input type="radio" name="fulfillmentType" value="DELIVERY" />
                          <Bike size={16} /> Delivery
                        </label>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className="field" name="deliveryAddress" placeholder="Delivery address" />
                        <input className="field" name="deliveryCity" placeholder="City" />
                        <input className="field" name="deliveryArea" placeholder="Area" />
                        <input className="field" name="deliveryNotes" placeholder="Delivery note" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-2 text-sm font-semibold">
                          <input type="radio" name="paymentChoice" value="PAYSTACK" defaultChecked />
                          <CreditCard size={16} /> Card/MoMo
                        </label>
                        <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-2 text-sm font-semibold">
                          <input type="radio" name="paymentChoice" value="CASH" />
                          <Wallet size={16} /> Cash pickup
                        </label>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button><ShoppingBag size={16} /> Place order</Button>
                        <Button variant="outline" formAction={addCartItemAction}>Add to cart</Button>
                      </div>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Timer size={13} /> Credit is not available online. Shop staff can approve credit only inside POS.
                      </p>
                    </form>
                  ) : shop.publicOrderingEnabled && !buyer ? (
                    <div className="rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-3 text-sm">
                      <p className="font-semibold">Login to buy, rate, or comment.</p>
                      <Link className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-3 font-semibold text-white" href={`/buyer/login?next=/shop/${shop.slug}`}>
                        <LogIn size={15} /> Login as buyer
                      </Link>
                    </div>
                  ) : (
                    <p className="rounded-[8px] bg-[#f6f4ef] p-3 text-sm text-slate-500">Online ordering is currently closed.</p>
                  )}

                  <div className="rounded-[8px] border border-[#ded8cd] p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="font-semibold">Reviews</p>
                      <Badge>{product.reviews.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {product.reviews.slice(0, 2).map((review) => (
                        <div key={review.id} className="rounded-[8px] bg-[#f6f4ef] px-3 py-2 text-sm">
                          <p className="font-semibold">{review.buyer.name} - {review.rating}/5</p>
                          {review.comment ? <p className="mt-1 text-slate-600">{review.comment}</p> : null}
                        </div>
                      ))}
                      {!product.reviews.length ? <p className="text-sm text-slate-500">No reviews yet.</p> : null}
                    </div>

                    {buyer ? (
                      <form action={createProductReviewAction} className="mt-3 grid gap-2">
                        <input type="hidden" name="shopSlug" value={shop.slug} />
                        <input type="hidden" name="productId" value={product.id} />
                        <select className="field" name="rating" defaultValue="5">
                          {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>{value} stars</option>
                          ))}
                        </select>
                        <textarea className="field min-h-16" name="comment" placeholder="Comment on this product" />
                        <Button variant="outline" className="w-full">Save review</Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!shop.products.length ? <p className="mt-5 rounded-[8px] bg-white p-6 text-sm text-slate-500">No products match this search.</p> : null}
      </section>
    </main>
  );
}
