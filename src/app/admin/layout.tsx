import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, BarChart3, Building2, CreditCard, LifeBuoy, LogOut, MessageCircle, Settings, Shield, Store, UserCog, UsersRound } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const adminNav = [
  { href: "/admin#overview", label: "Overview", icon: BarChart3 },
  { href: "/admin#shops", label: "Shops", icon: Store },
  { href: "/admin#workers", label: "Admin staff", icon: UserCog },
  { href: "/admin#support", label: "Support desk", icon: LifeBuoy },
  { href: "/admin#billing", label: "Billing", icon: CreditCard },
  { href: "/admin#activity", label: "Activity logs", icon: Activity },
  { href: "/admin#security", label: "Security", icon: Shield },
  { href: "/admin#settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireRole(permissions.superAdmin);

  return (
    <div className="min-h-screen bg-[#eef1f3] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-white/10">
          <div className="flex h-full flex-col">
            <div className="border-b border-white/10 p-5">
              <Link href="/admin" className="flex items-center gap-3">
                <span className="rounded-[8px] bg-white/10 p-3"><Shield size={24} /></span>
                <div>
                  <p className="text-sm text-white/55">Platform Command</p>
                  <h1 className="text-xl font-semibold">Super Admin</h1>
                </div>
              </Link>
            </div>

            <nav className="flex gap-2 overflow-x-auto p-3 lg:grid lg:overflow-visible">
              {adminNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-[8px] px-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white" href={item.href}>
                    <Icon size={17} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
              <div className="rounded-[8px] bg-white/8 p-3">
                <p className="text-xs uppercase text-white/45">Signed in as</p>
                <p className="mt-1 truncate text-sm font-semibold">{session.name}</p>
                <p className="mt-1 truncate text-xs text-white/55">{session.email}</p>
              </div>
              <Link className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-white px-3 text-sm font-semibold text-slate-950" href="/logout">
                <LogOut size={16} /> Sign out
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-[#0f766e]">Eugene Jersey Management</p>
                <h2 className="text-lg font-semibold">Platform operations center</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm font-semibold" href="/shops">
                  <UsersRound size={16} /> Buyer marketplace
                </Link>
                <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm font-semibold" href="/admin/shops/new">
                  <Building2 size={16} /> New shop
                </Link>
                <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-3 text-sm font-semibold text-white" href="/admin#support">
                  <MessageCircle size={16} /> Issues
                </Link>
                <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm font-semibold lg:hidden" href="/logout">
                  <LogOut size={16} /> Sign out
                </Link>
              </div>
            </div>
          </header>
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
