import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleOff, Cloud, CreditCard, LockKeyhole, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateShopSettingsAction } from "@/app/dashboard/settings/actions";
import { prisma } from "@/lib/db";
import { currency } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export default async function SettingsPage() {
  await requireRole(permissions.settings);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const paymentConfig = await prisma.shopPaymentConfig.findUnique({ where: { shopId: shop.id } });
  const paystackServerReady = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const paystackShopReady = Boolean(paymentConfig?.paystackSubaccountCode);
  const smsProvider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const smsReady = smsProvider === "arkesel"
    ? Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER_ID)
    : Boolean(process.env.SMS_API_URL && process.env.SMS_API_TOKEN);
  const mediaProvider = (process.env.MEDIA_STORAGE_PROVIDER ?? "local").toLowerCase();
  const mediaReady = ["r2", "s3"].includes(mediaProvider)
    && Boolean((process.env.S3_ENDPOINT ?? process.env.R2_ENDPOINT)
      && (process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID)
      && (process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY)
      && (process.env.S3_BUCKET ?? process.env.R2_BUCKET)
      && process.env.MEDIA_PUBLIC_URL);
  const platformCharge = paymentConfig?.paystackTransactionCharge
    ? currency(Number(paymentConfig.paystackTransactionCharge) / 100, shop.currency)
    : "No flat platform charge";
  const chargeBearer = paymentConfig?.paystackChargeBearer === "account"
    ? "EJM platform account"
    : "Shop subaccount";

  return (
    <div className="space-y-5">
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
          <p className="mt-3 text-sm font-semibold">{mediaReady ? `${mediaProvider.toUpperCase()} persistent storage ready` : "Local storage is temporary on Railway"}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Product photos, logos, and design artwork need S3 or R2 credentials plus a public media URL before production launch.</p>
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
            <label className="block rounded-[8px] border border-[#ded8cd] bg-white p-3 text-sm"><span className="mb-2 block font-semibold text-slate-700">Upload shop logo</span><input className="block w-full text-sm" name="logoFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /><span className="mt-2 block text-xs text-slate-500">Uploaded logos are optimized and replace the URL above.</span></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-sm font-semibold">Primary color</span><input className="field h-12" name="primaryColor" type="color" defaultValue={shop.primaryColor} /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold">Secondary color</span><input className="field h-12" name="secondaryColor" type="color" defaultValue={shop.secondaryColor} /></label>
            </div>
            <div className="grid gap-3 rounded-[8px] bg-white p-3 text-sm">
              <label className="flex items-center gap-2"><input name="storefrontEnabled" type="checkbox" defaultChecked={shop.storefrontEnabled} />Storefront link is visible</label>
              <label className="flex items-center gap-2"><input name="publicOrderingEnabled" type="checkbox" defaultChecked={shop.publicOrderingEnabled} />Customers can place online orders</label>
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
          <div className="bg-[var(--shop-primary)] p-6 text-white"><Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={56} height={56} className="rounded-[8px]" /><h2 className="mt-5 text-3xl font-semibold">{shop.name}</h2><p className="mt-2 text-white/75">Brand preview for dashboards, receipts, and tracking pages.</p><Link className="mt-5 inline-flex rounded-[8px] bg-white px-4 py-2 text-sm font-semibold text-slate-900" href={`/shop/${shop.slug}`}>Open public shop</Link></div>
          <div className="grid gap-3 p-5 md:grid-cols-3">{["Catalog", "POS", "Orders"].map((item) => <div key={item} className="rounded-[8px] border border-[#ded8cd] bg-white p-4"><p className="text-sm text-slate-500">{item}</p><div className="mt-4 h-2 rounded-full bg-[var(--shop-secondary)]" /></div>)}</div>
        </section>
      </div>
    </div>
  );
}
