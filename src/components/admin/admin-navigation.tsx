"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, CreditCard, LifeBuoy, Megaphone, Settings, Shield, Store, UserCog } from "lucide-react";
import type { PlatformPermission } from "@/lib/platform-admin";

interface AdminNavigationProps {
  allowedPermissions: PlatformPermission[] | null;
}

const adminNav = [
  { href: "/admin", label: "Overview", icon: BarChart3, permission: null },
  { href: "/admin/shops", label: "Shops", icon: Store, permission: "shops" },
  { href: "/admin/staff", label: "Admin staff", icon: UserCog, permission: "workers" },
  { href: "/admin/support", label: "Support desk", icon: LifeBuoy, permission: "support" },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, permission: "billing" },
  { href: "/admin/broadcast", label: "Broadcast", icon: Megaphone, permission: "broadcast" },
  { href: "/admin/activity", label: "Activity logs", icon: Activity, permission: "activity" },
  { href: "/admin/security", label: "Security", icon: Shield, permission: "security" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings" },
] as const satisfies ReadonlyArray<{ href: string; label: string; icon: typeof BarChart3; permission: PlatformPermission | null }>;

export function AdminNavigation({ allowedPermissions }: AdminNavigationProps) {
  const pathname = usePathname();
  const visibleItems = adminNav.filter((item) => {
    if (item.permission === null) return allowedPermissions === null;
    return allowedPermissions === null || allowedPermissions.includes(item.permission);
  });

  return (
    <nav className="flex gap-2 overflow-x-auto p-3 lg:grid lg:overflow-visible" aria-label="Admin pages">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-300/50 ${active ? "bg-cyan-300 text-[#081528]" : "text-white/68 hover:bg-white/10 hover:text-white"}`}
            href={item.href}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
