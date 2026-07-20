import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone, Search, ShieldCheck, ShoppingBag, Star, Store } from "lucide-react";
import { ShopVerificationStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { currency } from "@/lib/format";
import { getBuyerSession } from "@/lib/buyer-session";
import { firstProductImage } from "@/lib/product-images";

type Props = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function ShopsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const buyer = await getBuyerSession();

  const shops = await prisma.shop.findMany({
    where: {
      isActive: true,
      storefrontEnabled: true,
      verificationStatus: ShopVerificationStatus.VERIFIED,
      OR: q
        ? [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { country: { contains: q, mode: "insensitive" } },
            { products: { some: { name: { contains: q, mode: "insensitive" } } } },
            { products: { some: { category: { name: { contains: q, mode: "insensitive" } } } } },
            { products: { some: { sportType: { contains: q, mode: "insensitive" } } } },
          ]
        : undefined,
    },
    include: {
      products: {
        include: { variants: { orderBy: { createdAt: "asc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      _count: { select: { products: true, productReviews: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-[#f6f4ef]">
      <header className="border-b border-[#ded8cd] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/shops" className="flex items-center gap-3">
            <div className="rounded-[8px] bg-[#111827] p-3 text-white">
              <Store size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#0f766e]">Verified sports shops</p>
              <h1 className="text-xl font-semibold">Eugene Marketplace</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {buyer ? (
              <>
                <Badge tone="green">{buyer.name}</Badge>
                <Link className="rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-sm font-semibold" href="/buyer/logout">
                  Logout
                </Link>
              </>
            ) : (
              <Link className="rounded-[8px] bg-[#111827] px-3 py-2 text-sm font-semibold text-white" href="/buyer/login?next=/shops">
                Buyer login
              </Link>
            )}
            <Link className="hidden rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-sm font-semibold sm:inline-flex" href="/login">
              Staff
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div>
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl">
              Search shops, jerseys, football gear, gym equipment, and more.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Browse freely. Login is required only when a customer wants to order, rate, comment, verify delivery, or collect a pickup.
            </p>
          </div>
          <form className="flex h-fit items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3">
            <Search size={17} className="text-slate-400" />
            <input className="min-h-12 flex-1 bg-transparent text-sm outline-none" name="q" placeholder="Search shops or items" defaultValue={q} />
            <button className="rounded-[8px] bg-[#111827] px-3 py-2 text-sm font-semibold text-white">Search</button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => {
            const firstProduct = shop.products[0];
            const hero = firstProduct ? firstProductImage(firstProduct.images) : null;
            return (
              <article key={shop.id} className="overflow-hidden rounded-[8px] border border-[#ded8cd] bg-white">
                <div
                  className="flex aspect-[16/9] items-center justify-center bg-[#e8e2d6] bg-cover bg-center"
                  style={hero ? { backgroundImage: `url(${hero})` } : undefined}
                >
                  {!hero ? <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={72} height={72} className="rounded-[8px]" /> : null}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{shop.name}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin size={14} /> {shop.city ?? "Online"} {shop.country ? `- ${shop.country}` : ""}
                      </p>
                    </div>
                    <Badge tone="green"><ShieldCheck size={13} /> Verified</Badge>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {shop.products.map((product) => (
                      <div key={product.id} className="flex items-center justify-between rounded-[8px] bg-[#f6f4ef] px-3 py-2 text-sm">
                        <span className="font-semibold">{product.name}</span>
                        <span className="text-slate-600">
                          {currency(product.variants[0]?.priceOverride?.toString() ?? product.basePrice.toString(), shop.currency)}
                        </span>
                      </div>
                    ))}
                    {!shop.products.length ? <p className="rounded-[8px] bg-[#f6f4ef] px-3 py-2 text-sm text-slate-500">Catalog coming soon</p> : null}
                  </div>

                  <div className="mt-4 grid gap-2 rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-3 text-xs text-slate-600">
                    <p className="flex items-center gap-2">
                      <Phone size={13} /> {shop.credentialPhone ?? "Phone available after shop setup"}
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail size={13} /> {shop.credentialEmail ?? "Email not listed"}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin size={13} /> {shop.credentialAddress ?? `${shop.city ?? "Online"}${shop.country ? `, ${shop.country}` : ""}`}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge>{shop._count.products} products</Badge>
                      <Badge tone="orange"><Star size={12} /> {shop._count.productReviews} reviews</Badge>
                    </div>
                    <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-3 text-sm font-semibold text-white" href={`/shop/${shop.slug}`}>
                      Shop <ShoppingBag size={15} />
                    </Link>
                  </div>
                  <Link className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm font-semibold text-slate-800" href={buyer ? `/shop/${shop.slug}/chat` : `/buyer/login?next=/shop/${shop.slug}/chat`}>
                    <MessageCircle size={15} /> {buyer ? "Chat with shop" : "Login to message"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {!shops.length ? (
          <div className="mt-6 rounded-[8px] border border-[#ded8cd] bg-white p-6 text-sm text-slate-600">
            No verified shop matched this search yet.
          </div>
        ) : null}
      </section>
    </main>
  );
}
