import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { BookOpen, Building2, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { AdminPageHelp } from "@/components/admin/admin-page-help";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireRole } from "@/lib/auth";
import { canAccessPlatformPermission, getAllowedPlatformPermissions, platformAdminHomePath } from "@/lib/platform-admin";
import { permissions } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireRole(permissions.superAdmin);
  const allowedPermissions = await getAllowedPlatformPermissions(session.id);
  const pathname = (await headers()).get("x-pathname") || "/admin";
  const homePath = platformAdminHomePath(allowedPermissions);
  const canManageShops = canAccessPlatformPermission(allowedPermissions, "shops");
  const canSupport = canAccessPlatformPermission(allowedPermissions, "support");

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="hidden overflow-hidden border-r border-white/10 bg-[#081528] text-white lg:sticky lg:top-0 lg:block lg:h-screen">
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-white/10 p-5">
              <Link href={homePath} prefetch={false} className="flex items-center gap-3">
                <Image src="/brand/esm-mark.svg" alt="Eugene Shop Management" width={48} height={48} priority />
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/75">Platform control</p><h1 className="mt-1 text-lg font-semibold">Super Admin</h1></div>
              </Link>
            </div>
            <AdminNavigation allowedPermissions={allowedPermissions} />
            <div className="shrink-0 border-t border-white/10 p-4">
              <div className="rounded-xl bg-white/[0.07] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Signed in as</p><p className="mt-1 truncate text-sm font-semibold">{session.name}</p><p className="mt-1 truncate text-xs text-white/55">{session.email}</p></div>
              <Link href="/account/security" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white transition hover:bg-white/10"><ShieldCheck size={17} />Personal security</Link>
              <LogoutButton className="mt-3 w-full bg-white text-slate-950 hover:bg-slate-100" />
            </div>
          </div>
        </aside>
        <div className="min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4 lg:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link href={homePath} prefetch={false} className="shrink-0 lg:hidden" aria-label="Administrator home"><Image src="/brand/esm-mark.svg" alt="Eugene Shop Management" width={38} height={38} /></Link>
                <div className="min-w-0"><AdminBreadcrumbs pathname={pathname} homePath={homePath} /><h2 className="mt-1 truncate text-base font-semibold sm:text-lg">Platform operations centre</h2></div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AdminNavigation allowedPermissions={allowedPermissions} variant="mobile" />
                <Link className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700" href="/admin/help" prefetch={false} title="Open administrator help" aria-label="Open administrator help"><BookOpen size={17} /></Link>
                <Link className="hidden min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 sm:inline-flex" href="/account/security" prefetch={false} title="Personal account security" aria-label="Open personal account security"><ShieldCheck size={17} /></Link>
                <Link className="hidden min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold sm:inline-flex" href="/shops" prefetch={false}><UsersRound size={16} /> Marketplace</Link>
                {canManageShops ? <Link className="hidden min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold md:inline-flex" href="/admin/shops/new" prefetch={false}><Building2 size={16} /> New business</Link> : null}
                {canSupport ? <Link className="hidden min-h-10 items-center justify-center gap-2 rounded-xl bg-[#081528] px-3 text-sm font-semibold text-white md:inline-flex" href="/admin/support" prefetch={false}><MessageCircle size={16} /> Issues</Link> : null}
                <LogoutButton className="hidden border border-slate-200 bg-white text-slate-800 sm:inline-flex lg:hidden" />
              </div>
            </div>
          </header>
          <main className="min-w-0 overflow-x-clip p-3 sm:p-4 lg:p-6">{allowedPermissions === null ? <AdminPageHelp pathname={pathname} /> : null}{children}</main>
        </div>
      </div>
    </div>
  );
}
