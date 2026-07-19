import Link from "next/link";
import { Megaphone, Plus, Power, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { createGlobalAnnouncementAction, toggleShopAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { compactNumber, currency, shortDate } from "@/lib/format";

export default async function AdminPage() {
  const [shops, shopCount, userCount, orderAggregate] = await Promise.all([
    prisma.shop.findMany({
      include: {
        _count: { select: { users: true, products: true, orders: true } },
        orders: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shop.count(),
    prisma.user.count(),
    prisma.order.aggregate({ _sum: { totalAmount: true }, _count: true }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Platform control</h1>
          <p className="mt-2 text-sm text-slate-600">Manage tenants, activation status, plans, usage, and global messages.</p>
        </div>
        <Link href="/admin/shops/new" className="inline-flex items-center gap-2 rounded-[8px] bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          <Plus size={16} /> Create shop
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Shops" value={compactNumber(shopCount)} icon={<Store size={20} />} />
        <StatCard label="Users" value={compactNumber(userCount)} />
        <StatCard label="Orders" value={compactNumber(orderAggregate._count)} />
        <StatCard label="Gross sales" value={currency(orderAggregate._sum.totalAmount?.toString() ?? "0")} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-xl font-semibold">Tenant shops</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
                <tr><th className="p-4">Shop</th><th className="p-4">Plan</th><th className="p-4">Users</th><th className="p-4">Products</th><th className="p-4">Orders</th><th className="p-4">Created</th><th className="p-4">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-[#ded8cd] bg-white">
                {shops.map((shop) => (
                  <tr key={shop.id}>
                    <td className="p-4">
                      <Link className="font-semibold text-slate-950 hover:underline" href={`/admin/shops/${shop.id}`}>{shop.name}</Link>
                      <p className="text-slate-500">/{shop.slug}</p>
                    </td>
                    <td className="p-4"><Badge>{shop.planTier}</Badge></td>
                    <td className="p-4">{shop._count.users}</td>
                    <td className="p-4">{shop._count.products}</td>
                    <td className="p-4">{shop._count.orders}</td>
                    <td className="p-4 text-slate-500">{shortDate(shop.createdAt)}</td>
                    <td className="p-4">
                      <form action={toggleShopAction}>
                        <input type="hidden" name="shopId" value={shop.id} />
                        <Button variant={shop.isActive ? "outline" : "primary"} className="min-h-8 px-2 py-1 text-xs">
                          <Power size={14} />
                          {shop.isActive ? "Suspend" : "Reactivate"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-slate-700" />
            <h2 className="text-xl font-semibold">Broadcast</h2>
          </div>
          <form action={createGlobalAnnouncementAction} className="space-y-3">
            <input className="field" name="title" placeholder="Announcement title" required />
            <textarea className="field min-h-28" name="body" placeholder="Message to every shop dashboard" required />
            <Button variant="secondary" className="w-full">Send announcement</Button>
          </form>
        </div>
      </section>
    </div>
  );
}
