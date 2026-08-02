"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal, X } from "lucide-react";
import { clsx } from "clsx";
import type { Role } from "@prisma/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { BrandImage } from "@/components/ui/brand-image";
import { roleLabels } from "@/lib/rbac";
import {
  isShopNavigationItemActive,
  mobilePrimaryShopKeys,
  shopNavigationSections,
  visibleShopNavigationItems,
  type ShopNavItem,
} from "@/lib/shop-navigation";
import type { SubscriptionFeature } from "@/lib/subscription-hardening";

type SidebarProps = {
  role: Role;
  shop: { name: string; logoUrl: string | null; planTier: string; enabledModules: string[] };
  includedFeatures: readonly SubscriptionFeature[];
  variant?: "desktop" | "mobile";
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

const recentStorageKey = "esm.dashboard.recent-tools";

function recentNavigationItems(items: readonly ShopNavItem[], hrefs: readonly string[], pathname: string) {
  return hrefs
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is ShopNavItem => Boolean(item) && !isShopNavigationItemActive(pathname, item.href))
    .slice(0, 3);
}

export function DashboardSidebar({ role, shop, includedFeatures, variant = "desktop", collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);
  const items = useMemo(
    () => visibleShopNavigationItems(role, shop.enabledModules, includedFeatures),
    [role, shop.enabledModules, includedFeatures],
  );
  const currentItem = items.find((item) => isShopNavigationItemActive(pathname, item.href));
  const primaryItems = mobilePrimaryShopKeys.flatMap((key) => {
    const item = items.find((candidate) => candidate.key === key);
    return item ? [item] : [];
  });
  const recentItems = recentNavigationItems(items, recentHrefs, pathname);

  useEffect(() => {
    const saved = window.localStorage.getItem(recentStorageKey);
    if (saved) {
      try {
        setRecentHrefs(JSON.parse(saved) as string[]);
      } catch {
        window.localStorage.removeItem(recentStorageKey);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentItem) return;
    setRecentHrefs((current) => {
      const next = [currentItem.href, ...current.filter((href) => href !== currentItem.href)].slice(0, 5);
      window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
      return next;
    });
  }, [currentItem]);

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
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur lg:hidden" aria-label="Quick shop navigation">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}>
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = isShopNavigationItemActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} prefetch={false} aria-current={active ? "page" : undefined} className={clsx("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition", active ? "bg-[var(--shop-primary)] text-white shadow-sm" : "text-slate-600 active:bg-slate-100")}>
                  <Icon size={19} />
                  <span className="max-w-full truncate">{item.shortLabel}</span>
                </Link>
              );
            })}
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Show all shop tools" aria-expanded={menuOpen} aria-controls="mobile-shop-navigation" className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-slate-600 active:bg-slate-100">
              <MoreHorizontal size={20} />
              <span>More</span>
            </button>
          </div>
        </nav>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All shop tools">
            <button type="button" aria-label="Close shop tools" className="absolute inset-0 bg-slate-950/55" onClick={() => setMenuOpen(false)} />
            <aside id="mobile-shop-navigation" className="absolute inset-y-0 right-0 flex w-[min(92vw,390px)] flex-col bg-white shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-200 p-4">
                <BrandImage src={shop.logoUrl} alt={shop.name} width={44} height={44} className="shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-950">{shop.name}</p>
                  <p className="text-xs text-slate-500">{roleLabels[role]} · {shop.planTier} plan</p>
                </div>
                <button type="button" aria-label="Close all shop tools" onClick={() => setMenuOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><X size={21} /></button>
              </div>
              <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" aria-label="All shop navigation">
                {shopNavigationSections.map((section) => {
                  const sectionItems = items.filter((item) => item.section === section && !mobilePrimaryShopKeys.includes(item.key));
                  if (!sectionItems.length) return null;
                  return (
                    <section key={section} className="mb-5 last:mb-0">
                      <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section}</p>
                      <div className="space-y-1">
                        {sectionItems.map((item) => {
                          const Icon = item.icon;
                          const active = isShopNavigationItemActive(pathname, item.href);
                          return <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={clsx("flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-[var(--shop-primary)] text-white" : "text-slate-700 active:bg-slate-100")}><Icon size={19} /><span className="min-w-0 flex-1">{item.label}</span></Link>;
                        })}
                      </div>
                    </section>
                  );
                })}
              </nav>
              <div className="border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><LogoutButton className="min-h-12 w-full justify-start text-slate-700 hover:bg-red-50 hover:text-red-700" /></div>
            </aside>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <aside className="sticky top-0 flex h-screen min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className={clsx("relative flex min-h-[73px] items-center border-b border-slate-200", collapsed ? "justify-center p-3" : "gap-3 p-4")}>
        <BrandImage src={shop.logoUrl} alt={shop.name} width={42} height={42} className="shrink-0 rounded-xl object-cover" priority />
        {!collapsed ? <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-950">{shop.name}</p><p className="text-xs text-slate-500">{shop.planTier} plan</p></div> : null}
        <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand shop sidebar" : "Collapse shop sidebar"} aria-expanded={!collapsed} className={clsx("inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900", collapsed && "absolute left-[62px] top-4 border border-slate-200 bg-white shadow-sm")}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className={clsx("min-h-0 flex-1 overflow-y-auto", collapsed ? "p-2" : "p-3")} aria-label="Shop navigation">
        <div className={clsx(collapsed ? "space-y-1" : "space-y-4")}>
          {shopNavigationSections.map((section) => {
            const sectionItems = items.filter((item) => item.section === section);
            if (!sectionItems.length) return null;
            return (
              <section key={section}>
                {!collapsed ? <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section}</p> : null}
                <div className="space-y-1">
                  {sectionItems.map((item) => {
                    const Icon = item.icon;
                    const active = isShopNavigationItemActive(pathname, item.href);
                    return <Link key={item.href} href={item.href} prefetch={false} title={collapsed ? item.label : undefined} aria-label={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={clsx("flex min-h-11 items-center rounded-xl text-sm font-semibold transition", collapsed ? "justify-center px-2" : "gap-3 px-3", active ? "bg-[var(--shop-primary)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}><Icon size={19} />{!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}</Link>;
                  })}
                </div>
              </section>
            );
          })}
        </div>
        {!collapsed && recentItems.length ? (
          <section className="mt-5 border-t border-slate-200 pt-4">
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Recently used</p>
            <div className="space-y-1">{recentItems.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Icon size={16} /><span className="truncate">{item.label}</span></Link>; })}</div>
          </section>
        ) : null}
      </nav>
      <div className={clsx("border-t border-slate-200", collapsed ? "p-2" : "p-3")}>
        {!collapsed ? <div className="mb-3 rounded-xl bg-slate-100 p-3"><p className="text-xs text-slate-500">Signed in as</p><p className="text-sm font-semibold text-slate-800">{roleLabels[role]}</p></div> : null}
        <LogoutButton className={clsx("text-slate-600 hover:bg-red-50 hover:text-red-700", collapsed ? "w-full justify-center px-2" : "w-full justify-start")} label="Sign out" iconOnly={collapsed} />
      </div>
    </aside>
  );
}
