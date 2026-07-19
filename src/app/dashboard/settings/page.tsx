import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateShopSettingsAction } from "@/app/dashboard/settings/actions";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";

export default async function SettingsPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const paymentConfig = await prisma.shopPaymentConfig.findUnique({ where: { shopId: shop.id } });

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="panel p-5">
        <h1 className="text-2xl font-semibold">Shop settings</h1>
        <p className="mt-2 text-sm text-slate-500">Branding values drive the dashboard CSS theme variables.</p>
        <form action={updateShopSettingsAction} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Shop name</span>
            <input className="field" name="name" defaultValue={shop.name} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Logo URL</span>
            <input className="field" name="logoUrl" defaultValue={shop.logoUrl ?? ""} placeholder="/brand/accra-pro.svg" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Primary color</span>
              <input className="field h-12" name="primaryColor" type="color" defaultValue={shop.primaryColor} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Secondary color</span>
              <input className="field h-12" name="secondaryColor" type="color" defaultValue={shop.secondaryColor} />
            </label>
          </div>
          <div className="grid gap-3 rounded-[8px] bg-white p-3 text-sm">
            <label className="flex items-center gap-2">
              <input name="storefrontEnabled" type="checkbox" defaultChecked={shop.storefrontEnabled} />
              Storefront link is visible
            </label>
            <label className="flex items-center gap-2">
              <input name="publicOrderingEnabled" type="checkbox" defaultChecked={shop.publicOrderingEnabled} />
              Customers can place online orders
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Cash order hold minutes</span>
              <input className="field" name="cashOrderHoldMinutes" type="number" min="15" max="10080" defaultValue={shop.cashOrderHoldMinutes} />
            </label>
          </div>

          <div className="rounded-[8px] bg-white p-3">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Payments</h2>
            <input className="field" name="paystackPublicKey" placeholder="Paystack public key" defaultValue={paymentConfig?.paystackPublicKey ?? ""} />
            <input className="field mt-3" name="momoProvider" placeholder="Momo provider" defaultValue={paymentConfig?.momoProvider ?? "Paystack"} />
            <div className="mt-3 grid gap-2 text-sm">
              <label className="flex items-center gap-2"><input name="allowCash" type="checkbox" defaultChecked={paymentConfig?.allowCash ?? true} /> Cash</label>
              <label className="flex items-center gap-2"><input name="allowCard" type="checkbox" defaultChecked={paymentConfig?.allowCard ?? true} /> Card / Paystack</label>
              <label className="flex items-center gap-2"><input name="allowMomo" type="checkbox" defaultChecked={paymentConfig?.allowMomo ?? true} /> Mobile money</label>
            </div>
          </div>
          <Button>Save settings</Button>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="bg-[var(--shop-primary)] p-6 text-white">
          <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={56} height={56} className="rounded-[8px]" />
          <h2 className="mt-5 text-3xl font-semibold">{shop.name}</h2>
          <p className="mt-2 text-white/75">Brand preview for dashboards, receipts, and tracking pages.</p>
          <Link className="mt-5 inline-flex rounded-[8px] bg-white px-4 py-2 text-sm font-semibold text-slate-900" href={`/shop/${shop.slug}`}>
            Open public shop
          </Link>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {["Catalog", "POS", "Orders"].map((item) => (
            <div key={item} className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
              <p className="text-sm text-slate-500">{item}</p>
              <div className="mt-4 h-2 rounded-full bg-[var(--shop-secondary)]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
