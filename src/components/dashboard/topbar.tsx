import Link from "next/link";
import { Bell, CircleUserRound, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/rbac";

type TopbarProps = {
  session: SessionUser;
  shopId: string;
};

export async function DashboardTopbar({ session, shopId }: TopbarProps) {
  const [announcement, unreadNotifications] = await Promise.all([
    prisma.announcement.findFirst({
      where: {
        OR: [{ shopId }, { isGlobal: true }],
        dismissals: { none: { userId: session.id } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({
      where: { shopId, OR: [{ userId: session.id }, { userId: null }], readAt: null },
    }),
  ]);

  return (
    <header className="border-b border-[#ded8cd] bg-[#f6f4ef]/95 px-4 py-3 backdrop-blur">
      {announcement ? (
        <div className="mb-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          <span className="font-semibold">{announcement.title}:</span> {announcement.body}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="text-xl font-semibold text-slate-950">{session.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <form action="/dashboard/orders" className="hidden min-w-[300px] items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3 md:flex">
            <Search size={16} className="text-slate-400" />
            <input name="q" aria-label="Search orders" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Receipt, customer, item or SKU" />
          </form>
          <div className="relative rounded-[8px] border border-[#ded8cd] bg-white p-2 text-slate-700" title="Notifications">
            <Bell size={19} />
            {unreadNotifications > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                {unreadNotifications}
              </span>
            ) : null}
          </div>
          <Link href="/dashboard/settings" className="rounded-[8px] border border-[#ded8cd] bg-white p-2 text-[var(--shop-primary)]" title="Shop settings"><CircleUserRound size={19} /></Link>
        </div>
      </div>
    </header>
  );
}
