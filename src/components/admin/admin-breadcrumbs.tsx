import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { adminNavigationItemForPath } from "@/lib/admin-navigation";

export function AdminBreadcrumbs({ pathname, homePath }: { pathname: string; homePath: string }) {
  const current = adminNavigationItemForPath(pathname);
  return (
    <nav aria-label="Administrator breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-500">
      <Link href={homePath} prefetch={false} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 hover:bg-slate-100 hover:text-slate-900"><Home size={13} /> Admin</Link>
      {current && current.href !== "/admin" ? <><ChevronRight size={13} aria-hidden="true" /><span className="truncate text-slate-700" aria-current="page">{current.label}</span></> : null}
    </nav>
  );
}
