"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal, Shield, X } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  adminNavigationSections,
  isAdminNavigationItemActive,
  mobilePrimaryAdminHrefs,
  visibleAdminNavigationItems,
} from "@/lib/admin-navigation";
import type { PlatformPermission } from "@/lib/platform-admin";

interface AdminNavigationProps {
  allowedPermissions: PlatformPermission[] | null;
  variant?: "desktop" | "mobile";
}

export function AdminNavigation({ allowedPermissions, variant = "desktop" }: AdminNavigationProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleItems = visibleAdminNavigationItems(allowedPermissions);
  const primaryItems = mobilePrimaryAdminHrefs.flatMap((href) => {
    const item = visibleItems.find((candidate) => candidate.href === href);
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
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur lg:hidden" aria-label="Quick admin navigation">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}>
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = isAdminNavigationItemActive(pathname, item.href);
              return <Link key={item.href} href={item.href} prefetch={false} aria-label={`Quick ${item.shortLabel}`} aria-current={active ? "page" : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${active ? "bg-[#081528] text-white" : "text-slate-600 active:bg-slate-100"}`}><Icon size={18} /><span className="max-w-full truncate">{item.shortLabel}</span></Link>;
            })}
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Show all platform tools" aria-expanded={menuOpen} className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-slate-600 active:bg-slate-100"><MoreHorizontal size={19} /><span>More</span></button>
          </div>
        </nav>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All platform tools">
            <button type="button" aria-label="Close platform tools" className="absolute inset-0 bg-slate-950/60" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 right-0 flex w-[min(92vw,390px)] flex-col overflow-hidden bg-[#081528] text-white shadow-2xl">
              <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/10 p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/70">Platform control</p><h2 className="mt-1 text-lg font-semibold">All administrator tools</h2></div><button type="button" aria-label="Close all platform tools" onClick={() => setMenuOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/10"><X size={20} /></button></div>
              <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="All admin navigation">
                {adminNavigationSections.map((section) => {
                  const sectionItems = visibleItems.filter((item) => item.section === section && !mobilePrimaryAdminHrefs.includes(item.href as (typeof mobilePrimaryAdminHrefs)[number]));
                  if (!sectionItems.length) return null;
                  return <section key={section} className="mb-5 last:mb-0"><p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200/55">{section}</p><div className="space-y-1">{sectionItems.map((item) => { const Icon = item.icon; const active = isAdminNavigationItemActive(pathname, item.href); return <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-cyan-300 text-[#081528]" : "text-white/75 active:bg-white/10"}`}><Icon size={18} />{item.label}</Link>; })}</div></section>;
                })}
              </nav>
              <div className="shrink-0 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><Link href="/account/security" prefetch={false} onClick={() => setMenuOpen(false)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white"><Shield size={17} /> Personal security</Link><LogoutButton className="mt-2 w-full bg-white text-slate-950 hover:bg-slate-100" /></div>
            </aside>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Admin pages">
      <div className="space-y-5">
        {adminNavigationSections.map((section) => {
          const sectionItems = visibleItems.filter((item) => item.section === section);
          if (!sectionItems.length) return null;
          return <section key={section}><p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200/45">{section}</p><div className="space-y-1">{sectionItems.map((item) => { const Icon = item.icon; const active = isAdminNavigationItemActive(pathname, item.href); return <Link key={item.href} prefetch={false} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-300/50 ${active ? "bg-cyan-300 text-[#081528]" : "text-white/68 hover:bg-white/10 hover:text-white"}`} href={item.href}><Icon size={17} />{item.label}</Link>; })}</div></section>;
        })}
      </div>
    </nav>
  );
}
