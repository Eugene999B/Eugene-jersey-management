import Link from "next/link";
import { Plus, Power, Shield, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { DataTableShell } from "@/components/ui/data-table-shell";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { toggleShopAction } from "@/app/admin/actions";
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
  const atRiskShops = shops.filter((shop) => !shop.isActive || shop.subscriptionStatus === "PAST_DUE").slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Tenant administration" title="Businesses" description="Create, search, inspect, verify and manage tenant businesses." actions={<Link href="/admin/shops/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} /> Create business</Link>} />
      {params.error ? <FeedbackState state="error" title="Business action could not be completed" description="Check the submitted information and your platform access, then try again." /> : null}

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
          <DataTableShell label="Business directory"><table className="min-w-[1120px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Shop</th><th className="p-4">Plan</th><th className="p-4">Billing</th><th className="p-4">Usage</th><th className="p-4">Storefront</th><th className="p-4">Created</th><th className="p-4">Action</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">
            {visibleShops.map((shop) => <tr key={shop.id}><td className="p-4"><Link className="font-semibold text-slate-950 hover:underline" href={`/admin/shops/${shop.id}`}>{shop.name}</Link><p className="text-slate-500">/{shop.slug}</p></td><td className="p-4"><Badge tone={shop.subscriptionStatus === "ACTIVE" ? "green" : shop.subscriptionStatus === "PAST_DUE" ? "red" : "orange"}>{shop.planTier}</Badge><p className="mt-1 text-xs text-slate-500">{shop.subscriptionStatus}</p></td><td className="p-4"><p>{shop.billingCycle}</p><p className="text-xs text-slate-500">{shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}</p></td><td className="p-4"><p>{shop._count.users} users / {shop._count.products} products</p><p className="text-xs text-slate-500">{shop._count.orders} orders / {shop._count.debts} debts</p></td><td className="p-4"><div className="flex flex-wrap gap-2"><Badge tone={shop.storefrontEnabled ? "green" : "orange"}>{shop.storefrontEnabled ? "Visible" : "Offline by choice"}</Badge><Badge tone={shop.publicOrderingEnabled ? "blue" : "orange"}>{shop.publicOrderingEnabled ? "Ordering on" : "Ordering paused"}</Badge></div>{shop.storefrontEnabled ? <Link className="mt-2 inline-flex font-semibold text-[#0f766e] hover:underline" href={`/shop/${shop.slug}`}>Open storefront</Link> : <p className="mt-2 text-xs text-slate-500">Private dashboard remains registered and active.</p>}</td><td className="p-4 text-slate-500">{shortDate(shop.createdAt)}</td><td className="p-4"><form action={toggleShopAction}><input type="hidden" name="shopId" value={shop.id} /><ConfirmActionButton confirmation={shop.isActive ? `Suspend ${shop.name}? Staff will lose operational access until the business is reactivated.` : `Reactivate ${shop.name}? Staff will regain access subject to subscription controls.`} variant={shop.isActive ? "outline" : "primary"} size="sm"><Power size={14} />{shop.isActive ? "Suspend" : "Reactivate"}</ConfirmActionButton></form></td></tr>)}
            {!visibleShops.length ? <tr><td className="p-8 text-center text-slate-500" colSpan={7}>No shops match this search and status.</td></tr> : null}
          </tbody></table></DataTableShell>
        </div>

        <div className="panel p-5"><div className="mb-4 flex items-center gap-2"><Shield size={18} /><h2 className="text-xl font-semibold">Store risk watch</h2></div><p className="mb-4 text-sm text-slate-500">Only suspension and subscription problems appear here. A shop choosing to go offline is not a risk.</p><div className="grid gap-2">{atRiskShops.map((shop) => <Link key={shop.id} href={`/admin/shops/${shop.id}`} className="rounded-xl border border-[#ded8cd] bg-white p-3 text-sm transition hover:border-[#0f766e]"><p className="font-semibold">{shop.name}</p><p className="text-slate-500">{!shop.isActive ? "Suspended workspace" : "Subscription payment issue"}</p></Link>)}{!atRiskShops.length ? <p className="text-sm text-slate-500">All shops look healthy.</p> : null}</div></div>
      </section>
    </div>
  );
}
