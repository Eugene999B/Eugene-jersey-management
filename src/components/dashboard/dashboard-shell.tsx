"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Role } from "@prisma/client";
import { clsx } from "clsx";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import type { SubscriptionFeature } from "@/lib/subscription-hardening";

type DashboardShellProps = {
  role: Role;
  shop: { name: string; logoUrl: string | null; planTier: string; enabledModules: string[] };
  includedFeatures: readonly SubscriptionFeature[];
  style: CSSProperties;
  topbar: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
};

const storageKey = "esm.dashboard.sidebar-collapsed";

export function DashboardShell({ role, shop, includedFeatures, style, topbar, notice, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(storageKey) === "true");
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  return (
    <div
      style={style}
      className={clsx(
        "grid min-h-screen min-w-0 bg-slate-100 transition-[grid-template-columns] duration-200",
        collapsed ? "lg:grid-cols-[84px_minmax(0,1fr)]" : "lg:grid-cols-[260px_minmax(0,1fr)]",
      )}
    >
      <div className="hidden lg:block">
        <DashboardSidebar role={role} shop={shop} includedFeatures={includedFeatures} collapsed={collapsed} onToggleCollapsed={toggleSidebar} />
      </div>
      <div className="min-w-0 overflow-x-clip">
        <div className="lg:hidden"><DashboardSidebar role={role} shop={shop} includedFeatures={includedFeatures} variant="mobile" /></div>
        {topbar}
        {notice}
        <main className="min-w-0 overflow-x-clip px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pt-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
