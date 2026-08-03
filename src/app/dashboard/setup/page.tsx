import Link from "next/link";
import { BusinessType, Prisma } from "@prisma/client";
import { Check, Circle, Factory, MapPinned, PackagePlus, Settings2, Sparkles, Users } from "lucide-react";
import { createProductAction } from "@/app/dashboard/catalog/actions";
import {
  completeBusinessOnboardingAction,
  reviewOnboardingModulesAction,
  reviewOnboardingStaffAction,
  saveOnboardingBusinessTypeAction,
  saveOnboardingIdentityAction,
  saveOnboardingLocationAction,
  saveOnboardingMoneyAction,
  saveOnboardingPaymentsAction,
  saveOnboardingProductionAction,
  saveOnboardingReceiptAction,
} from "@/app/dashboard/setup/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/brand";
import { businessModuleEnabled, OPTIONAL_BUSINESS_MODULES } from "@/lib/business-modules";
import { currency } from "@/lib/format";
import { GHANA_REGIONS } from "@/lib/ghana-locations";
import { platformDb } from "@/lib/platform-db";
import { prisma } from "@/lib/db";
import { permissions } from "@/lib/rbac";
import { requireRole } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";

type Props = { searchParams?: Promise<{ step?: string; error?: string; saved?: string; production?: string }> };

type ProductionRecord = Record<string, unknown>;
function productionRecord(value: Prisma.JsonValue): ProductionRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as ProductionRecord : {};
}
function productionText(value: ProductionRecord, key: string, fallback = "") {
  return typeof value[key] === "string" ? String(value[key]) : fallback;
}

const setupSteps = [
  [1, "Business identity", "Confirm the name customers and staff should see."],
  [2, "Business type", "Choose the operating model that best describes the business."],
  [3, "Location", "Save the real Ghana operating location and address."],
  [4, "Modules", "Review the tools enabled by the platform administrator and current plan."],
  [5, "Currency and tax", "Set the operating currency and default tax rate."],
  [6, "Payment methods", "Choose which payment methods the business accepts."],
  [7, "Receipt details", "Set the short receipt message and customer footer."],
  [8, "Staff", "Review owner access and add staff when required."],
  [9, "First item or service", "Create the first thing the business sells or provides."],
  [10, "Opening stock", "Confirm a positive opening quantity, or use a service item."],
] as const;

const errorCopy: Record<string, string> = {
  identity: "Enter a valid business name.",
  "business-type": "Choose a valid business type.",
  location: "Choose a Ghana region and enter the district and town.",
  money: "Use a three-letter currency code and a tax rate from 0 to 100.",
  payments: "Choose at least one accepted payment method.",
  receipt: "Check the receipt header and footer lengths.",
  production: "Complete every production field with the real operator information available today.",
  incomplete: "Setup is not complete yet. Finish the highlighted core steps, create an item, add opening stock, and complete the production extension when required.",
};

