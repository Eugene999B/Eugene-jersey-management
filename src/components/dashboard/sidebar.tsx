"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Boxes, ClipboardCheck, ClipboardList, CreditCard, FileDown, LayoutDashboard, Link2, LogOut, MessageCircle, Palette, Settings, ShoppingCart, Tags, Truck, Users } from "lucide-react";
import { clsx } from "clsx";
import type { Role } from "@prisma/client";
import { canSeeNav, roleLabels } from "@/lib/rbac";

const navItems = [
  { section: "Run shop", key: "dashboard", href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { section: "Run shop", key: "pos", href: "/dashboard/pos", label: "Sales & POS", icon: ShoppingCart },
  { section: "Run shop", key: "orders", href: "/dashboard/orders", label: "Orders & production", icon: ClipboardList },
  { section: "Run shop", key: "designs", href: "/dashboard/designs", label: "Transfer studio", icon: Palette },
  { section: "Customers", key: "customers", href: "/dashboard/customers", label: "Customer records", icon: Users },
  { section: "Customers", key: "debts", href: "/dashboard/debts", label: "Credit & debts", icon: CreditCard },
  { section: "Customers", key: "messages", href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  { section: "Stock & supply", key: "catalog", href: "/dashboard/catalog", label: "Products & stock", icon: Boxes },
  { section: "Stock & supply", key: "suppliers", href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
  { section: "Stock & supply", key: "network", href: "/dashboard/network", label: "Partner shops", icon: Link2 },
  { section: "Controls", key: "closing", href: "/dashboard/closing", label: "Daily closing", icon: ClipboardCheck },
  { section: "Controls", key: "commerce", href: "/dashboard/commerce", label: "Online selling", icon: Tags },
  { section: "Controls", key: "reports", href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { section: "Controls", key: "exports", href: "/dashboard/exports", label: "Reports & exports", icon: FileDown },
  { section: "Team & setup", key: "staff", href: "/dashboard/staff", label: "Staff & permissions", icon: Users },
  { section: "Team & setup", key: "activity", href: "/dashboard/activity", label: "Activity & security", icon: Activity },
  { section: "Team & setup", key: "settings", href: "/dashboard/settings", label: "Shop settings", icon: Settings },
] as const;

const navSections = ["Run shop", "Customers", "Stock & supply", "Controls", "Team & setup"] as const;

type SidebarProps = {
  role: Role;
  shop: {
    name: string;
    logoUrl: string | null;
    planTier: string;
  };
  variant?: "desktop" | "mobile";
};

export function DashboardSidebar({ role, shop, variant = "desktop" }: SidebarProps) {
  const pathname = usePathname();
  const visible = canSeeNav(role);
  const items = navItems.filter((item) => visible[item.key]);

  if (variant === "mobile") {
    return (
      <section className="border-b border-[#ded8cd] bg-[#fffdf8]">
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={38} height={38} className="rounded-[8px]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{shop.name}</p>
              <p className="text-xs text-slate-500">{roleLabels[role]}</p>
            </div>
          </div>
          <Link
            href="/logout"
            prefetch={false}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <LogOut size={16} />
            Sign out
          </Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={clsx(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold transition",
                  isActive ? "bg-[var(--shop-primary)] text-white" : "bg-white text-slate-700 hover:bg-[#f6f4ef]",
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </section>
    );
  }

  return (
    <aside className="flex h-full min-h-screen flex-col border-r border-[#ded8cd] bg-[#fffdf8]">
      <div className="border-b border-[#ded8cd] p-4">
        <div className="flex items-center gap-3">
          <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={42} height={42} className="rounded-[8px]" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{shop.name}</p>
            <p className="text-xs text-slate-500">{shop.planTier} plan</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {navSections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (!sectionItems.length) return null;
          return <div key={section}>
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section}</p>
            <div className="space-y-1">{sectionItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={clsx(
                  "flex h-11 items-center gap-3 rounded-[8px] px-3 text-sm font-semibold transition",
                  isActive ? "bg-[var(--shop-primary)] text-white" : "text-slate-600 hover:bg-[#f6f4ef] hover:text-slate-950",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}</div>
          </div>;
        })}
      </nav>

      <div className="border-t border-[#ded8cd] p-3">
        <div className="mb-3 rounded-[8px] bg-[#f6f4ef] p-3">
          <p className="text-xs text-slate-500">Signed in as</p>
          <p className="text-sm font-semibold text-slate-800">{roleLabels[role]}</p>
        </div>
        <Link
          href="/logout"
          prefetch={false}
          className="flex h-10 items-center gap-3 rounded-[8px] px-3 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700"
        >
          <LogOut size={18} />
          Sign out
        </Link>
      </div>
    </aside>
  );
}
