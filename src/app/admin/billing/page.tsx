import { BillingCycle, PlanTier, SubscriptionStatus } from "@prisma/client";
import { AlertTriangle, Banknote, CalendarClock, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { updateShopSubscriptionAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { compactNumber, currency, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type BillingPageProps = { searchParams?: Promise<{ error?: string }> };

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("billing");
  const shops = await prisma.shop.findMany({ orderBy: [{ subscriptionStatus: "asc" }, { name: "asc" }] });
  const recurring = shops.reduce((sum, shop) => {
    if (shop.subscriptionStatus !== "ACTIVE" && shop.subscriptionStatus !== "TRIAL") return sum;
    return sum + Number(shop.billingCycle === "YEARLY" ? Number(shop.yearlyPrice ?? 0) / 12 : shop.monthlyPrice ?? 0);
  }, 0);
  const pastDue = shops.filter((shop) => shop.subscriptionStatus === "PAST_DUE");
  const trials = shops.filter((shop) => shop.subscriptionStatus === "TRIAL");
  const renewals = shops.filter((shop) => shop.subscriptionRenewalAt).sort((a, b) => Number(a.subscriptionRenewalAt) - Number(b.subscriptionRenewalAt)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Revenue administration</p><h1 className="mt-2 text-3xl font-semibold">Billing</h1><p className="mt-2 text-sm text-slate-600">Manage plan tiers, billing cycles, renewal dates, prices and subscription status.</p></div>
      {params.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">The subscription update was not applied. Check the selected shop, prices and dates.</div> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Estimated MRR" value={currency(recurring)} icon={<Banknote size={20} />} /><StatCard label="Active tenants" value={compactNumber(shops.filter((shop) => shop.subscriptionStatus === "ACTIVE").length)} icon={<CreditCard size={20} />} /><StatCard label="Trials" value={compactNumber(trials.length)} icon={<CalendarClock size={20} />} /><StatCard label="Past due" value={compactNumber(pastDue.length)} icon={<AlertTriangle size={20} />} /></section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="panel p-5"><h2 className="text-xl font-semibold">Update subscription</h2><p className="mt-2 text-sm text-slate-500">Use this form only after confirming the tenant agreement and payment state.</p><form action={updateShopSubscriptionAction} className="mt-5 space-y-3"><select className="field" name="shopId" required><option value="">Select shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name} · {shop.subscriptionStatus}</option>)}</select><div className="grid grid-cols-2 gap-3"><select className="field" name="planTier" defaultValue={PlanTier.PRO}>{Object.values(PlanTier).map((plan) => <option key={plan} value={plan}>{plan}</option>)}</select><select className="field" name="billingCycle" defaultValue={BillingCycle.MONTHLY}>{Object.values(BillingCycle).map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}</select></div><select className="field" name="subscriptionStatus" defaultValue={SubscriptionStatus.ACTIVE}>{Object.values(SubscriptionStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select><div className="grid gap-3 sm:grid-cols-3"><input className="field" name="monthlyPrice" type="number" min="0" step="0.01" placeholder="Monthly" /><input className="field" name="yearlyPrice" type="number" min="0" step="0.01" placeholder="Yearly" /><input className="field" name="subscriptionRenewalAt" type="date" /></div><Button className="w-full">Save subscription</Button></form></div>

        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Tenant billing register</h2><p className="mt-1 text-sm text-slate-500">Current commercial status for every shop.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Shop</th><th className="p-4">Plan</th><th className="p-4">Cycle</th><th className="p-4">Price</th><th className="p-4">Renewal</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">{shops.map((shop) => <tr key={shop.id}><td className="p-4 font-semibold">{shop.name}</td><td className="p-4">{shop.planTier}</td><td className="p-4">{shop.billingCycle}</td><td className="p-4">{shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}</td><td className="p-4 text-slate-500">{shop.subscriptionRenewalAt ? shortDate(shop.subscriptionRenewalAt) : "Not set"}</td><td className="p-4"><Badge tone={shop.subscriptionStatus === "ACTIVE" ? "green" : shop.subscriptionStatus === "PAST_DUE" ? "red" : "orange"}>{shop.subscriptionStatus}</Badge></td></tr>)}</tbody></table></div></div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2"><div className="panel p-5"><h2 className="text-xl font-semibold">Past-due attention</h2><div className="mt-4 space-y-2">{pastDue.map((shop) => <div key={shop.id} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm"><p className="font-semibold text-red-900">{shop.name}</p><p className="mt-1 text-red-700">Renewal {shop.subscriptionRenewalAt ? shortDate(shop.subscriptionRenewalAt) : "not recorded"}</p></div>)}{!pastDue.length ? <p className="text-sm text-slate-500">No tenants are currently marked past due.</p> : null}</div></div><div className="panel p-5"><h2 className="text-xl font-semibold">Upcoming renewals</h2><div className="mt-4 space-y-2">{renewals.map((shop) => <div key={shop.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"><div><p className="font-semibold">{shop.name}</p><p className="text-slate-500">{shop.billingCycle} · {shop.planTier}</p></div><span className="font-semibold text-slate-700">{shortDate(shop.subscriptionRenewalAt!)}</span></div>)}</div></div></section>
    </div>
  );
}
