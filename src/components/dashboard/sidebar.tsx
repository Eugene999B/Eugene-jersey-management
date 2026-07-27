"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Boxes, ClipboardCheck, ClipboardList, CreditCard, FileDown, LayoutDashboard, Link2, Menu, MessageCircle, MoreHorizontal, Palette, Settings, ShoppingCart, Tags, Truck, Users, X } from "lucide-react";
import { clsx } from "clsx";
import type { Role } from "@prisma/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { BrandImage } from "@/components/ui/brand-image";
import { canSeeNav, roleLabels } from "@/lib/rbac";

const navItems = [
  { section: "Run shop", key: "dashboard", href: "/dashboard", label: "Overview", shortLabel: "Home", icon: LayoutDashboard },
  { section: "Run shop", key: "pos", href: "/dashboard/pos", label: "Sales & POS", shortLabel: "POS", icon: ShoppingCart },
  { section: "Run shop", key: "orders", href: "/dashboard/orders", label: "Orders & production", shortLabel: "Orders", icon: ClipboardList },
  { section: "Run shop", key: "designs", href: "/dashboard/designs", label: "Design Studio", shortLabel: "Design", icon: Palette },
  { section: "Customers", key: "customers", href: "/dashboard/customers", label: "Customer records", shortLabel: "Customers", icon: Users },
  { section: "Customers", key: "debts", href: "/dashboard/debts", label: "Credit & debts", shortLabel: "Debts", icon: CreditCard },
  { section: "Customers", key: "messages", href: "/dashboard/messages", label: "Messages", shortLabel: "Messages", icon: MessageCircle },
  { section: "Stock & supply", key: "catalog", href: "/dashboard/catalog", label: "Products & stock", shortLabel: "Stock", icon: Boxes },
  { section: "Stock & supply", key: "suppliers", href: "/dashboard/suppliers", label: "Suppliers", shortLabel: "Suppliers", icon: Truck },
  { section: "Stock & supply", key: "network", href: "/dashboard/network", label: "Partner shops", shortLabel: "Network", icon: Link2 },
  { section: "Controls", key: "closing", href: "/dashboard/closing", label: "Daily closing", shortLabel: "Closing", icon: ClipboardCheck },
  { section: "Controls", key: "commerce", href: "/dashboard/commerce", label: "Online selling", shortLabel: "Online", icon: Tags },
  { section: "Controls", key: "reports", href: "/dashboard/reports", label: "Reports", shortLabel: "Reports", icon: BarChart3 },
  { section: "Controls", key: "exports", href: "/dashboard/exports", label: "Export centre", shortLabel: "Exports", icon: FileDown },
  { section: "Team & setup", key: "staff", href: "/dashboard/staff", label: "Staff & permissions", shortLabel: "Staff", icon: Users },
  { section: "Team & setup", key: "activity", href: "/dashboard/activity", label: "Activity & security", shortLabel: "Activity", icon: Activity },
  { section: "Team & setup", key: "settings", href: "/dashboard/settings", label: "Shop settings", shortLabel: "Settings", icon: Settings },
] as const;
const navSections = ["Run shop", "Customers", "Stock & supply", "Controls", "Team & setup"] as const;
const mobilePrimaryKeys = ["dashboard", "pos", "orders", "catalog"] as const;

type SidebarProps = {
  role: Role;
  shop: { name: string; logoUrl: string | null; planTier: string };
  variant?: "desktop" | "mobile";
};

function isItemActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function DashboardSidebar({ role, shop, variant = "desktop" }: SidebarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const visible = canSeeNav(role);
  const items = navItems.filter((item) => visible[item.key]);
  const currentItem = items.find((item) => isItemActive(pathname, item.href));
  const primaryItems = mobilePrimaryKeys.flatMap((key) => {
    const item = items.find((candidate) => candidate.key === key);
    return item ? [item] : [];
  });

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  if (variant === "mobile") {
    return (
      <>
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <BrandImage src={shop.logoUrl} alt={shop.name} width={40} height={40} className="shrink-0 rounded-xl object-cover" priority />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-950">{shop.name}</p>
              <p className="truncate text-xs text-slate-500">{currentItem?.label ?? roleLabels[role]}</p>
            </div>
            <button
              type="button"
              aria-label="Open all shop tools"
              aria-expanded={menuOpen}
              aria-controls="mobile-shop-navigation"
              onClick={() => setMenuOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-95"
            >
              <Menu size={21} />
            </button>
          </div>
        </header>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur lg:hidden"
          aria-label="Quick shop navigation"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}>
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition",
                    active ? "bg-[var(--shop-primary)] text-white" : "text-slate-600 active:bg-slate-100",
                  )}
                >
                  <Icon size={19} />
                  <span className="max-w-full truncate">{item.shortLabel}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Show all shop tools"
              className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-slate-600 active:bg-slate-100"
            >
              <MoreHorizontal size={20} />
              <span>More</span>
            </button>
          </div>
        </nav>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All shop tools">
            <button type="button" aria-label="Close shop tools" className="absolute inset-0 bg-slate-950/55" onClick={() => setMenuOpen(false onClick={() => setMenuOpen(false)} />
            <aside id="mobile-shop-navigation" className="absolute inset-y-0 left-0 flex w-[min(88vw,370px)] flex-col bg-white shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-200 p-4">
                <BrandImage src={shop.logoUrl} alt={shop.name} width={44} height={44} className="shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-950">{shop.name}</p>
                  <p className="text-xs text-slate-500">{roleLabels[role]} · {shop.planTier} plan</p>
                </div>
                <button type="button" aria-label="Close all shop tools" onClick={() => setMenuOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <X size={21} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto overscroll-contain p-3" aria-label="All shop navigation">
                {navSections.map((section) => {
                  const sectionItems = items.filter((item) => item.section === section);
                  if (!sectionItems.length) return null;
                  return (
                    <section key={section} className="mb-5 last:mb-0">
                      <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section}</p>
                      <div className="space-y-1">
                        {sectionItems.map((item) => {
                          const Icon = item.icon;
                          const active = isItemActive(pathname, item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              prefetch={false}
                              onClick={() => setMenuOpen(false)}
                              aria-current={active ? "page" : undefined}
                              className={clsx(
                                "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                                active ? "bg-[var(--shop-primary)] text-white" : "text-slate-700 active:bg-slate-100",
                              )}
                            >
                              <Icon size={19} />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </nav>
              <div className="border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <LogoutButton className="min-h-12 w-full justify-start text-slate-700 hover:bg-red-50 hover:text-red-700" />
              </div>
            </aside>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <aside className="flex h-full min-h-screen flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <BrandImage src={shop.logoUrl} alt={shop.name} width={42} height={42} className="rounded-xl object-cover" priority />
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-950">{shop.name}</p><p className="text-xs text-slate-500">{shop.planTier} plan</p></div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow="Shop navigation">
        {navSections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (!sectionItems.length) return null;
          return <div key={section}><p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section}</p><div className="space-y-1">{sectionItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);
            return <Link key={item.href} href={item.href} prefetch={false} aria-current={active ? "page" : undefined} className={clsx("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-[var(--shop-primary)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}><Icon size={18} />{item.label}</Link>;
          })}</div></div>;
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="mb-3 rounded-xl bg-slate-100 p-3"><p className="text-xs text-slate-500">Signed in as</p><p className="text-sm font-semibold text-slate-800">{roleLabels[role]}</p></div>
        <LogoutButton className="w-full justify-start text-slate-600 hover:bg-red-50 hover:text-red-700" />
      </div>
    </aside>
  );
}
