"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Boxes, ClipboardCheck, ClipboardList, CreditCard, FileDown, LayoutDashboard, Link2, LogOut, MessageCircle, Palette, Settings, ShoppingCart, Truck, Users } from "lucide-react";
import { clsx } from "clsx";
import type { Role } from "@prisma/client";
import { canSeeNav, roleLabels } from "@/lib/rbac";

const navItems = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "catalog", href: "/dashboard/catalog", label: "Catalog", icon: Boxes },
  { key: "orders", href: "/dashboard/orders", label: "Orders", icon: ClipboardList },
  { key: "pos", href: "/dashboard/pos", label: "POS", icon: ShoppingCart },
  { key: "customers", href: "/dashboard/customers", label: "Customers", icon: Users },
  { key: "debts", href: "/dashboard/debts", label: "Debts", icon: CreditCard },
  { key: "messages", href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  { key: "designs", href: "/dashboard/designs", label: "Designs", icon: Palette },
  { key: "closing", href: "/dashboard/closing", label: "Daily Closing", icon: ClipboardCheck },
  { key: "suppliers", href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
  { key: "network", href: "/dashboard/network", label: "Shop Network", icon: Link2 },
  { key: "reports", href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { key: "exports", href: "/dashboard/exports", label: "Exports", icon: FileDown },
  { key: "activity", href: "/dashboard/activity", label: "Activity", icon: Activity },
  { key: "staff", href: "/dashboard/staff", label: "Staff", icon: Users },
  { key: "settings", href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

type SidebarProps = {
  role: Role;
  shop: {
    name: string;
    logoUrl: string | null;
    planTier: string;
  };
};

export function DashboardSidebar({ role, shop }: SidebarProps) {
  const pathname = usePathname();
  const visible = canSeeNav(role);

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

      <nav className="flex-1 space-y-1 p-3">
        {navItems
          .filter((item) => visible[item.key])
          .map((item) => {
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
