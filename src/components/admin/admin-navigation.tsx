"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, BarChart3, CreditCard, HeartPulse, LifeBuoy, Megaphone, Menu, MoreHorizontal, Settings, Shield, Store, UserCog, X } from "lucide-react";
import type { PlatformPermission } from "@/lib/platform-admin";

interface AdminNavigationProps {
  allowedPermissions: PlatformPermission[] | null;
  variant?: "desktop" | "mobile";
}

const adminNav = [
  { href: "/admin", label: "Overview", shortLabel: "Home", icon: BarChart3, permission: null },
  { href: "/admin/shops", label: "Shops", shortLabel: "Shops", icon: Store, permission: "shops" },
  { href: "/admin/staff", label: "Admin staff", shortLabel: "Staff", icon: UserCog, permission: "workers" },
  { href: "/admin/support", label: "Support desk", shortLabel: "Support", icon: LifeBuoy, permission: "support" },
  { href: "/admin/billing", label: "Billing", shortLabel: "Billing", icon: CreditCard, permission: "billing" },
  { href: "/admin/broadcast", label: "Broadcast", shortLabel: "Broadcast", icon: Megaphone, permission: "broadcast" },
  { href: "/admin/activity", label: "Activity logs", shortLabel: "Activity", icon: Activity, permission: "activity" },
  { href: "/admin/security", label: "Security", shortLabel: "Security", icon: Shield, permission: "security" },
  { href: "/admin/integrations", label: "Integrations", shortLabel: "Health", icon: HeartPulse, permission: "settings" },
  { href: "/admin/settings", label: "Settings", shortLabel: "Settings", icon: Settings, permission: "settings" },
] as const satisfies ReadonlyArray<{ href: string; label: string; shortLabel: string; icon: typeof BarChart3; permission: PlatformPermission | null }>;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavigation({ allowedPermissions, variant = "desktop" }: AdminNavigationProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleItems = adminNav.filter((item) => {
    if (item.permission === null) return allowedPermissions === null;
    return allowedPermissions === null || allowedPermissions.includes(item.permission);
  });

  if (variant === "mobile") {
    const primaryItems = visibleItems.slice(0, Math.min(4, visibleItems.length));
    return (
      <>
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open platform tools" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold lg:hidden"><Menu size={18} /> Tools</button>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur lg:hidden" aria-label="Quick admin navigation">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}>
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return <Link key={item.href} href={item.href} prefetch={false} aria-label={`Quick ${item.shortLabel}`} aria-current={active ? "page" : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${active ? "bg-[#081528] text-white" : "text-slate-600 active:bg-slate-100"}`}><Icon size={18} /><span className="max-w-full truncate">{item.shortLabel}</span></Link>;
            })}
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Show all platform tools" className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-slate-600 active:bg-slate-100"><MoreHorizontal size={19} /><span>More</span></button>
          </div>
        </nav>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All platform tools">
            <button type="button" aria-label="Close platform tools" className="absolute inset-0 bg-slate-950/60" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,370px)] flex-col bg-[#081528] text-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/70">Platform control</p><h2 className="mt-1 text-lg font-semibold">All admin tools</h2></div><button type="button" aria-label="Close all platform tools" onClick={() => setMenuOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/10"><X size={20} /></button></div>
              <nav className="flex-1 overflow-y-auto p-3" aria-label="All admin navigation">
                <div className="space-y-1">{visibleItems.map((item) => { const Icon = item.icon; const active = isActive(pathname, item.href); return <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-cyan-300 text-[#081528]" : "text-white/75 active:bg-white/10"}`}><Icon size={18} />{item.label}</Link>; })}</div>
              </nav>
            </aside>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <nav className="grid p-3" aria-label="Admin pages">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} prefetch={false} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-300/50 ${active ? "bg-cyan-300 text-[#081528]" : "text-white/68 hover:bg-white/10 hover:text-white"}`} href={item.href}><Icon size={17} />{item.label}</Link>
        );
      })}
    </nav>
  );
}
