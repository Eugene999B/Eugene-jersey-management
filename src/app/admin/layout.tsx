import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, MessageCircle, UsersRound } from "lucide-react";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireRole } from "@/lib/auth";
import { canAccessPlatformPermission, getAllowedPlatformPermissions, platformAdminHomePath } from "@/lib/platform-admin";
import { permissions } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireRole(permissions.superAdmin);
  const allowedPermissions = await getAllowedPlatformPermissions(session.id);
  const homePath = platformAdminHomePath(allowedPermissions);
  const canManageShops = canAccessPlatformPermission(allowedPermissions, "shops");
  const canSupport = canAccessPlatformPermission(allowedPermissions, "support");

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-[#081528] text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-white/10">
          <div className="flex h-full flex-col">
            <div className="border-b border-white/10 p-5">
              <Link href={homePath} prefetch={false} className="flex items-center gap-3">
                <Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={48} height={48} priority />
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/75">Platform control</p><h1 className="mt-1 text-lg font-semibold">Super Admin</h1></div>
              </Link>
            </div>
            <AdminNavigation allowedPermissions={allowedPermissions} />
            <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
              <div className="rounded-xl bg-white/[0.07] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Signed in as</p><p className="mt-1 truncate text-sm font-semibold">{session.name}</p><p className="mt-1 truncate text-xs text-white/55">{session.email}</p></div>
              <LogoutButton className="mt-3 w-full bg-white text-slate-950 hover:bg-slate-100" />
            </div>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image className="lg:hidden" src="/brand/ejm-mark.svg" alt="" width={38} height={38} />
                <div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-cyan-700">Eugene Jersey Management</p><h2 className="text-lg font-semibold">Platform operations centre</h2></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold" href="/shops" prefetch={false}><UsersRound size={16} /> Marketplace</Link>
                {canManageShops ? <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold" href="/admin/shops/new" prefetch={false}><Building2 size={16} /> New shop</Link> : null}
                {canSupport ? <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#081528] px-3 text-sm font-semibold text-white" href="/admin/support" prefetch={false}><MessageCircle size={16} /> Issues</Link> : null}
                <LogoutButton className="border border-slate-200 bg-white text-slate-800 lg:hidden" />
              </div>
            </div>
          </header>
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
