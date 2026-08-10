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
import { Prisma, ProductCondition, ShopVerificationStatus } from "@prisma/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { MarketplaceLocationFilters } from "@/components/marketplace/marketplace-location-filters";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { currency } from "@/lib/format";
import { formatGhanaLocation, normaliseLocationToken } from "@/lib/ghana-locations";
import { getBuyerSession } from "@/lib/buyer-session";
import { firstProductImage } from "@/lib/product-images";

type MarketplaceOffer = "ALL" | "PRODUCT" | "SERVICE" | "RENTAL" | "CUSTOM";

type Props = {
  searchParams?: Promise<{
    q?: string;
    region?: string;
    district?: string;
    city?: string;
    suburb?: string;
    category?: string;
    brand?: string;
    team?: string;
    condition?: string;
    availability?: string;
    ordering?: string;
    offer?: string;
    sort?: string;
  }>;
};

const MARKETPLACE_OFFERS: ReadonlySet<MarketplaceOffer> = new Set(["ALL", "PRODUCT", "SERVICE", "RENTAL", "CUSTOM"]);

function uniqueText(values: Array<string | null | undefined>, limit = 4) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].slice(0, limit);
}

function cleanParam(value: string | undefined, maximum = 180) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function offerWhere(offer: MarketplaceOffer): Prisma.ProductWhereInput {
  if (offer === "SERVICE") return { isService: true };
  if (offer === "RENTAL") return { isRentable: true };
  if (offer === "CUSTOM") return { isPersonalizable: true };
  if (offer === "PRODUCT") return { isService: false, isRentable: false, isPersonalizable: false };
  return {};
}

function offerLabel(product: { isService: boolean; isRentable: boolean; isPersonalizable: boolean }) {
  if (product.isPersonalizable) return "Custom production";
  if (product.isRentable) return "Rental";
  if (product.isService) return "Service";
  return "Product";
}

