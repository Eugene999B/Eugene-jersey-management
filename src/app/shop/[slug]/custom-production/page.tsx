import Link from "next/link";
import { ArrowLeft, ImageUp, PackageCheck, Ruler, Shirt, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getBuyerSession } from "@/lib/buyer-session";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import { readProductionLibrary } from "@/lib/production-specs";
import { submitCustomerProductionRequestAction } from "./actions";

const errorCopy: Record<string, string> = {
  invalid: "Check the custom-production request and try again.",
  delivery: "Delivery requests need a delivery address.",
  subscription: "This shop cannot accept a new custom-production request right now.",
  product: "Choose a current customizable product option.",
  "production-option": "Choose a valid garment size and placement combination.",
  artwork: "Artwork must be a JPEG, PNG or WebP image no larger than 5 MB.",
  "artwork-signature": "The uploaded file contents did not match the declared image type.",
};

export default async function CustomProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const buyer = await getBuyerSession();
  const shop = await prisma.shop.findUnique({
    where: { slug },
    include: {
      deliveryZones: { where: { isActive: true }, orderBy: { fee: "asc" } },
      products: {
        where: { isPersonalizable: true },
        include: { category: true, variants: { orderBy: { createdAt: "asc" } } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!shop || !shop.isActive || !shop.storefrontEnabled || !shop.publicOrderingEnabled || !shop.enabledModules.includes("ONLINE_SELLING") || !shop.enabledModules.includes("PRINTING_PRODUCTION")) {
    return <main className="min-h-screen bg-[#f6f4ef] p-5"><div className="mx-auto max-w-3xl rounded-xl bg-white p-6"><h1 className="text-xl font-bold">Custom production unavailable</h1><p className="mt-2 text-sm text-slate-600">This shop is not accepting custom production requests right now.</p><Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white" href={`/shop/${slug}`}>Back to shop</Link></div></main>;
  }

  const library = readProductionLibrary(shop.productionSetup);
  const garments = library.garments.filter((garment) => garment.isActive && garment.sizes.length > 0);
  const placements = library.placements.filter((placement) => placement.isActive);
  const variants = shop.products.flatMap((product) => product.variants.map((variant) => ({
    id: variant.id,
    productName: product.name,
    category: product.category.name,
    sku: variant.sku,
    attributes: variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes)
      ? Object.entries(variant.attributes as Record<string, unknown>).map(([key, value]) => `${titleCase(key)} ${String(value)}`).join(" · ")
      : "",
    price: Number(variant.priceOverride ?? product.basePrice),
  })));

  return (
    <main className="min-h-screen bg-[#f6f4ef]">
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-5 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase text-cyan-700">{shop.name}</p><h1 className="mt-1 text-3xl font-black">Request custom production</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Choose the exact product, garment size and placement, add text/number and artwork, then the shop will prepare a quoted preview for your approval before any deposit is requested.</p></div>
          <Link href={`/shop/${shop.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#ded8cd] bg-white px-4 text-sm font-semibold"><ArrowLeft size={16} /> Back to shop</Link>
        </div>

        {query?.error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{errorCopy[query.error] ?? errorCopy.invalid}</p> : null}

        {!buyer ? (
          <section className="mt-5 rounded-2xl border border-[#ded8cd] bg-white p-5">
            <h2 className="text-lg font-bold">Buyer login required</h2>
            <p className="mt-2 text-sm text-slate-600">Your buyer account keeps artwork, approvals, payment receipts and production tracking private to you.</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white" href={`/buyer/login?next=${encodeURIComponent(`/shop/${shop.slug}/custom-production`)}`}>Login to continue</Link>
          </section>
        ) : !variants.length || !garments.length || !placements.length ? (
          <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-bold">Shop setup is incomplete</h2><p className="mt-2 text-sm">This shop needs at least one customizable product, active garment with sizes, and active print placement before customer design requests can be submitted.</p></section>
        ) : (
          <form action={submitCustomerProductionRequestAction} className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <input type="hidden" name="shopSlug" value={shop.slug} />
            <section className="space-y-4 rounded-2xl border border-[#ded8cd] bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2"><Sparkles size={19} className="text-cyan-700" /><h2 className="text-lg font-bold">1. What should the shop make?</h2></div>
              <label className="block text-sm font-semibold">Customizable product<select className="field mt-1" name="productVariantId" required defaultValue=""><option value="" disabled>Choose product and exact option</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.productName} · {variant.sku}{variant.attributes ? ` · ${variant.attributes}` : ""} · from {currency(variant.price, shop.currency)}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold"><span className="flex items-center gap-1"><Shirt size={15} /> Garment and exact size</span><select className="field mt-1" name="garmentSelection" required defaultValue=""><option value="" disabled>Choose garment size</option>{garments.flatMap((garment) => garment.sizes.map((size) => <option key={`${garment.id}:${size}`} value={`${garment.id}::${size}`}>{garment.name} · {garment.colour || garment.garmentType} · {size}</option>))}</select></label>
                <label className="block text-sm font-semibold"><span className="flex items-center gap-1"><Ruler size={15} /> Print placement</span><select className="field mt-1" name="placementResourceId" required defaultValue=""><option value="" disabled>Choose placement</option>{placements.map((placement) => <option key={placement.id} value={placement.id}>{placement.name} · {titleCase(placement.location)}</option>)}</select></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Text / name<input className="field mt-1" name="requestedText" maxLength={120} placeholder="e.g. EUGENE" /></label><label className="block text-sm font-semibold">Number<input className="field mt-1" name="requestedNumber" maxLength={30} placeholder="e.g. 10" /></label></div>
              <label className="block text-sm font-semibold">Design notes<textarea className="field mt-1 min-h-28" name="requestNotes" maxLength={1500} placeholder="Colours, logo positioning, deadline, team name, special instructions..." /></label>
              <label className="block rounded-xl border border-dashed border-cyan-300 bg-cyan-50 p-4 text-sm font-semibold"><span className="flex items-center gap-2"><ImageUp size={18} /> Logo / artwork (optional)</span><input className="mt-3 block w-full text-sm" type="file" name="artwork" accept="image/jpeg,image/png,image/webp" /><span className="mt-2 block text-xs font-normal text-cyan-900">JPEG, PNG or WebP; maximum 5 MB. The shop will use this as reference artwork, not as automatic machine output.</span></label>
            </section>

            <section className="space-y-4 rounded-2xl border border-[#ded8cd] bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2"><PackageCheck size={19} className="text-cyan-700" /><h2 className="text-lg font-bold">2. Fulfilment and approval</h2></div>
              <p className="text-sm leading-6 text-slate-600">Submitting this request does not charge you. The shop will send a quoted concept preview first. You can approve it or request changes, then pay the configured deposit securely.</p>
              <div className="grid grid-cols-2 gap-2"><label className="rounded-xl border border-[#ded8cd] p-3 text-sm font-semibold"><input className="mr-2" type="radio" name="fulfillmentType" value="PICKUP" defaultChecked />Collection</label><label className={`rounded-xl border border-[#ded8cd] p-3 text-sm font-semibold ${!shop.deliveryZones.length ? "opacity-50" : ""}`}><input className="mr-2" type="radio" name="fulfillmentType" value="DELIVERY" disabled={!shop.deliveryZones.length} />Delivery</label></div>
              <label className="block text-sm font-semibold">Delivery address<input className="field mt-1" name="deliveryAddress" placeholder="Required when delivery is selected" /></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">City<input className="field mt-1" name="deliveryCity" /></label><label className="block text-sm font-semibold">Area<input className="field mt-1" name="deliveryArea" /></label></div>
              <label className="block text-sm font-semibold">Delivery note<input className="field mt-1" name="deliveryNotes" /></label>
              {shop.deliveryZones.length ? <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p className="font-bold">Active delivery areas</p><p className="mt-1">{shop.deliveryZones.map((zone) => `${zone.name} (${currency(zone.fee, shop.currency)})`).join(" · ")}</p><p className="mt-1">Final delivery fee is confirmed with the quote.</p></div> : <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">This shop currently supports collection only.</p>}
              <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--shop-primary,#0f766e)] px-4 text-sm font-bold text-white" type="submit"><Sparkles size={17} /> Submit design request</button>
              <p className="text-center text-xs text-slate-500">You will track preview approval, deposit, production, balance and completion from your buyer request page.</p>
            </section>
          </form>
        )}

        <div className="mt-5 flex flex-wrap gap-2"><Badge tone="green">Exact garment + size</Badge><Badge tone="blue">Preview before deposit</Badge><Badge tone="orange">Production tracking</Badge><Badge>Buyer-only artwork access</Badge></div>
      </div>
    </main>
  );
}
