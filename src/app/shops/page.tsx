import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone, RotateCcw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Star, Store } from "lucide-react";
import { Prisma, ShopVerificationStatus } from "@prisma/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { currency } from "@/lib/format";
import { getBuyerSession } from "@/lib/buyer-session";
import { firstProductImage } from "@/lib/product-images";

type Props = {
  searchParams?: Promise<{ q?: string; city?: string; category?: string; ordering?: string; sort?: string }>;
};

export default async function ShopsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const city = params.city?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const ordering = params.ordering === "open" ? "open" : "";
  const sort = ["name", "newest", "products"].includes(params.sort ?? "") ? params.sort ?? "name" : "name";
  const buyer = await getBuyerSession();
  const storefrontWhere: Prisma.ShopWhereInput = {
    isActive: true,
    storefrontEnabled: true,
    verificationStatus: ShopVerificationStatus.VERIFIED,
  };
  const orderBy: Prisma.ShopOrderByWithRelationInput[] = sort === "newest"
    ? [{ createdAt: "desc" }, { name: "asc" }]
    : sort === "products"
      ? [{ products: { _count: "desc" } }, { name: "asc" }]
      : [{ name: "asc" }];

  const [shops, cityOptions, categoryOptions] = await Promise.all([
    prisma.shop.findMany({
      where: {
        ...storefrontWhere,
        ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
        ...(category ? { products: { some: { category: { name: { equals: category, mode: "insensitive" } } } } } : {}),
        ...(ordering ? { publicOrderingEnabled: true } : {}),
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { country: { contains: q, mode: "insensitive" } },
            { products: { some: { name: { contains: q, mode: "insensitive" } } } },
            { products: { some: { brand: { contains: q, mode: "insensitive" } } } },
            { products: { some: { teamName: { contains: q, mode: "insensitive" } } } },
            { products: { some: { category: { name: { contains: q, mode: "insensitive" } } } } },
            { products: { some: { sportType: { contains: q, mode: "insensitive" } } } },
          ],
        } : {}),
      },
      include: {
        products: {
          include: { variants: { orderBy: { createdAt: "asc" }, take: 1 } },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        _count: { select: { products: true, productReviews: true } },
      },
      orderBy,
    }),
    prisma.shop.findMany({
      where: { ...storefrontWhere, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    prisma.category.findMany({
      where: { shop: storefrontWhere, products: { some: {} } },
      select: { name: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
    }),
  ]);

  const hasFilters = Boolean(q || city || category || ordering || sort !== "name");

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/shops" className="flex items-center gap-3">
            <div className="rounded-xl bg-[#081528] p-3 text-white"><Store size={22} /></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700">Verified sports shops</p><h1 className="text-xl font-semibold">EJM Marketplace</h1></div>
          </Link>
          <div className="flex items-center gap-2">
            {buyer ? (
              <>
                <Badge tone="green">{buyer.name}</Badge>
                <Link href="/buyer/security" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:text-cyan-700" title="Buyer account security" aria-label="Open buyer account security"><ShieldCheck size={17} /></Link>
                <LogoutButton buyer label="Log out" className="border border-slate-200 bg-white text-slate-800 hover:bg-red-50 hover:text-red-700" />
              </>
            ) : (
              <div className="flex items-center gap-2"><Link className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" href="/buyer/login?next=/shops">Buyer login</Link><Link className="rounded-xl bg-[#081528] px-3 py-2 text-sm font-semibold text-white" href="/buyer/register?next=/shops">Create account</Link></div>
            )}
            <Link className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold sm:inline-flex" href="/login">Staff</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div><h2 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">Search verified shops, jerseys and sports equipment.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Use filters to narrow by location, category, ordering availability and catalogue size. Sign in only when ordering, rating, messaging, verifying delivery or collecting a pickup.</p></div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><SlidersHorizontal size={17} className="text-cyan-700" /><h3 className="font-semibold">Marketplace filters</h3></div><p className="text-xs font-semibold text-slate-500">{shops.length} result{shops.length === 1 ? "" : "s"}</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_220px_190px_180px_auto]">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search size={17} className="shrink-0 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" name="q" placeholder="Shop, team, brand or item" defaultValue={q} /></label>
            <select className="field" name="city" defaultValue={city}><option value="">All locations</option>{cityOptions.flatMap((item) => item.city ? [<option key={item.city} value={item.city}>{item.city}</option>] : [])}</select>
            <select className="field" name="category" defaultValue={category}><option value="">All categories</option>{categoryOptions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
            <select className="field" name="ordering" defaultValue={ordering}><option value="">Any storefront</option><option value="open">Ordering open</option></select>
            <select className="field" name="sort" defaultValue={sort}><option value="name">Shop name A-Z</option><option value="newest">Newest shops</option><option value="products">Largest catalogues</option></select>
            <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#081528] px-4 text-sm font-semibold text-white">Apply</button>
          </div>
          {hasFilters ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-slate-500">Active:</span>{q ? <Badge>Search: {q}</Badge> : null}{city ? <Badge>Location: {city}</Badge> : null}{category ? <Badge>Category: {category}</Badge> : null}{ordering ? <Badge tone="green">Ordering open</Badge> : null}{sort !== "name" ? <Badge>Sort: {sort}</Badge> : null}<Link href="/shops" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 font-semibold text-slate-600"><RotateCcw size={13} /> Clear filters</Link></div> : null}
        </form>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => {
            const firstProduct = shop.products[0];
            const hero = firstProduct ? firstProductImage(firstProduct.images) : null;
            return (
              <article key={shop.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex aspect-[16/9] items-center justify-center bg-slate-100 bg-cover bg-center" style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
                  {!hero ? <Image src={shop.logoUrl || "/brand/ejm-mark.svg"} alt={shop.name} width={72} height={72} className="rounded-xl" /> : null}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{shop.name}</h3><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} /> {shop.city ?? "Online"} {shop.country ? `- ${shop.country}` : ""}</p></div><Badge tone="green"><ShieldCheck size={13} /> Verified</Badge></div>
                  <div className="mt-3 flex flex-wrap gap-2"><Badge tone={shop.publicOrderingEnabled ? "green" : "orange"}>{shop.publicOrderingEnabled ? "Ordering open" : "Browse only"}</Badge><Badge>{shop._count.products} products</Badge><Badge tone="orange"><Star size={12} /> {shop._count.productReviews} reviews</Badge></div>
                  <div className="mt-4 grid gap-2">
                    {shop.products.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-3 py-2 text-sm"><span className="min-w-0 truncate font-semibold">{product.name}</span><span className="shrink-0 text-slate-600">{currency(product.variants[0]?.priceOverride?.toString() ?? product.basePrice.toString(), shop.currency)}</span></div>)}
                    {!shop.products.length ? <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500">Catalogue coming soon</p> : null}
                  </div>
                  <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><p className="flex items-center gap-2"><Phone size={13} /> {shop.credentialPhone ?? "Phone available after shop setup"}</p><p className="flex items-center gap-2"><Mail size={13} /> {shop.credentialEmail ?? "Email not listed"}</p><p className="flex items-center gap-2"><MapPin size={13} /> {shop.credentialAddress ?? `${shop.city ?? "Online"}${shop.country ? `, ${shop.country}` : ""}`}</p></div>
                  <Link className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#081528] px-3 text-sm font-semibold text-white" href={`/shop/${shop.slug}`}>Open shop <ShoppingBag size={15} /></Link>
                  <Link className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800" href={buyer ? `/shop/${shop.slug}/chat` : `/buyer/login?next=/shop/${shop.slug}/chat`}><MessageCircle size={15} /> {buyer ? "Chat with shop" : "Login to message"}</Link>
                </div>
              </article>
            );
          })}
        </div>
        {!shops.length ? <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No verified shop matched these filters. Clear one or more filters and try again.</div> : null}
      </section>
    </main>
  );
}
