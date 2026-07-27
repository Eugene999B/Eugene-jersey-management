import Link from "next/link";
import { Megaphone, Plus, Power, Shield, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createGlobalAnnouncementAction, toggleShopAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { currency, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type ShopsPageProps = { searchParams?: Promise<{ error?: string; q?: string; shopStatus?: string }> };

export default async function ShopsPage({ searchParams }: ShopsPageProps) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("shops");
  const shops = await prisma.shop.findMany({
    include: { _count: { select: { users: true, products: true, orders: true, debts: true } }, orders: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const query = params.q?.trim().toLocaleLowerCase() ?? "";
  const status = params.shopStatus ?? "all";
  const visibleShops = shops.filter((shop) => {
    const matchesQuery = !query || `${shop.name} ${shop.slug} ${shop.networkCode ?? ""}`.toLocaleLowerCase().includes(query);
    const matchesStatus = status === "all" || (status === "active" && shop.isActive) || (status === "suspended" && !shop.isActive) || (status === "past-due" && shop.subscriptionStatus === "PAST_DUE");
    return matchesQuery && matchesStatus;
  });
  const atRiskShops = shops.filter((shop) => !shop.isActive || shop.subscriptionStatus === "PAST_DUE" || !shop.publicOrderingEnabled || !shop.orders.length).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Tenant administration</p><h1 className="mt-2 text-3xl font-semibold">Shops</h1><p className="mt-2 text-sm text-slate-600">Create, search, inspect, verify, suspend and communicate with tenant businesses.</p></div><Link href="/admin/shops/new" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} /> Create shop</Link></div>
      {params.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">The shop action could not be completed. Check the submitted information and your access.</div> : null}

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><Store size={19} /><h2 className="text-xl font-semibold">Tenant directory</h2></div><p className="mt-1 text-sm text-slate-500">Find a shop before changing access or opening its full profile.</p></div><span className="text-sm font-semibold text-slate-500">{visibleShops.length} of {shops.length}</span></div>
            <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
              <input className="field" name="q" defaultValue={params.q ?? ""} placeholder="Search shop, slug or network code" />
              <select className="field" name="shopStatus" defaultValue={status}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="past-due">Past due</option></select>
              <button type="submit" className="rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Apply</button>
            </form>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Shop</th><th className="p-4">Plan</th><th className="p-4">Billing</th><th className="p-4">Usage</th><th className="p-4">Storefront</th><th className="p-4">Created</th><th className="p-4">Action</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">
            {visibleShops.map((shop) => <tr key={shop.id}><td className="p-4"><Link className="font-semibold text-slate-950 hover:underline" href={`/admin/shops/${shop.id}`}>{shop.name}</Link><p className="text-slate-500">/{shop.slug}</p></td><td className="p-4"><Badge tone={shop.subscriptionStatus === "ACTIVE" ? "green" : shop.subscriptionStatus === "PAST_DUE" ? "red" : "orange"}>{shop.planTier}</Badge><p className="mt-1 text-xs text-slate-500">{shop.subscriptionStatus}</p></td><td className="p-4"><p>{shop.billingCycle}</p><p className="text-xs text-slate-500">{shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}</p></td><td className="p-4"><p>{shop._count.users} users / {shop._count.products} products</p><p className="text-xs text-slate-500">{shop._count.orders} orders / {shop._count.debts} debts</p></td><td className="p-4"><Link className="font-semibold text-[#0f766e] hover:underline" href={`/shop/${shop.slug}`}>Open storefront</Link><p className="text-xs text-slate-500">{shop.publicOrderingEnabled ? "Orders on" : "Orders off"}</p></td><td className="p-4 text-slate-500">{shortDate(shop.createdAt)}</td><td className="p-4"><form action={toggleShopAction}><input type="hidden" name="shopId" value={shop.id} /><Button variant={shop.isActive ? "outline" : "primary"} className="min-h-8 px-2 py-1 text-xs"><Power size={14} />{shop.isActive ? "Suspend" : "Reactivate"}</Button></form></td></tr>)}
            {!visibleShops.length ? <tr><td className="p-8 text-center text-slate-500" colSpan={7}>No shops match this search and status.</td></tr> : null}
          </tbody></table></div>
        </div>

        <div className="grid content-start gap-5">
          <div className="panel p-5"><div className="mb-4 flex items-center gap-2"><Megaphone size={18} /><h2 className="text-xl font-semibold">Platform broadcast</h2></div><p className="mb-4 text-sm text-slate-500">Publish an announcement to every shop dashboard.</p><form action={createGlobalAnnouncementAction} className="space-y-3"><input className="field" name="title" placeholder="Announcement title" required /><textarea className="field min-h-28" name="body" placeholder="Message to every shop dashboard" required /><Button variant="secondary" className="w-full">Send announcement</Button></form></div>
          <div className="panel p-5"><div className="mb-4 flex items-center gap-2"><Shield size={18} /><h2 className="text-xl font-semibold">Store risk watch</h2></div><div className="grid gap-2">{atRiskShops.map((shop) => <Link key={shop.id} href={`/admin/shops/${shop.id}`} className="rounded-xl border border-[#ded8cd] bg-white p-3 text-sm transition hover:border-[#0f766e]"><p className="font-semibold">{shop.name}</p><p className="text-slate-500">{!shop.isActive ? "Suspended" : shop.subscriptionStatus === "PAST_DUE" ? "Payment issue" : !shop.publicOrderingEnabled ? "Ordering off" : "No recent orders"}</p></Link>)}{!atRiskShops.length ? <p className="text-sm text-slate-500">All shops look healthy.</p> : null}</div></div>
        </div>
      </section>
    </div>
  );
}
