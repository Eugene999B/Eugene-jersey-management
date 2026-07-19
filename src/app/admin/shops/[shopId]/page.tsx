import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { toggleShopAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function AdminShopDetailPage({ params }: Props) {
  const { shopId } = await params;
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      users: { orderBy: { createdAt: "desc" } },
      paymentConfig: true,
      _count: { select: { products: true, orders: true, customers: true, debts: true, suppliers: true, dailyClosings: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 8, include: { user: true } },
    },
  });

  if (!shop) notFound();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sales = await prisma.order.aggregate({
    where: { shopId: shop.id, createdAt: { gte: thirtyDaysAgo }, status: { not: "CANCELLED" } },
    _sum: { totalAmount: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link className="text-sm font-semibold text-slate-500 hover:text-slate-950" href="/admin">Back to shops</Link>
          <h1 className="mt-2 text-3xl font-semibold">{shop.name}</h1>
          <p className="mt-1 text-sm text-slate-600">/{shop.slug} - code {shop.networkCode ?? "not assigned"} - created {shortDate(shop.createdAt)}</p>
        </div>
        <form action={toggleShopAction}>
          <input type="hidden" name="shopId" value={shop.id} />
          <Button variant={shop.isActive ? "outline" : "primary"}>{shop.isActive ? "Suspend shop" : "Reactivate shop"}</Button>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Plan" value={shop.planTier} />
        <StatCard label="Status" value={shop.isActive ? "Active" : "Suspended"} />
        <StatCard label="Products" value={String(shop._count.products)} />
        <StatCard label="30-day sales" value={currency(sales._sum.totalAmount?.toString() ?? "0", shop.currency)} />
        <StatCard label="Renewal" value={shop.subscriptionRenewalAt ? shortDate(shop.subscriptionRenewalAt) : "Not set"} />
        <StatCard label="Suppliers" value={String(shop._count.suppliers)} />
        <StatCard label="Debt records" value={String(shop._count.debts)} />
        <StatCard label="Closings" value={String(shop._count.dailyClosings)} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm font-semibold uppercase text-slate-500">Payment routing</p>
          <h2 className="mt-2 text-xl font-semibold">{shop.paymentConfig?.paystackSubaccountCode ? "Subaccount ready" : "Needs subaccount"}</h2>
          <p className="mt-2 text-sm text-slate-500">{shop.paymentConfig?.paystackSubaccountCode ?? "Add a Paystack subaccount in shop settings before live online payments."}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm font-semibold uppercase text-slate-500">Mobile money</p>
          <h2 className="mt-2 text-xl font-semibold">{shop.paymentConfig?.shopMomoNumber ?? "Not set"}</h2>
          <p className="mt-2 text-sm text-slate-500">{shop.paymentConfig?.shopMomoNetwork ?? "Shop can add its own settlement line."}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm font-semibold uppercase text-slate-500">Billing</p>
          <h2 className="mt-2 text-xl font-semibold">{shop.billingCycle}</h2>
          <p className="mt-2 text-sm text-slate-500">{shop.subscriptionStatus} - {shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-xl font-semibold">Users</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
              <tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#ded8cd] bg-white">
              {shop.users.map((user) => (
                <tr key={user.id}>
                  <td className="p-3">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-slate-500">{user.email}</p>
                  </td>
                  <td className="p-3"><Badge>{titleCase(user.role)}</Badge></td>
                  <td className="p-3"><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Disabled"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-xl font-semibold">Recent audit log</h2>
          </div>
          <div className="divide-y divide-[#ded8cd] bg-white">
            {shop.auditLogs.map((log) => (
              <div key={log.id} className="p-4 text-sm">
                <p className="font-semibold">{log.action}</p>
                <p className="text-slate-500">{log.user?.email ?? "System"} - {shortDate(log.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
