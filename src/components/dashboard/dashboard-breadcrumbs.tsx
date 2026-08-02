import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { shopNavigationItemForPath } from "@/lib/shop-navigation";

export function DashboardBreadcrumbs({ pathname }: { pathname: string }) {
  const current = shopNavigationItemForPath(pathname);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-500">
      <Link href="/dashboard" className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 hover:bg-white hover:text-slate-900">
        <Home size={13} /> Home
      </Link>
      {current && current.href !== "/dashboard" ? (
        <>
          <ChevronRight size={13} aria-hidden="true" />
          <span className="truncate text-slate-700" aria-current="page">{current.label}</span>
        </>
      ) : null}
    </nav>
  );
}
