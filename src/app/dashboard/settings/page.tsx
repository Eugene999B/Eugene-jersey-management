import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleOff, Cloud, CreditCard, Eye, EyeOff, Globe2, KeyRound, LockKeyhole, MessageSquareText, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyLoginIdButton } from "@/components/auth/copy-login-id-button";
import { Badge } from "@/components/ui/badge";
import { updateShopSettingsAction, updateStorefrontVisibilityAction } from "@/app/dashboard/settings/actions";
import { prisma } from "@/lib/db";
import { currency } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

type Props = { searchParams?: Promise<{ error?: string; storefront?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const session = await requireRole(permissions.settings);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const [paymentConfig, account] = await Promise.all([
    prisma.shopPaymentConfig.findUnique({ where: { shopId: shop.id } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { adminLoginId: true } }),
  ]);
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
    ? "EJM platform account"
    : "Shop subaccount";

  return (
    <div className="space-y-5">
      {params.error === "verification-required" ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Your shop is registered, but the platform administrator must verify it before you can place it on the public marketplace.</div> : null}
      {params.error === "storefront-mode" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Choose a valid online shop status.</div> : null}
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
          <p className="mt-2 text-sm leading-6 text-slate-600">Use this ID or your email on the EJM sign-in page. Keep it with your password instructions.</p>
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Login ID</p><p className="mt-2 break-all text-xl font-semibold text-cyan-950">{loginId}</p><div className="mt-3"><CopyLoginIdButton loginId={loginId} /></div></div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-lg border p-4 ${paystackServerReady && paystackShopReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CreditCard size={18} /><h2 className="font-semibold">Paystack readiness</h2></div>{paystackServerReady && paystackShopReady ? <CheckCircle2 size={19} className="text-emerald-700" /> : <AlertTriangle size={19} className="text-amber-700" />}</div>
          <p className="mt-3 text-sm font-semibold">{paystackServerReady && paystackShopReady ? "Store settlement route connected" : "Not ready for live online payments"}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600"><li>EJM administrator account: {paystackServerReady ? "connected on the server" : "missing"}</li><li>Your store subaccount: {paystackShopReady ? "assigned" : "not assigned"}</li><li>Customer sales settle to your store subaccount; EJM charges settle to the administrator account.</li></ul>
        </div>
        <div className={`rounded-lg border p-4 ${smsReady ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageSquareText size={18} /><h2 className="font-semibold">SMS readiness</h2></div>{smsReady ? <CheckCircle2 size={19} className="text-emerald-700" /> : <CircleOff size={19} className="text-slate-500" />}</div>
          <p className="mt-3 text-sm font-semibold">{smsReady ? `${smsProvider} credentials detected` : "Console-only mode — no SMS will be delivered"}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Provider: {smsProvider}. A successful credential check is not enough; send a controlled test to an approved number before enabling customer notifications.</p>
        </div>
        <div className={`rounded-lg border p-4 ${mediaReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Cloud size={18} /><h2 className="font-semibold">Media storage</h2></div>{mediaReady ? <CheckCircle2 size={19} className="text-emerald-700" /> : <AlertTriangle size={19} className="text-amber-700" />}</div>
          <p className="mt-3 text-sm font-semibold">{mediaStatus}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Logos, product photos and raster design artwork are resized and compressed automatically. The large original is discarded; only the small optimized image and thumbnail are stored.</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="panel p-5">
          <h1 className="text-2xl font-semibold">Shop settings</h1>
          <p className="mt-2 text-sm text-slate-500">Branding values drive the dashboard CSS theme variables.</p>
          <div className="mt-4 rounded-[8px] border border-[#ded8cd] bg-white p-3 text-sm">
            <p className="text-slate-500">Shop network code</p>
            <p className="mt-1 text-xl font-semibold tracking-wide">{shop.networkCode ?? "Not assigned yet"}</p>
          </div>
          <form action={updateShopSettingsAction} encType="multipart/form-data" className="mt-5 space-y-4">
            <label className="block"><span className="mb-1 block text-sm font-semibold">Shop name</span><input className="field" name="name" defaultValue={shop.name} required /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Logo URL</span><input className="field" name="logoUrl" defaultValue={shop.logoUrl ?? ""} placeholder="/brand/accra-pro.svg" /></label>
            <label className="block rounded-[8px] border border-[#ded8cd] bg-white p-3 text-sm"><span className="mb-2 block font-semibold text-slate-700">Upload shop logo</span><input className="block w-full text-sm" name="logoFile" type="file" accept="image/*,.heic,.heif,.tif,.tiff,.svg" /><span className="mt-2 block text-xs text-slate-500">JPG, PNG, WebP, AVIF, GIF, TIFF, HEIC/HEIF and SVG are converted to a small durable WebP automatically.</span></label>
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
                <p><strong className="text-slate-900">EJM platform charge:</strong> {platformCharge}</p>
                <p><strong className="text-slate-900">Paystack fee bearer:</strong> {chargeBearer}</p>
                <p>The platform administrator controls the subaccount connection and EJM charge. Your store controls its settlement details and which customer payment methods it accepts.</p>
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
            <Button>Save settings</Button>
          </form>
        </section>

        <section className="panel overflow-hidden">
          <div className="bg-[var(--shop-primary)] p-6 text-white"><Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={56} height={56} className="rounded-[8px]" /><h2 className="mt-5 text-3xl font-semibold">{shop.name}</h2><p className="mt-2 text-white/75">Brand preview for dashboards, receipts, and tracking pages.</p>{shop.storefrontEnabled ? <Link className="mt-5 inline-flex rounded-[8px] bg-white px-4 py-2 text-sm font-semibold text-slate-900" href={`/shop/${shop.slug}`}>Open public shop</Link> : <p className="mt-5 rounded-lg bg-white/10 px-4 py-3 text-sm">The public shop is currently offline. Your private dashboard remains active.</p>}</div>
          <div className="grid gap-3 p-5 md:grid-cols-3">{["Catalog", "POS", "Orders"].map((item) => <div key={item} className="rounded-[8px] border border-[#ded8cd] bg-white p-4"><p className="text-sm text-slate-500">{item}</p><div className="mt-4 h-2 rounded-full bg-[var(--shop-secondary)]" /></div>)}</div>
        </section>
      </div>
    </div>
  );
}
