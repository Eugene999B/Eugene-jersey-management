import Link from "next/link";
import { Bell, CircleUserRound, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, permissions, type SessionUser } from "@/lib/rbac";

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
    <header className="border-b border-[#ded8cd] bg-[#f6f4ef]/95 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
      {announcement ? (
        <div className="mb-2.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800 sm:mb-3 sm:text-sm">
          <span className="font-semibold">{announcement.title}:</span> {announcement.body}
        </div>
      ) : null}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 sm:text-sm">Welcome back</p>
          <h1 className="truncate text-base font-semibold text-slate-950 sm:text-xl">{session.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <form action="/dashboard/orders" className="hidden min-w-[300px] items-center gap-2 rounded-lg border border-[#ded8cd] bg-white px-3 md:flex">
            <Search size={16} className="text-slate-400" />
            <input name="q" aria-label="Search orders" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Receipt, customer, item or SKU" />
          </form>
          <Link href="/dashboard/orders" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[#ded8cd] bg-white text-slate-700 md:hidden" title="Search orders" aria-label="Search orders">
            <Search size={18} />
          </Link>
          <div className="relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[#ded8cd] bg-white text-slate-700" title="Notifications" aria-label={`${unreadNotifications} unread notifications`}>
            <Bell size={18} />
            {unreadNotifications > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                {unreadNotifications}
              </span>
            ) : null}
          </div>
          {hasRole(session, permissions.settings) ? <Link href="/dashboard/settings" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[#ded8cd] bg-white text-[var(--shop-primary)]" title="Shop settings" aria-label="Open shop settings"><CircleUserRound size={18} /></Link> : <span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[#ded8cd] bg-white text-slate-400" title={session.role.replaceAll("_", " ")}><CircleUserRound size={18} /></span>}
        </div>
      </div>
    </header>
  );
}
