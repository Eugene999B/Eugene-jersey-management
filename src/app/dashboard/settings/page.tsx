import Image from "next/image";
import { Button } from "@/components/ui/button";
import { updateShopSettingsAction } from "@/app/dashboard/settings/actions";
import { getTenantContext } from "@/lib/tenant";

export default async function SettingsPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

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
          <Button>Save branding</Button>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="bg-[var(--shop-primary)] p-6 text-white">
          <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={56} height={56} className="rounded-[8px]" />
          <h2 className="mt-5 text-3xl font-semibold">{shop.name}</h2>
          <p className="mt-2 text-white/75">Brand preview for dashboards, receipts, and tracking pages.</p>
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
