import Link from "next/link";
import { OrderStatus, ReturnRequestStatus } from "@prisma/client";
import { Activity, AlertTriangle, Banknote, CheckCircle2, CreditCard, LifeBuoy, Plus, Shield, Store, TrendingUp, UserCog } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { prisma } from "@/lib/db";
import { compactNumber, currency, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type AdminPageProps = { searchParams?: Promise<{ error?: string }> };

const destinations = [
  { href: "/admin/shops", title: "Shops", text: "Create, inspect, suspend and verify tenant businesses.", icon: Store },
  { href: "/admin/staff", title: "Admin staff", text: "Create platform workers and control their access.", icon: UserCog },
  { href: "/admin/support", title: "Support", text: "Resolve returns, conversations and delayed orders.", icon: LifeBuoy },
  { href: "/admin/billing", title: "Billing", text: "Manage subscriptions, renewals and payment status.", icon: CreditCard },
  { href: "/admin/security", title: "Security", text: "Review failed sign-ins, sessions and safeguards.", icon: Shield },
  { href: "/admin/activity", title: "Activity", text: "Trace platform and tenant administrative actions.", icon: Activity },
] as const;

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission();
  const staleOrderDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [shops, shopCount, userCount, buyerCount, orderAggregate, debtAggregate, recentLogs, returnCount, openThreadCount, stuckOrderCount, failedMessages] = await Promise.all([
    prisma.shop.findMany({ select: { isActive: true, subscriptionStatus: true, billingCycle: true, monthlyPrice: true, yearlyPrice: true }, orderBy: { createdAt: "desc" } }),
    prisma.shop.count(),
    prisma.user.count(),
    prisma.buyerAccount.count(),
    prisma.order.aggregate({ _sum: { totalAmount: true }, _count: true }),
    prisma.debt.aggregate({ _sum: { principalAmount: true, paidAmount: true }, _count: true }),
    prisma.auditLog.findMany({ include: { user: true, shop: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.returnRequest.count({ where: { status: { in: [ReturnRequestStatus.REQUESTED, ReturnRequestStatus.APPROVED, ReturnRequestStatus.RECEIVED] } } }),
    prisma.customerThread.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.order.count({ where: { status: { in: [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION] }, createdAt: { lte: staleOrderDate } } }),
    prisma.customerMessage.count({ where: { status: "FAILED" } }),
  ]);

  const activeShops = shops.filter((shop) => shop.isActive).length;
  const pastDueShops = shops.filter((shop) => shop.subscriptionStatus === "PAST_DUE").length;
  const recurring = shops.reduce((sum, shop) => {
    if (shop.subscriptionStatus !== "ACTIVE" && shop.subscriptionStatus !== "TRIAL") return sum;
    return sum + Number(shop.billingCycle === "YEARLY" ? Number(shop.yearlyPrice ?? 0) / 12 : shop.monthlyPrice ?? 0);
  }, 0);
  const openDebt = Number(debtAggregate._sum.principalAmount ?? 0) - Number(debtAggregate._sum.paidAmount ?? 0);
  const supportQueue = returnCount + openThreadCount + stuckOrderCount + failedMessages;

  return (
    <div className="space-y-6">
      {params.error === "permission" ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Your platform role does not include access to that admin page.</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Platform overview</p><h1 className="mt-2 text-3xl font-semibold">Command centre</h1><p className="mt-2 text-sm text-slate-600">A summary only. Detailed work now lives on its own dedicated admin page.</p></div>
        <Link href="/admin/shops/new" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} /> Create shop</Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Shops" value={compactNumber(shopCount)} icon={<Store size={20} />} />
        <StatCard label="Active shops" value={compactNumber(activeShops)} icon={<CheckCircle2 size={20} />} />
        <StatCard label="Users" value={compactNumber(userCount)} />
        <StatCard label="Buyers" value={compactNumber(buyerCount)} />
        <StatCard label="Orders" value={compactNumber(orderAggregate._count)} />
        <StatCard label="Gross sales" value={currency(orderAggregate._sum.totalAmount?.toString() ?? "0")} icon={<TrendingUp size={20} />} />
        <StatCard label="Open debt" value={currency(openDebt)} icon={<Banknote size={20} />} />
        <StatCard label="Estimated MRR" value={currency(recurring)} helper="Active and trial tenant pricing" />
        <StatCard label="Support queue" value={compactNumber(supportQueue)} icon={<LifeBuoy size={20} />} />
        <StatCard label="Past due shops" value={compactNumber(pastDueShops)} icon={<AlertTriangle size={20} />} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {destinations.map(({ href, title, text, icon: Icon }) => (
          <Link key={href} href={href} prefetch={false} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-cyan-300"><Icon size={20} /></span>
            <h2 className="mt-4 text-lg font-semibold group-hover:text-cyan-800">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
          </Link>
        ))}
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#ded8cd] p-5"><div><h2 className="text-xl font-semibold">Latest platform activity</h2><p className="mt-1 text-sm text-slate-500">The most recent administrative events across all tenants.</p></div><Link href="/admin/activity" className="text-sm font-semibold text-cyan-800">Open activity log</Link></div>
        <div className="divide-y divide-[#ded8cd] bg-white">
          {recentLogs.map((log) => <div key={log.id} className="p-4 text-sm"><p className="font-semibold">{log.action}</p><p className="mt-1 text-slate-500">{log.shop?.name ?? "Platform"} · {log.user?.email ?? "System"} · {shortDate(log.createdAt)}</p></div>)}
          {!recentLogs.length ? <p className="p-5 text-sm text-slate-500">No activity has been recorded yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
