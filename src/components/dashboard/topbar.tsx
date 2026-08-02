import Link from "next/link";
import { Bell, CircleUserRound, KeyRound, Plus, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { CopyLoginIdButton } from "@/components/auth/copy-login-id-button";
import { DashboardBreadcrumbs } from "@/components/dashboard/dashboard-breadcrumbs";
import { DashboardToolSearch } from "@/components/dashboard/dashboard-tool-search";
import { hasRole, permissions, type SessionUser } from "@/lib/rbac";
import type { SubscriptionFeature } from "@/lib/subscription-hardening";

type TopbarProps = {
  session: SessionUser;
  shop: { id: string; enabledModules: string[] };
  includedFeatures: readonly SubscriptionFeature[];
  pathname: string;
};

export async function DashboardTopbar({ session, shop, includedFeatures, pathname }: TopbarProps) {
  const [announcement, unreadNotifications, account] = await Promise.all([
    prisma.announcement.findFirst({
      where: {
        OR: [{ shopId: shop.id }, { isGlobal: true }],
        dismissals: { none: { userId: session.id } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({
      where: { shopId: shop.id, OR: [{ userId: session.id }, { userId: null }], readAt: null },
    }),
    prisma.user.findUnique({ where: { id: session.id }, select: { adminLoginId: true } }),
  ]);
  const loginId = account?.adminLoginId ?? session.email;
  const canSell = hasRole(session, permissions.pos);

  return (
    <header className="sticky top-0 z-30 border-b border-[#ded8cd] bg-[#f6f4ef]/95 px-3 py-2.5 shadow-sm backdrop-blur sm:px-4 sm:py-3 lg:px-6">
      {announcement ? (
        <div className="mb-2.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800 sm:mb-3 sm:text-sm">
          <span className="font-semibold">{announcement.title}:</span> {announcement.body}
        </div>
      ) : null}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <DashboardBreadcrumbs pathname={pathname} />
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-base font-semibold text-slate-950 sm:text-lg">{session.name}</h1>
            <span className="hidden truncate text-xs text-slate-500 sm:inline">{session.role.replaceAll("_", " ").toLowerCase()}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-950 xl:flex" title="Use this Login ID or your email on the sign-in page"><KeyRound size={15} /><span><span className="block text-[10px] font-bold uppercase tracking-wide text-cyan-700">Login ID</span><strong>{loginId}</strong></span><CopyLoginIdButton loginId={loginId} compact /></div>
          <DashboardToolSearch role={session.role} enabledModules={shop.enabledModules} includedFeatures={includedFeatures} />
          {canSell ? <Link href="/dashboard/pos" className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-[var(--shop-primary)] px-3 text-sm font-semibold text-white shadow-sm" aria-label="Quick sale"><Plus size={18} /><span className="hidden lg:inline">Quick sale</span></Link> : null}
          <span role="status" className="relative hidden min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#ded8cd] bg-white text-slate-700 sm:inline-flex" title="Notifications" aria-label={`${unreadNotifications} unread notifications`}>
            <Bell size={18} />
            {unreadNotifications > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unreadNotifications}</span> : null}
          </span>
          <Link href="/account/security" className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#ded8cd] bg-white text-slate-700 transition hover:text-[var(--shop-primary)] sm:inline-flex" title="Personal account security" aria-label="Open personal account security"><ShieldCheck size={18} /></Link>
          {hasRole(session, permissions.settings) ? <Link href="/dashboard/settings" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#ded8cd] bg-white text-[var(--shop-primary)]" title="Business settings" aria-label="Open business settings"><CircleUserRound size={18} /></Link> : <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#ded8cd] bg-white text-slate-400" title={session.role.replaceAll("_", " ")}><CircleUserRound size={18} /></span>}
        </div>
      </div>
    </header>
  );
}