export default async function ShopsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const q = cleanParam(params.q, 180);
  const region = cleanParam(params.region, 100);
  const district = cleanParam(params.district, 180);
  const city = cleanParam(params.city, 160);
  const suburb = cleanParam(params.suburb, 160);
  const category = cleanParam(params.category, 160);
  const brand = cleanParam(params.brand, 160);
  const team = cleanParam(params.team, 160);
  const condition = Object.values(ProductCondition).includes(params.condition as ProductCondition)
    ? params.condition as ProductCondition
    : "";
  const availability = params.availability === "in-stock" ? "in-stock" : "";
  const ordering = params.ordering === "open" ? "open" : "";
  const offerCandidate = String(params.offer ?? "ALL").toUpperCase() as MarketplaceOffer;
  const offer: MarketplaceOffer = MARKETPLACE_OFFERS.has(offerCandidate) ? offerCandidate : "ALL";
  const sort = ["name", "newest", "products"].includes(params.sort ?? "") ? params.sort ?? "name" : "name";
  const buyer = await getBuyerSession();
  const storefrontWhere: Prisma.ShopWhereInput = {
    isActive: true,
    storefrontEnabled: true,
    verificationStatus: ShopVerificationStatus.VERIFIED,
    enabledModules: { has: "MARKETPLACE" },
  };
  const orderBy: Prisma.ShopOrderByWithRelationInput[] = sort === "newest"
    ? [{ createdAt: "desc" }, { name: "asc" }]
    : sort === "products"
      ? [{ products: { _count: "desc" } }, { name: "asc" }]
      : [{ name: "asc" }];

  const eligibleShops = await prisma.shop.findMany({ where: storefrontWhere, select: { id: true } });
  const eligibleShopIds = eligibleShops.map((shop) => shop.id);
  const hasLocationFilter = Boolean(region || district || city || suburb);
  const locationWhere: Prisma.ShopLocationWhereInput = {
    shopId: { in: eligibleShopIds },
    ...(region ? { region: { equals: region, mode: "insensitive" } } : {}),
    ...(district ? { district: { contains: district, mode: "insensitive" } } : {}),
    ...(city ? { town: { contains: city, mode: "insensitive" } } : {}),
    ...(suburb ? { area: { contains: suburb, mode: "insensitive" } } : {}),
  };
  const qLocationToken = normaliseLocationToken(q);
  const [allMarketplaceLocations, filteredLocations, qLocations, categoryOptions, brandRows, teamRows] = await Promise.all([
    eligibleShopIds.length ? prisma.shopLocation.findMany({ where: { shopId: { in: eligibleShopIds } }, orderBy: [{ region: "asc" }, { district: "asc" }, { town: "asc" }] }) : [],
    hasLocationFilter && eligibleShopIds.length ? prisma.shopLocation.findMany({ where: locationWhere, select: { shopId: true } }) : [],
    qLocationToken && eligibleShopIds.length ? prisma.shopLocation.findMany({ where: { shopId: { in: eligibleShopIds }, searchText: { contains: qLocationToken, mode: "insensitive" } }, select: { shopId: true } }) : [],
    prisma.category.findMany({ where: { shop: storefrontWhere, products: { some: {} } }, select: { name: true }, distinct: ["name"], orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { shop: storefrontWhere, brand: { not: null } }, select: { brand: true }, distinct: ["brand"], orderBy: { brand: "asc" } }),
    prisma.product.findMany({ where: { shop: storefrontWhere, teamName: { not: null } }, select: { teamName: true }, distinct: ["teamName"], orderBy: { teamName: "asc" } }),
  ]);

  const productFilters: Prisma.ProductWhereInput = {
    ...offerWhere(offer),
    ...(category ? { category: { name: { equals: category, mode: "insensitive" } } } : {}),
    ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
    ...(team ? { teamName: { equals: team, mode: "insensitive" } } : {}),
    ...(condition ? { condition } : {}),
    ...(availability ? { variants: { some: { stockQty: { gt: 0 } } } } : {}),
  };
  const hasProductFilter = Boolean(offer !== "ALL" || category || brand || team || condition || availability);
  const filteredLocationShopIds = filteredLocations.map((item) => item.shopId);
  const qLocationShopIds = qLocations.map((item) => item.shopId);

  const shops = await prisma.shop.findMany({
    where: {
      ...storefrontWhere,
      ...(hasLocationFilter ? { id: { in: filteredLocationShopIds } } : {}),
      ...(ordering ? { publicOrderingEnabled: true } : {}),
      ...(hasProductFilter ? { products: { some: productFilters } } : {}),
      ...(q ? {
        OR: [
          { id: { in: qLocationShopIds } },
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
          { products: { some: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { teamName: { contains: q, mode: "insensitive" } },
              { sportType: { contains: q, mode: "insensitive" } },
              { productType: { contains: q, mode: "insensitive" } },
              { category: { name: { contains: q, mode: "insensitive" } } },
            ],
          } } },
        ],
      } : {}),
    },
    include: {
      products: {
        where: hasProductFilter ? productFilters : undefined,
        include: { variants: { orderBy: { createdAt: "asc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
        take: 4,
      },
      _count: { select: { products: true, productReviews: true } },
    },
    orderBy,
  });

  const marketplaceProfiles = shops.length
    ? await prisma.shopMarketplaceProfile.findMany({ where: { shopId: { in: shops.map((shop) => shop.id) } } })
    : [];
  const marketplaceProfileByShop = new Map(marketplaceProfiles.map((profile) => [profile.shopId, profile]));
  const locationByShop = new Map(allMarketplaceLocations.map((location) => [location.shopId, location]));
  const hasFilters = Boolean(q || region || district || city || suburb || offer !== "ALL" || category || brand || team || condition || availability || ordering || sort !== "name");
  const visibleCities = uniqueText(allMarketplaceLocations.map((item) => item.town), 6);
  const visibleRegions = uniqueText(allMarketplaceLocations.map((item) => item.region), 6);
  const popularCategories = categoryOptions.slice(0, 6);
  const brandOptions = uniqueText(brandRows.map((item) => item.brand), 120);
  const teamOptions = uniqueText(teamRows.map((item) => item.teamName), 120);
  const advancedOpen = Boolean(offer !== "ALL" || district || suburb || category || brand || team || condition || availability || ordering || sort !== "name");

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/shops" className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-lg shadow-slate-950/15"><Store size={22} /></div>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">Verified business marketplace</p><h1 className="truncate text-xl font-bold">ESM Marketplace</h1></div>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-800 md:inline-flex" href="/apply/shop">List your shop</Link>
            {buyer ? (
              <>
                <Badge tone="green" className="hidden sm:inline-flex">{buyer.name}</Badge>
                <Link href="/buyer/production-requests" className="hidden rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900 md:inline-flex">My custom requests</Link>
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
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-cyan-200"><Sparkles size={14} /> Products, services, rentals and custom production</div>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[1.04] tracking-tight sm:text-6xl">Find the right offer and verified Ghana business without guessing.</h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">Search products, services, rentals and custom production by category, team, brand, region, district, town or sub-town. Exact storefront options, pickup/delivery and reviews remain with each verified shop.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#marketplace-results" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5"><Compass size={17} /> Explore shops</a>
              <Link href="/apply/shop" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10">Grow your brand <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur"><BadgeCheck size={24} className="text-cyan-300" /><p className="mt-5 text-3xl font-black">{shops.length}</p><p className="mt-1 text-xs text-white/55">verified result{shops.length === 1 ? "" : "s"} now</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur"><MapPin size={24} className="text-orange-300" /><p className="mt-5 text-3xl font-black">{visibleRegions.length}</p><p className="mt-1 text-xs text-white/55">active regions in results</p></div>
            <div className="col-span-2 rounded-3xl border border-white/10 bg-gradient-to-r from-cyan-400/10 to-orange-400/10 p-5"><div className="flex items-center gap-2 text-sm font-bold"><Zap size={18} className="text-amber-300" /> Honest local discovery</div><p className="mt-2 text-xs leading-5 text-white/60">Location search uses each business&apos;s verified Ghana registration location. Distance ranking appears only when businesses have usable coordinates; ESM does not invent GPS precision from town names.</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <form className="-mt-12 relative z-10 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_26px_70px_rgba(15,23,42,0.14)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="rounded-xl bg-cyan-50 p-2 text-cyan-800"><SlidersHorizontal size={18} /></div><div><h3 className="font-bold">Powerful marketplace search</h3><p className="text-xs text-slate-500">Combine offer type, product details and exact Ghana location filters</p></div></div><p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{shops.length} result{shops.length === 1 ? "" : "s"}</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.25fr)_180px_210px_210px_190px_auto]">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100"><span className="sr-only">Search marketplace</span><Search size={17} className="shrink-0 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" name="q" placeholder="Item, shop, team, brand or location" defaultValue={q} /></label>
            <MarketplaceLocationFilters region={region} district={district} city={city} suburb={suburb} />
            <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5">Search <Search size={15} /></button>
          </div>
          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3" open={advancedOpen}>
            <summary className="cursor-pointer text-sm font-bold text-slate-700">More product and shop filters</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <select className="field" name="offer" defaultValue={offer}><option value="ALL">All offer types</option><option value="PRODUCT">Products</option><option value="SERVICE">Services</option><option value="RENTAL">Rentals</option><option value="CUSTOM">Custom production</option></select>
              <select className="field" name="category" defaultValue={category}><option value="">All categories</option>{categoryOptions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
              <select className="field" name="brand" defaultValue={brand}><option value="">All brands</option>{brandOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select className="field" name="team" defaultValue={team}><option value="">All teams</option>{teamOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select className="field" name="condition" defaultValue={condition}><option value="">Any condition</option><option value="NEW">New</option><option value="USED">Used</option><option value="REFURBISHED">Refurbished</option></select>
              <select className="field" name="availability" defaultValue={availability}><option value="">Any availability</option><option value="in-stock">In stock now</option></select>
              <select className="field" name="ordering" defaultValue={ordering}><option value="">Any storefront</option><option value="open">Ordering open</option></select>
              <select className="field" name="sort" defaultValue={sort}><option value="name">Shop name A-Z</option><option value="newest">Newest shops</option><option value="products">Largest catalogues</option></select>
            </div>
          </details>
          {hasFilters ? <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-slate-500">Active:</span>{q ? <Badge>Search: {q}</Badge> : null}{region ? <Badge>Region: {region}</Badge> : null}{district ? <Badge>District: {district}</Badge> : null}{city ? <Badge>Town: {city}</Badge> : null}{suburb ? <Badge>Area: {suburb}</Badge> : null}{offer !== "ALL" ? <Badge tone="blue">Offer: {offer === "CUSTOM" ? "Custom production" : offer[0] + offer.slice(1).toLowerCase()}</Badge> : null}{category ? <Badge>Category: {category}</Badge> : null}{brand ? <Badge>Brand: {brand}</Badge> : null}{team ? <Badge>Team: {team}</Badge> : null}{condition ? <Badge>Condition: {condition}</Badge> : null}{availability ? <Badge tone="green">In stock</Badge> : null}{ordering ? <Badge tone="green">Ordering open</Badge> : null}{sort !== "name" ? <Badge>Sort: {sort}</Badge> : null}<Link href="/shops" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"><RotateCcw size={13} /> Clear filters</Link></div> : null}
        </form>

        {(popularCategories.length || visibleCities.length || visibleRegions.length) ? <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {popularCategories.length ? <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-bold"><Tags size={16} className="text-cyan-700" /> Browse categories</div><div className="mt-3 flex flex-wrap gap-2">{popularCategories.map((item) => <Link key={item.name} href={`/shops?category=${encodeURIComponent(item.name)}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900">{item.name}</Link>)}</div></div> : null}
          {visibleRegions.length ? <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-bold"><MapPin size={16} className="text-orange-600" /> Browse regions</div><div className="mt-3 flex flex-wrap gap-2">{visibleRegions.map((item) => <Link key={item} href={`/shops?region=${encodeURIComponent(item)}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900">{item}</Link>)}</div></div> : null}
          {visibleCities.length ? <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-bold"><MapPin size={16} className="text-emerald-600" /> Popular towns</div><div className="mt-3 flex flex-wrap gap-2">{visibleCities.map((item) => <Link key={item} href={`/shops?city=${encodeURIComponent(item)}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900">{item}</Link>)}</div></div> : null}
        </div> : null}

        <div id="marketplace-results" className="mt-8 flex flex-wrap items-end justify-between gap-3 scroll-mt-28"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Discover sellers</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Shop brands worth opening</h2></div><p className="max-w-lg text-sm leading-6 text-slate-500">Every card shows the seller&apos;s chosen brand image, verified Ghana registration location, verified status and matching catalogue highlights.</p></div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => {
            const profile = marketplaceProfileByShop.get(shop.id);
            const location = locationByShop.get(shop.id);
            const firstProduct = shop.products[0];
            const automaticProductPhoto = firstProduct ? firstProductImage(firstProduct.images) : null;
            const hero = profile?.heroImageUrl ?? (!shop.logoUrl ? automaticProductPhoto : null);
            const logo = shop.logoUrl || "/brand/esm-mark.svg";
            const brands = uniqueText(shop.products.map((product) => product.brand), 4);
            const locationLabel = location
              ? formatGhanaLocation({ region: location.region, district: location.district, town: location.town, area: location.area })
              : `${shop.city ?? "Online"}${shop.country ? ` - ${shop.country}` : ""}`;
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
                  <div className="absolute bottom-4 right-4 z-20 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur">{shop._count.products} offers</div>
                </div>

                <div className="p-5">
                  <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-xl font-black tracking-tight">{shop.name}</h3><p className="mt-1 flex items-start gap-1.5 text-sm leading-5 text-slate-500"><MapPin size={14} className="mt-0.5 shrink-0" /> <span>{locationLabel}</span></p></div><div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800"><Star size={13} /> {shop._count.productReviews}</div></div>
                  <p className="mt-3 min-h-11 text-sm leading-6 text-slate-600">{profile?.tagline || `Explore ${shop.name}'s latest products, services, rentals and custom production.`}</p>

                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Brands available</p>
                    <div className="mt-2 flex min-h-8 flex-wrap gap-2">{brands.length ? brands.map((item) => <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{item}</span>) : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Brand details coming soon</span>}</div>
                  </div>

                  <div className="mt-5 space-y-2">
                    {shop.products.slice(0, 3).map((product) => {
                      const image = firstProductImage(product.images);
                      const href = product.isPersonalizable ? `/shop/${shop.slug}/custom-production?product=${encodeURIComponent(product.id)}` : `/shop/${shop.slug}`;
                      return <Link href={href} key={product.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-2.5 transition hover:border-cyan-200 hover:bg-cyan-50/50">
                        <div className="h-12 w-12 shrink-0 rounded-xl bg-white bg-cover bg-center" role="img" aria-label={product.name} style={image ? { backgroundImage: `url(${image})` } : undefined}>{!image ? <PackageSearch size={18} className="m-auto mt-3 text-slate-300" /> : null}</div>
                        <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-bold">{product.name}</p><span className="shrink-0 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-800">{offerLabel(product)}</span></div><p className="mt-0.5 truncate text-xs text-slate-500">{product.brand || product.teamName || "Marketplace offer"}</p></div>
                        <span className="shrink-0 text-xs font-bold text-slate-700">{currency(product.variants[0]?.priceOverride?.toString() ?? product.basePrice.toString(), shop.currency)}</span>
                      </Link>;
                    })}
                    {!shop.products.length ? <p className="rounded-2xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No matching offers yet</p> : null}
                  </div>

                  <div className="mt-5 space-y-2 rounded-2xl border border-slate-100 bg-white p-3 text-xs text-slate-600"><p className="flex min-w-0 items-center gap-2"><Phone size={13} className="shrink-0 text-cyan-700" /><span className="truncate">{shop.credentialPhone ?? "Phone available after shop setup"}</span></p><p className="flex min-w-0 items-center gap-2"><Mail size={13} className="shrink-0 text-cyan-700" /><span className="truncate">{shop.credentialEmail ?? "Email not listed"}</span></p>{location?.digitalAddress ? <p className="flex min-w-0 items-center gap-2"><MapPin size={13} className="shrink-0 text-emerald-700" /><span className="truncate">GPS: {location.digitalAddress}</span></p> : null}</div>
                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                    <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5" href={`/shop/${shop.slug}`}>Open shop <ShoppingBag size={15} /></Link>
                    <Link className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-800 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800" aria-label={`Message ${shop.name}`} title={`Message ${shop.name}`} href={buyer ? `/shop/${shop.slug}/chat` : `/buyer/login?next=/shop/${shop.slug}/chat`}><MessageCircle size={17} /></Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!shops.length ? <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><PackageSearch size={36} className="mx-auto text-slate-300" /><h3 className="mt-4 text-lg font-bold">No verified shop matched these filters</h3><p className="mt-2 text-sm text-slate-500">Clear one or more offer, product or location filters and try another item, service, rental, custom job, district, town or area.</p><Link href="/shops" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"><RotateCcw size={15} /> Reset marketplace</Link></div> : null}

        <section className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-700 to-slate-950 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">For growing businesses</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Give your shop a stronger digital storefront.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Create your brand profile, register the exact business location, publish products, services, rentals or custom production and connect with nearby buyers.</p></div><Link href="/apply/shop" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-950">Apply to join <ArrowRight size={16} /></Link></div>
        </section>
      </section>
    </main>
  );
}