export default async function BusinessSetupPage({ searchParams }: Props) {
  await requireRole(permissions.settings);
  const params = (await searchParams) ?? {};
  const { session, shop } = await getTenantContext();
  if (!shop) return null;

  const [location, paymentConfig, staffCount, productCount, serviceCount, stockedVariantCount, machineProfiles] = await Promise.all([
    platformDb.shopLocation.findUnique({ where: { shopId: shop.id } }),
    prisma.shopPaymentConfig.findUnique({ where: { shopId: shop.id } }),
    prisma.user.count({ where: { shopId: shop.id, isActive: true } }),
    prisma.product.count({ where: { shopId: shop.id } }),
    prisma.product.count({ where: { shopId: shop.id, isService: true } }),
    prisma.productVariant.count({ where: { product: { shopId: shop.id, isService: false }, stockQty: { gt: 0 } } }),
    prisma.shopMachineProfile.findMany({ where: { shopId: shop.id, isActive: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ]);

  const completed = new Set(shop.onboardingCompletedSteps);
  if (productCount > 0) completed.add(9);
  const stockReady = shop.businessType === BusinessType.SERVICES || serviceCount > 0 || stockedVariantCount > 0;
  if (stockReady) completed.add(10);
  const completedCount = setupSteps.filter(([number]) => completed.has(number)).length;
  const currentStep = Math.min(10, Math.max(1, Number(params.step ?? shop.onboardingCurrentStep) || 1));
  const enabledProduction = businessModuleEnabled(shop.enabledModules, "PRINTING_PRODUCTION");
  const needsProduction = enabledProduction || shop.businessType === BusinessType.PRODUCTION_PRINTING;
  const production = productionRecord(shop.productionSetup);
  const productionReady = production.configured === true;
  const canComplete = completedCount === 10 && (!needsProduction || productionReady);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Guided business setup</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Configure {shop.name} around the real business.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Each section saves to the same business, payment, location, catalogue and production records used by daily operations. Nothing is copied into a disconnected checklist.</p>
          </div>
          <Badge tone={shop.onboardingCompletedAt ? "green" : "orange"}>{shop.onboardingCompletedAt ? "Setup complete" : `${completedCount}/10 complete`}</Badge>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${completedCount * 10}%` }} /></div>
      </section>

      {params.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{errorCopy[params.error] ?? "The setup change could not be saved."}</div> : null}
      {params.saved ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Setup section saved. Continue with the next highlighted section.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Setup progress">
        {setupSteps.map(([number, title, description]) => {
          const done = completed.has(number);
          const selected = currentStep === number;
          return <Link key={number} href={`/dashboard/setup?step=${number}#step-${number}`} className={`min-h-32 rounded-xl border p-4 transition ${selected ? "border-cyan-500 bg-cyan-50 shadow-sm" : done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Step {number}</span>{done ? <Check size={18} className="text-emerald-700" /> : <Circle size={18} className={selected ? "text-cyan-700" : "text-slate-300"} />}</div>
            <p className="mt-3 font-bold text-slate-950">{title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
          </Link>;
        })}
      </section>

      <section id="step-1" className={`panel scroll-mt-24 p-5 ${currentStep === 1 ? "ring-2 ring-cyan-400" : ""}`}>
        <div className="flex items-center gap-3"><Sparkles size={21} /><div><h2 className="text-xl font-bold">1. Business identity</h2><p className="text-sm text-slate-500">This name appears in the workspace, marketplace and receipts.</p></div></div>
        <form action={saveOnboardingIdentityAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-sm font-semibold">Business name<input className="field mt-1" name="name" defaultValue={shop.name} required /></label>
          <Button className="self-end">Save identity</Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Logo and brand colours remain available under <Link className="font-semibold text-cyan-700" href="/dashboard/settings">Business settings</Link>.</p>
      </section>

      <section id="step-2" className={`panel scroll-mt-24 p-5 ${currentStep === 2 ? "ring-2 ring-cyan-400" : ""}`}>
        <h2 className="text-xl font-bold">2. Business type</h2><p className="mt-1 text-sm text-slate-500">This controls recommendations; it does not delete records or silently enable paid tools.</p>
        <form action={saveOnboardingBusinessTypeAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-sm font-semibold">Operating model<select className="field mt-1" name="businessType" defaultValue={shop.businessType}>{BUSINESS_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <Button className="self-end">Save business type</Button>
        </form>
      </section>

      <section id="step-3" className={`panel scroll-mt-24 p-5 ${currentStep === 3 ? "ring-2 ring-cyan-400" : ""}`}>
        <div className="flex items-center gap-3"><MapPinned size={21} /><div><h2 className="text-xl font-bold">3. Operating location</h2><p className="text-sm text-slate-500">Use the real place customers, deliveries and staff should recognise.</p></div></div>
        <form action={saveOnboardingLocationAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">Region<select className="field mt-1" name="region" defaultValue={location?.region ?? "Greater Accra"}>{GHANA_REGIONS.map((region) => <option key={region.code} value={region.name}>{region.name}</option>)}</select></label>
          <label className="text-sm font-semibold">District<input className="field mt-1" name="district" defaultValue={location?.district ?? ""} required /></label>
          <label className="text-sm font-semibold">Town<input className="field mt-1" name="town" defaultValue={location?.town ?? shop.city ?? ""} required /></label>
          <label className="text-sm font-semibold">Area / suburb<input className="field mt-1" name="area" defaultValue={location?.area ?? ""} /></label>
          <label className="text-sm font-semibold">Digital address<input className="field mt-1 uppercase" name="digitalAddress" defaultValue={location?.digitalAddress ?? ""} /></label>
          <label className="text-sm font-semibold">Street address<input className="field mt-1" name="streetAddress" defaultValue={location?.streetAddress ?? ""} /></label>
          <label className="text-sm font-semibold md:col-span-2">Landmark<input className="field mt-1" name="landmark" defaultValue={location?.landmark ?? ""} /></label>
          <Button className="md:col-span-2 md:justify-self-start">Save location</Button>
        </form>
      </section>

      <section id="step-4" className={`panel scroll-mt-24 p-5 ${currentStep === 4 ? "ring-2 ring-cyan-400" : ""}`}>
        <div className="flex items-center gap-3"><Settings2 size={21} /><div><h2 className="text-xl font-bold">4. Enabled modules</h2><p className="text-sm text-slate-500">Only platform-approved, plan-supported modules appear in daily navigation.</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{OPTIONAL_BUSINESS_MODULES.map((module) => { const enabled = businessModuleEnabled(shop.enabledModules, module.key); return <div key={module.key} className={`rounded-xl border p-4 ${enabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between gap-3"><strong>{module.label}</strong><Badge tone={enabled ? "green" : module.status === "PLANNED" ? "orange" : "gray"}>{enabled ? "Enabled" : module.status === "PLANNED" ? "Planned" : "Not enabled"}</Badge></div><p className="mt-2 text-xs leading-5 text-slate-600">{module.description}</p></div>; })}</div>
        <form action={reviewOnboardingModulesAction} className="mt-4 flex flex-wrap gap-3"><Button>Modules reviewed</Button><Button asChild variant="outline"><Link href="/dashboard/subscription">Review plan and usage</Link></Button></form>
      </section>

      <section id="step-5" className={`panel scroll-mt-24 p-5 ${currentStep === 5 ? "ring-2 ring-cyan-400" : ""}`}>
        <h2 className="text-xl font-bold">5. Currency and tax</h2><p className="mt-1 text-sm text-slate-500">Tax is stored as the business default for later checkout and reporting rules.</p>
        <form action={saveOnboardingMoneyAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-semibold">Currency<input className="field mt-1 uppercase" name="currency" defaultValue={shop.currency} maxLength={3} required /></label>
          <label className="text-sm font-semibold">Default tax rate (%)<input className="field mt-1" name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={Number(shop.taxRate)} required /></label>
          <Button className="self-end">Save money settings</Button>
        </form>
      </section>

      <section id="step-6" className={`panel scroll-mt-24 p-5 ${currentStep === 6 ? "ring-2 ring-cyan-400" : ""}`}>
        <h2 className="text-xl font-bold">6. Accepted payment methods</h2><p className="mt-1 text-sm text-slate-500">Gateway readiness and settlement routing remain protected under Business settings.</p>
        <form action={saveOnboardingPaymentsAction} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[['allowCash','Cash',paymentConfig?.allowCash ?? true],['allowMomo','Mobile Money',paymentConfig?.allowMomo ?? true],['allowCard','Card',paymentConfig?.allowCard ?? true]].map(([name,label,checked]) => <label key={String(name)} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 font-semibold"><input name={String(name)} type="checkbox" defaultChecked={Boolean(checked)} />{String(label)}</label>)}
          </div>
          <Button>Save payment methods</Button>
        </form>
      </section>

      <section id="step-7" className={`panel scroll-mt-24 p-5 ${currentStep === 7 ? "ring-2 ring-cyan-400" : ""}`}>
        <h2 className="text-xl font-bold">7. Receipt details</h2><p className="mt-1 text-sm text-slate-500">Keep thermal receipt text short and useful.</p>
        <form action={saveOnboardingReceiptAction} className="mt-4 grid gap-3">
          <label className="text-sm font-semibold">Receipt header<input className="field mt-1" name="receiptHeader" defaultValue={shop.receiptHeader ?? "Thank you for choosing us."} maxLength={240} /></label>
          <label className="text-sm font-semibold">Receipt footer<textarea className="field mt-1 min-h-20" name="receiptFooter" defaultValue={shop.receiptFooter ?? "Please keep this receipt for your records."} maxLength={500} /></label>
          <Button className="justify-self-start">Save receipt details</Button>
        </form>
      </section>

      {needsProduction ? <section className={`rounded-2xl border p-5 ${productionReady ? "border-emerald-200 bg-emerald-50/50" : "border-violet-200 bg-violet-50/60"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><Factory size={22} /><div><h2 className="text-xl font-bold">Production-business extension</h2><p className="text-sm text-slate-600">Record the real manual production setup. Do not guess a machine protocol or claim electronic heat-press control.</p></div></div><Badge tone={productionReady ? "green" : "orange"}>{productionReady ? "Configured" : "Required"}</Badge></div>
        <form action={saveOnboardingProductionAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">Cutter / plotter<input className="field mt-1" name="cutterName" defaultValue={productionText(production, "cutterName", machineProfiles[0]?.name ?? "Model not yet identified")} required /></label>
          <label className="text-sm font-semibold">Current connection<input className="field mt-1" name="cutterConnection" defaultValue={productionText(production, "cutterConnection", "Connection not yet verified")} required /></label>
          <label className="text-sm font-semibold">Heat press<input className="field mt-1" name="heatPress" defaultValue={productionText(production, "heatPress", "Manual clamshell heat press")} required /></label>
          <label className="text-sm font-semibold">Default deposit (%)<input className="field mt-1" name="defaultDepositPercent" type="number" min="0" max="100" defaultValue={shop.defaultDepositPercent} required /></label>
          <label className="text-sm font-semibold">Materials<textarea className="field mt-1 min-h-24" name="materials" defaultValue={productionText(production, "materials", "Standard heat-transfer vinyl, transfer tape")} required /></label>
          <label className="text-sm font-semibold">Garment types<textarea className="field mt-1 min-h-24" name="garmentTypes" defaultValue={productionText(production, "garmentTypes", "T-shirts, jerseys, shorts")} required /></label>
          <label className="text-sm font-semibold">Print locations<textarea className="field mt-1 min-h-24" name="printLocations" defaultValue={productionText(production, "printLocations", "Left chest, full front, upper back, sleeve, shorts leg")} required /></label>
          <label className="text-sm font-semibold">Standard artwork sizes<textarea className="field mt-1 min-h-24" name="artworkSizes" defaultValue={productionText(production, "artworkSizes", "Record actual millimetre dimensions after measuring garments")} required /></label>
          <label className="text-sm font-semibold md:col-span-2">Production stages<textarea className="field mt-1 min-h-24" name="productionStages" defaultValue={productionText(production, "productionStages", "Design requested, customer approval, ready to cut, cutting, weeding, ready to press, heat pressing, quality check, ready for collection, completed")} required /></label>
          <Button className="md:col-span-2 md:justify-self-start">Save production setup</Button>
        </form>
      </section> : null}

      <section id="step-8" className={`panel scroll-mt-24 p-5 ${currentStep === 8 ? "ring-2 ring-cyan-400" : ""}`}>
        <div className="flex items-center gap-3"><Users size={21} /><div><h2 className="text-xl font-bold">8. Staff and permissions</h2><p className="text-sm text-slate-500">{staffCount} active staff account(s), including the owner.</p></div></div>
        <div className="mt-4 flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/dashboard/staff">Open staff directory</Link></Button><form action={reviewOnboardingStaffAction}><Button>Staff reviewed</Button></form></div>
      </section>

      <section id="step-9" className={`panel scroll-mt-24 p-5 ${currentStep === 9 ? "ring-2 ring-cyan-400" : ""}`}>
        <div className="flex items-center gap-3"><PackagePlus size={21} /><div><h2 className="text-xl font-bold">9. First item or service</h2><p className="text-sm text-slate-500">{productCount ? `${productCount} item(s) already exist.` : "Create a simple starting record now; full options remain available in Items."}</p></div></div>
        {productCount ? <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><Check className="text-emerald-700" /><span className="font-semibold">First item requirement complete.</span><Button asChild variant="outline"><Link href="/dashboard/catalog">Manage items</Link></Button></div> : <form action={createProductAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">Item or service name<input className="field mt-1" name="name" placeholder="Blue cotton T-shirt or phone repair" required /></label>
          <label className="text-sm font-semibold">Base price<input className="field mt-1" name="basePrice" type="number" min="0.01" step="0.01" required /></label>
          <label className="text-sm font-semibold">Option / size<input className="field mt-1" name="size" defaultValue="Standard" /></label>
          <label className="text-sm font-semibold">Opening quantity<input className="field mt-1" name="stockQty" type="number" min="0" defaultValue="1" /></label>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-semibold"><input name="isService" type="checkbox" />This is a service with no stock limit</label>
          <input type="hidden" name="sku" value="" /><input type="hidden" name="productType" value="Stocked product" />
          <Button>Create first item</Button>
        </form>}
      </section>

      <section id="step-10" className={`panel scroll-mt-24 p-5 ${currentStep === 10 ? "ring-2 ring-cyan-400" : ""}`}>
        <h2 className="text-xl font-bold">10. Opening stock</h2><p className="mt-1 text-sm text-slate-500">A service business can satisfy this with a service item. Stocked businesses need at least one positive variant quantity.</p>
        <div className={`mt-4 rounded-xl border p-4 ${stockReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{stockReady ? "Opening stock is ready" : "Opening stock still needs attention"}</p><p className="mt-1 text-sm text-slate-600">Positive stocked variants: {stockedVariantCount} · Service items: {serviceCount}</p></div><Button asChild variant="outline"><Link href="/dashboard/catalog">Review stock</Link></Button></div></div>
      </section>

      <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-black text-cyan-950">Finish guided setup</h2><p className="mt-1 text-sm text-cyan-900/75">Completion is server-verified against real location, payment, item, stock and production records.</p></div><form action={completeBusinessOnboardingAction}><Button disabled={!canComplete}>Complete business setup</Button></form></div>
        {!canComplete ? <p className="mt-3 text-xs font-semibold text-cyan-900/70">Remaining: {10 - completedCount} core step(s){needsProduction && !productionReady ? " and the production extension" : ""}.</p> : <p className="mt-3 text-xs font-semibold text-emerald-800">All requirements are ready. Complete setup to return to the operating dashboard.</p>}
      </section>

      <p className="text-center text-xs text-slate-500">Current operating currency: {currency(0, shop.currency)} · Signed in as {session.name}</p>
    </div>
  );
}
