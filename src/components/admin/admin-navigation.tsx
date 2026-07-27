"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, CreditCard, LifeBuoy, Settings, Shield, Store, UserCog } from "lucide-react";

const adminNav = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/shops", label: "Shops", icon: Store },
  { href: "/admin/staff", label: "Admin staff", icon: UserCog },
  { href: "/admin/support", label: "Support desk", icon: LifeBuoy },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/activity", label: "Activity logs", icon: Activity },
  { href: "/admin/security", label: "Security", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto p-3 lg:grid lg:overflow-visible" aria-label="Admin pages">
      {adminNav.map((item) => {
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
