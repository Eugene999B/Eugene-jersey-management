import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Compass,
  Mail,
  MapPin,
  MessageCircle,
  PackageSearch,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Tags,
  Zap,
} from "lucide-react";
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

function uniqueText(values: Array<string | null | undefined>, limit = 4) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].slice(0, limit);
}

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
          take: 4,
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

  const marketplaceProfiles = shops.length
    ? await prisma.shopMarketplaceProfile.findMany({ where: { shopId: { in: shops.map((shop) => shop.id) } } })
    : [];
  const marketplaceProfileByShop = new Map(marketplaceProfiles.map((profile) => [profile.shopId, profile]));
  const hasFilters = Boolean(q || city || category || ordering || sort !== "name");
  const visibleCities = uniqueText(cityOptions.map((item) => item.city), 6);
  const popularCategories = categoryOptions.slice(0, 6);

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/shops" className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-lg shadow-slate-950/15"><Store size={22} /></div>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">Verified sports commerce</p><h1 className="truncate text-xl font-bold">EJM Marketplace</h1></div>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-800 md:inline-flex" href="/apply/shop">List your shop</Link>
            {buyer ? (
              <>
                <Badge tone="green" className="hidden sm:inline-flex">{buyer.name}</Badge>
                <Link href="/buyer/security" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-800" title="Buyer account security" aria-label="Open buyer account security"><ShieldCheck size={17} /><span className="hidden lg:inline">Security</span></Link>
                <LogoutButton buyer label="Log out" className="border border-slate-200 bg-white text-slate-800 hover:bg-red-50 hover:text-red-700" />
              </>
            ) : (
              <div className="flex items-center gap-2"><Link className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold transition hover:border-cyan-300" href="/buyer/login?next=/shops">Buyer login</Link><Link className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5" href="/buyer/register?next=/shops">Create account</Link></div>
            )}
            <Link className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold sm:inline-flex" href="/login">Staff</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -right-20 -top-16 h-72 w-72 rounded-full bg-orange-400/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-cyan-200"><Sparkles size={14} /> Shop verified sellers across Ghana</div>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[1.04] tracking-tight sm:text-6xl">Find the jersey, team kit or sports item that feels made for you.</h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">Explore shop brands, see complete product photos, compare prices, message sellers and order from trusted sports businesses in one place.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#marketplace-results" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5"><Compass size={17} /> Explore shops</a>
              <Link href="/apply/shop" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10">Grow your brand <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur"><BadgeCheck size={24} className="text-cyan-300" /><p className="mt-5 text-3xl font-black">{shops.length}</p><p className="mt-1 text-xs text-white/55">verified result{shops.length === 1 ? "" : "s"} now</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur"><MapPin size={24} className="text-orange-300" /><p className="mt-5 text-3xl font-black">{cityOptions.length}</p><p className="mt-1 text-xs text-white/55">marketplace locations</p></div>
            <div className="col-span-2 rounded-3xl border border-white/10 bg-gradient-to-r from-cyan-400/10 to-orange-400/10 p-5"><div className="flex items-center gap-2 text-sm font-bold"><Zap size={18} className="text-amber-300" /> Faster shopping decisions</div><p className="mt-2 text-xs leading-5 text-white/60">See the seller&apos;s chosen marketplace photo, logo, product brands, ordering status and recent items before opening the shop.</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <form className="-mt-12 relative z-10 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_26px_70px_rgba(15,23,42,0.14)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="rounded-xl bg-cyan-50 p-2 text-cyan-800"><SlidersHorizontal size={18} /></div><div><h3 className="font-bold">Marketplace filters</h3><p className="text-xs text-slate-500">Search shop, product, team or brand</p></div></div><p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{shops.length} result{shops.length === 1 ? "" : "s"}</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_220px_190px_180px_auto]">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100"><span className="sr-only">Search marketplace</span><Search size={17} className="shrink-0 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" name="q" placeholder="Shop, team, brand or item" defaultValue={q} /></label>
            <select className="field" name="city" defaultValue={city}><option value="">All locations</option>{cityOptions.flatMap((item) => item.city ? [<option key={item.city} value={item.city}>{item.city}</option>] : [])}</select>
            <select className="field" name="category" defaultValue={category}><option value="">All categories</option>{categoryOptions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
            <select className="field" name="ordering" defaultValue={ordering}><option value="">Any storefront</option><option value="open">Ordering open</option></select>
            <select className="field" name="sort" defaultValue={sort}><option value="name">Shop name A-Z</option><option value="newest">Newest shops</option><option value="products">Largest catalogues</option></select>
            <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5">Apply <Search size={15} /></button>
          </div>
          {hasFilters ? <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-slate-500">Active:</span>{q ? <Badge>Search: {q}</Badge> : null}{city ? <Badge>Location: {city}</Badge> : null}{category ? <Badge>Category: {category}</Badge> : null}{ordering ? <Badge tone="green">Ordering open</Badge> : null}{sort !== "name" ? <Badge>Sort: {sort}</Badge> : null}<Link href="/shops" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"><RotateCcw size={13} /> Clear filters</Link></div> : null}
        </form>

        {(popularCategories.length || visibleCities.length) ? <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {popularCategories.length ? <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-bold"><Tags size={16} className="text-cyan-700" /> Browse categories</div><div className="mt-3 flex flex-wrap gap-2">{popularCategories.map((item) => <Link key={item.name} href={`/shops?category=${encodeURIComponent(item.name)}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900">{item.name}</Link>)}</div></div> : null}
          {visibleCities.length ? <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-bold"><MapPin size={16} className="text-orange-600" /> Shop by location</div><div className="mt-3 flex flex-wrap gap-2">{visibleCities.map((item) => <Link key={item} href={`/shops?city=${encodeURIComponent(item)}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900">{item}</Link>)}</div></div> : null}
        </div> : null}

        <div id="marketplace-results" className="mt-8 flex flex-wrap items-end justify-between gap-3 scroll-mt-28"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Discover sellers</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Shop brands worth opening</h2></div><p className="max-w-lg text-sm leading-6 text-slate-500">Every card shows the seller&apos;s chosen brand image or logo, verified status and recent catalogue highlights.</p></div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => {
            const profile = marketplaceProfileByShop.get(shop.id);
            const firstProduct = shop.products[0];
            const automaticProductPhoto = firstProduct ? firstProductImage(firstProduct.images) : null;
            const hero = profile?.heroImageUrl ?? (!shop.logoUrl ? automaticProductPhoto : null);
            const logo = shop.logoUrl || "/brand/ejm-mark.svg";
            const brands = uniqueText(shop.products.map((product) => product.brand), 4);
            const cardStyle = {
              "--market-primary": shop.primaryColor,
              "--market-secondary": shop.secondaryColor,
            } as CSSProperties;

            return (
              <article key={shop.id} style={cardStyle} className="group min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
                <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-cyan-50">
                  <div className="absolute inset-x-0 top-0 z-10 h-1.5" style={{ background: `linear-gradient(90deg, ${shop.primaryColor}, ${shop.secondaryColor})` }} />
                  <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2"><Badge tone="green"><ShieldCheck size={13} /> Verified</Badge><Badge tone={shop.publicOrderingEnabled ? "green" : "orange"}>{shop.publicOrderingEnabled ? "Ordering open" : "Browse only"}</Badge></div>
                  {hero ? (
                    <div className="flex aspect-[16/10] items-center justify-center bg-cover bg-center p-5 transition duration-500 group-hover:scale-[1.02]" role="img" aria-label={`${shop.name} marketplace featured photo`} style={{ backgroundImage: `url(${hero})` }} />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center p-8"><Image src={logo} alt={shop.name} width={190} height={190} className="max-h-40 w-auto rounded-3xl object-contain drop-shadow-sm transition duration-500 group-hover:scale-105" /></div>
                  )}
                  {hero ? <div className="absolute bottom-4 left-4 z-20 rounded-2xl border border-white/80 bg-white/90 p-2 shadow-xl backdrop-blur"><Image src={logo} alt={`${shop.name} logo`} width={58} height={58} className="h-12 w-12 rounded-xl object-contain" /></div> : null}
                  <div className="absolute bottom-4 right-4 z-20 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur">{shop._count.products} products</div>
                </div>

                <div className="p-5">
                  <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-xl font-black tracking-tight">{shop.name}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={14} className="shrink-0" /> <span className="truncate">{shop.city ?? "Online"} {shop.country ? `- ${shop.country}` : ""}</span></p></div><div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800"><Star size={13} /> {shop._count.productReviews}</div></div>
                  <p className="mt-3 min-h-11 text-sm leading-6 text-slate-600">{profile?.tagline || `Explore ${shop.name}'s latest jerseys, sportswear and equipment.`}</p>

                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Brands available</p>
                    <div className="mt-2 flex min-h-8 flex-wrap gap-2">{brands.length ? brands.map((brand) => <span key={brand} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{brand}</span>) : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Brand details coming soon</span>}</div>
                  </div>

                  <div className="mt-5 space-y-2">
                    {shop.products.slice(0, 3).map((product) => {
                      const image = firstProductImage(product.images);
                      return <Link href={`/shop/${shop.slug}`} key={product.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-2.5 transition hover:border-cyan-200 hover:bg-cyan-50/50">
                        <div className="h-12 w-12 shrink-0 rounded-xl bg-white bg-cover bg-center" role="img" aria-label={product.name} style={image ? { backgroundImage: `url(${image})` } : undefined}>{!image ? <PackageSearch size={18} className="m-auto mt-3 text-slate-300" /> : null}</div>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{product.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{product.brand || product.teamName || "Sports product"}</p></div>
                        <span className="shrink-0 text-xs font-bold text-slate-700">{currency(product.variants[0]?.priceOverride?.toString() ?? product.basePrice.toString(), shop.currency)}</span>
                      </Link>;
                    })}
                    {!shop.products.length ? <p className="rounded-2xl bg-slate-50 px-3 py-4 text-sm text-slate-500">Catalogue coming soon</p> : null}
                  </div>

                  <div className="mt-5 grid gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-xs text-slate-600"><p className="flex min-w-0 items-center gap-2"><Phone size={13} className="shrink-0 text-cyan-700" /><span className="truncate">{shop.credentialPhone ?? "Phone available after shop setup"}</span></p><p className="flex min-w-0 items-center gap-2"><Mail size={13} className="shrink-0 text-cyan-700" /><span className="truncate">{shop.credentialEmail ?? "Email not listed"}</span></p></div>
                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                    <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5" href={`/shop/${shop.slug}`}>Open shop <ShoppingBag size={15} /></Link>
                    <Link className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-800 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800" aria-label={`Message ${shop.name}`} title={`Message ${shop.name}`} href={buyer ? `/shop/${shop.slug}/chat` : `/buyer/login?next=/shop/${shop.slug}/chat`}><MessageCircle size={17} /></Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!shops.length ? <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><PackageSearch size={36} className="mx-auto text-slate-300" /><h3 className="mt-4 text-lg font-bold">No verified shop matched these filters</h3><p className="mt-2 text-sm text-slate-500">Clear one or more filters and try another shop, brand, category or location.</p><Link href="/shops" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"><RotateCcw size={15} /> Reset marketplace</Link></div> : null}

        <section className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-700 to-slate-950 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">For sports businesses</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Give your shop a stronger digital storefront.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Create your brand profile, upload a marketplace image, publish products and connect with buyers.</p></div><Link href="/apply/shop" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-950">Apply to join <ArrowRight size={16} /></Link></div>
        </section>
      </section>
    </main>
  );
}
