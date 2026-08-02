import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Cloud,
  CreditCard,
  Eye,
  EyeOff,
  Globe2,
  ImageIcon,
  KeyRound,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyLoginIdButton } from "@/components/auth/copy-login-id-button";
import { Badge } from "@/components/ui/badge";
import { GhanaLocationFields } from "@/components/locations/ghana-location-fields";
import { updateShopSettingsAction, updateStorefrontVisibilityAction } from "@/app/dashboard/settings/actions";
import { currency } from "@/lib/format";
import { formatGhanaLocation } from "@/lib/ghana-locations";
import { readShopSettingsProfile } from "@/lib/shop-profile-store";
import { getTenantContext } from "@/lib/tenant";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

type Props = { searchParams?: Promise<{ error?: string; storefront?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const session = await requireRole(permissions.settings);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const [paymentConfig, account, marketplaceProfile, shopLocation] = await readShopSettingsProfile(shop.id, session.id);
  const loginId = account?.adminLoginId ?? session.email;
  const storefrontMode = !shop.storefrontEnabled ? "OFFLINE" : shop.publicOrderingEnabled ? "ONLINE" : "BROWSE";
  const paystackServerReady = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const paystackShopReady = Boolean(paymentConfig?.paystackSubaccountCode);
  const smsProvider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const smsReady = smsProvider === "arkesel"
    ? Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER_ID)
    : Boolean(process.env.SMS_API_URL && process.env.SMS_API_TOKEN);
  const configuredMediaProvider = (process.env.MEDIA_STORAGE_PROVIDER ?? "database").toLowerCase();
  const mediaProvider = configuredMediaProvider === "local" && process.env.NODE_ENV === "production" && process.env.ALLOW_EPHEMERAL_MEDIA !== "true"
    ? "database"
    : configuredMediaProvider;
  const externalMediaReady = ["r2", "s3"].includes(mediaProvider)
    && Boolean((process.env.S3_ENDPOINT ?? process.env.R2_ENDPOINT)
      && (process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID)
      && (process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY)
      && (process.env.S3_BUCKET ?? process.env.R2_BUCKET)
      && process.env.MEDIA_PUBLIC_URL);
  const mediaReady = mediaProvider === "database" || mediaProvider === "local" || externalMediaReady;
  const mediaStatus = mediaProvider === "database"
    ? "PostgreSQL compressed media ready"
    : mediaProvider === "local"
      ? "Local development media ready"
      : externalMediaReady
        ? `${mediaProvider.toUpperCase()} persistent storage ready`
        : `${mediaProvider.toUpperCase()} credentials incomplete`;
  const platformCharge = paymentConfig?.paystackTransactionCharge
    ? currency(Number(paymentConfig.paystackTransactionCharge) / 100, shop.currency)
    : "No flat platform charge";
  const chargeBearer = paymentConfig?.paystackChargeBearer === "account"
    ? "ESM platform account"
    : "Shop subaccount";
  const locationLabel = shopLocation
    ? formatGhanaLocation({ region: shopLocation.region, district: shopLocation.district, town: shopLocation.town, area: shopLocation.area })
    : shop.city ?? "Location profile not completed";

  return (
    <div className="space-y-5">
      {params.error === "verification-required" ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Your shop is registered, but the platform administrator must verify it before you can place it on the public marketplace.</div> : null}
      {params.error === "storefront-mode" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Choose a valid online shop status.</div> : null}
      {params.error === "invalid" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Check the shop branding, Ghana location and payment fields, then save again.</div> : null}
      {params.storefront ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Online shop status updated successfully.</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Globe2 size={20} /><h1 className="text-xl font-semibold">Online shop status</h1></div><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Registration keeps your private shop workspace active. This separate control decides whether customers can see and order from your public shop.</p></div><Badge tone={storefrontMode === "ONLINE" ? "green" : storefrontMode === "BROWSE" ? "blue" : "orange"}>{storefrontMode}</Badge></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <form action={updateStorefrontVisibilityAction}><input type="hidden" name="mode" value="ONLINE" /><button type="submit" className={`min-h-28 w-full rounded-xl border p-4 text-left ${storefrontMode === "ONLINE" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}><ShoppingBag size={20} /><strong className="mt-3 block">Online + ordering</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Customers can find the shop and place orders.</span></button></form>
            <form action={updateStorefrontVisibilityAction}><input type="hidden" name="mode" value="BROWSE" /><button type="submit" className={`min-h-28 w-full rounded-xl border p-4 text-left ${storefrontMode === "BROWSE" ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white"}`}><Eye size={20} /><strong className="mt-3 block">Visible, orders paused</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Customers can browse, but cannot checkout.</span></button></form>
            <form action={updateStorefrontVisibilityAction}><input type="hidden" name="mode" value="OFFLINE" /><button type="submit" className={`min-h-28 w-full rounded-xl border p-4 text-left ${storefrontMode === "OFFLINE" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}><EyeOff size={20} /><strong className="mt-3 block">Offline</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Private workspace stays active; public shop is hidden.</span></button></form>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span><strong>Registration:</strong> {shop.isActive ? "Active" : "Suspended"}</span><span><strong>Verification:</strong> {shop.verificationStatus}</span>{shop.storefrontEnabled ? <Link href={`/shop/${shop.slug}`} className="font-semibold text-[var(--shop-primary)]">Open public link</Link> : <span className="text-slate-500">Public link hidden by owner choice</span>}</div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2"><KeyRound size={20} /><h2 className="text-xl font-semibold">Your Login ID</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use this ID or your email on the ESM sign-in page. Keep it with your password instructions.</p>
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Login ID</p><p className="mt-2 break-all text-xl font-semibold text-cyan-950">{loginId}</p><div className="mt-3"><CopyLoginIdButton loginId={loginId} /></div></div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-lg border p-4 ${paystackServerReady && paystackShopReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CreditCard size={18} /><h2 className="font-semibold">Paystack readiness</h2></div>{paystackServerReady && paystackShopReady ? <CheckCircle2 size={19} className="text-emerald-700" /> : <AlertTriangle size={19} className="text-amber-700" />}</div>
          <p className="mt-3 text-sm font-semibold">{paystackServerReady && paystackShopReady ? "Store settlement route connected" : "Not ready for live online payments"}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600"><li>ESM administrator account: {paystackServerReady ? "connected on the server" : "missing"}</li><li>Your store subaccount: {paystackShopReady ? "assigned" : "not assigned"}</li><li>Customer sales settle to your store subaccount; ESM charges settle to the administrator account.</li></ul>
        </div>
        <div className={`rounded-lg border p-4 ${smsReady ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageSquareText size={18} /><h2 className="font-semibold">SMS readiness</h2></div>{smsReady ? <CheckCircle2 size={19} className="text-emerald-700" /> : <CircleOff size={19} className="text-slate-500" />}</div>
          <p className="mt-3 text-sm font-semibold">{smsReady ? `${smsProvider} credentials detected` : "Console-only mode — no SMS will be delivered"}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Provider: {smsProvider}. A successful credential check is not enough; send a controlled test to an approved number before enabling customer notifications.</p>
        </div>
        <div className={`rounded-lg border p-4 ${mediaReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Cloud size={18} /><h2 className="font-semibold">Media storage</h2></div>{mediaReady ? <CheckCircle2 size={19} className="text-emerald-700" /> : <AlertTriangle size={19} className="text-amber-700" />}</div>
          <p className="mt-3 text-sm font-semibold">{mediaStatus}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Logos, marketplace photos, product photos and raster design artwork are resized and compressed automatically. The large original is discarded; only the optimized image and thumbnail are stored.</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2"><Sparkles size={21} className="text-cyan-700" /><h1 className="text-2xl font-semibold">Shop settings</h1><Badge tone="blue">Marketplace branding</Badge></div>
          <p className="mt-2 text-sm leading-6 text-slate-500">Control the shop identity, exact Ghana location, public marketplace presentation and settlement details from one place.</p>
          <div className="mt-4 rounded-[8px] border border-[#ded8cd] bg-white p-3 text-sm">
            <p className="text-slate-500">Shop network code</p>
            <p className="mt-1 text-xl font-semibold tracking-wide">{shop.networkCode ?? "Not assigned yet"}</p>
          </div>
          <form action={updateShopSettingsAction} encType="multipart/form-data" className="mt-5 space-y-4">
            <label className="block"><span className="mb-1 block text-sm font-semibold">Shop name / brand name</span><input className="field" name="name" defaultValue={shop.name} required /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Marketplace tagline</span><input className="field" name="marketplaceTagline" maxLength={180} defaultValue={marketplaceProfile?.tagline ?? ""} placeholder="Quality products, trusted service and fast fulfilment" /><span className="mt-1 block text-xs text-slate-500">A short promise shown beneath your shop name.</span></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Logo URL</span><input className="field" name="logoUrl" defaultValue={shop.logoUrl ?? ""} placeholder="/brand/accra-pro.svg" /></label>
            <label className="block rounded-[8px] border border-[#ded8cd] bg-white p-3 text-sm"><span className="mb-2 block font-semibold text-slate-700">Upload shop logo</span><input className="block w-full text-sm" name="logoFile" type="file" accept="image/*,.heic,.heif,.tif,.tiff,.svg" /><span className="mt-2 block text-xs text-slate-500">Use a square logo where possible. It appears on the marketplace card, public shop, dashboard and receipts.</span></label>
            <input type="hidden" name="marketplaceHeroUrl" value={marketplaceProfile?.heroImageUrl ?? ""} />
            <label className="block rounded-[8px] border border-cyan-200 bg-cyan-50/60 p-3 text-sm"><span className="mb-2 flex items-center gap-2 font-semibold text-cyan-950"><ImageIcon size={17} /> Marketplace featured photo</span><input className="block w-full text-sm" name="marketplaceHeroFile" type="file" accept="image/*,.heic,.heif,.tif,.tiff,.svg" /><span className="mt-2 block text-xs leading-5 text-cyan-900/70">Upload one specific item, service, shop-front or promotional image. The whole photo is fitted inside the card without cutting off the item.</span></label>
            {marketplaceProfile?.heroImageUrl ? <label className="flex items-start gap-2 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm"><input className="mt-1" name="clearMarketplaceHero" type="checkbox" /><span><strong className="block text-amber-950">Remove the featured photo</strong><span className="text-xs leading-5 text-amber-900/70">The marketplace card will use your logo instead.</span></span></label> : null}

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center gap-2"><MapPinned size={18} className="text-emerald-700" /><h2 className="font-semibold text-emerald-950">Business location</h2></div>
              <p className="mt-1 text-xs leading-5 text-emerald-900/70">Customers can filter the marketplace by region, district, town and sub-town. Existing shops may complete this profile when ready; once saved, all three core levels stay required together.</p>
              <div className="mt-4"><GhanaLocationFields required={Boolean(shopLocation)} compact defaults={{
                region: shopLocation?.region,
                district: shopLocation?.district,
                city: shopLocation?.town ?? shop.city,
                suburb: shopLocation?.area,
                digitalAddress: shopLocation?.digitalAddress,
                address: shopLocation?.streetAddress ?? shop.credentialAddress,
                landmark: shopLocation?.landmark,
                latitude: shopLocation?.latitude,
                longitude: shopLocation?.longitude,
              }} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-sm font-semibold">Primary color</span><input className="field h-12" name="primaryColor" type="color" defaultValue={shop.primaryColor} /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold">Secondary color</span><input className="field h-12" name="secondaryColor" type="color" defaultValue={shop.secondaryColor} /></label>
            </div>
            <div className="grid gap-3 rounded-[8px] bg-white p-3 text-sm">
              <label className="block"><span className="mb-1 block text-sm font-semibold">Cash order hold minutes</span><input className="field" name="cashOrderHoldMinutes" type="number" min="15" max="10080" defaultValue={shop.cashOrderHoldMinutes} /></label>
            </div>

            <div className="rounded-[8px] bg-white p-3">
              <div className="flex items-center gap-2"><LockKeyhole size={17} /><h2 className="text-sm font-semibold uppercase text-slate-500">Store-owned payment settlement</h2></div>
              <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <p><strong className="text-slate-900">Store subaccount:</strong> {paymentConfig?.paystackSubaccountCode ?? "Awaiting platform assignment"}</p>
                <p><strong className="text-slate-900">ESM platform charge:</strong> {platformCharge}</p>
                <p><strong className="text-slate-900">Paystack fee bearer:</strong> {chargeBearer}</p>
                <p>The platform administrator controls the subaccount connection and ESM charge. Your store controls its settlement details and which customer payment methods it accepts.</p>
              </div>
              <input className="field mt-3" name="momoProvider" placeholder="Mobile money provider" defaultValue={paymentConfig?.momoProvider ?? "Paystack"} />
              <div className="mt-3 grid grid-cols-2 gap-2"><input className="field" name="shopMomoNumber" placeholder="Shop mobile money number" defaultValue={paymentConfig?.shopMomoNumber ?? ""} /><input className="field" name="shopMomoNetwork" placeholder="Mobile money network" defaultValue={paymentConfig?.shopMomoNetwork ?? ""} /></div>
              <div className="mt-3 grid grid-cols-3 gap-2"><input className="field" name="settlementBank" placeholder="Settlement bank" defaultValue={paymentConfig?.settlementBank ?? ""} /><input className="field" name="settlementAccount" placeholder="Account number" defaultValue={paymentConfig?.settlementAccount ?? ""} /><input className="field" name="settlementAccountName" placeholder="Account name" defaultValue={paymentConfig?.settlementAccountName ?? ""} /></div>
              <div className="mt-3 grid gap-2 text-sm">
                <label className="flex items-center gap-2"><input name="allowCash" type="checkbox" defaultChecked={paymentConfig?.allowCash ?? true} />Cash</label>
                <label className="flex items-center gap-2"><input name="allowCard" type="checkbox" defaultChecked={paymentConfig?.allowCard ?? true} />Card / Paystack</label>
                <label className="flex items-center gap-2"><input name="allowMomo" type="checkbox" defaultChecked={paymentConfig?.allowMomo ?? true} />Mobile money</label>
              </div>
            </div>
            <Button>Save settings — shop, location and marketplace</Button>
          </form>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Marketplace preview</p>
            <h2 className="mt-2 text-2xl font-semibold">See how customers meet your brand</h2>
          </div>
          <div className="p-5">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
              <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6">
                {marketplaceProfile?.heroImageUrl ? <Image src={marketplaceProfile.heroImageUrl} alt={`${shop.name} marketplace featured`} width={960} height={540} className="h-full w-full object-contain" /> : <Image src={shop.logoUrl || "/brand/esm-mark.svg"} alt={shop.name} width={170} height={170} className="max-h-40 w-auto rounded-3xl object-contain shadow-sm" />}
                {marketplaceProfile?.heroImageUrl ? <div className="absolute bottom-4 left-4 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-lg backdrop-blur"><Image src={shop.logoUrl || "/brand/esm-mark.svg"} alt={`${shop.name} logo`} width={54} height={54} className="h-12 w-12 rounded-xl object-contain" /></div> : null}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{shop.name}</h3><p className="mt-1 text-sm text-slate-600">{marketplaceProfile?.tagline || "Your marketplace tagline will appear here."}</p><p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPinned size={14} /> {locationLabel}</p></div><Badge tone="green">Verified</Badge></div>
                <div className="mt-4 flex flex-wrap gap-2"><Badge tone={shop.publicOrderingEnabled ? "green" : "orange"}>{shop.publicOrderingEnabled ? "Ordering open" : "Browse only"}</Badge><Badge>Product brands appear automatically</Badge></div>
                <div className="mt-5 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${shop.primaryColor}, ${shop.secondaryColor})` }} />
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950"><strong>Photo priority:</strong> selected marketplace photo first, then your shop logo, then a product image only when no logo has been supplied.</div>
            {shop.storefrontEnabled ? <Link className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" href="/shops">Open live marketplace</Link> : <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">The public shop is currently offline. Your private dashboard remains active.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
