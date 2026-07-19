import Link from "next/link";
import type { ReactNode } from "react";
import { Shield, Store, LogOut } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole(permissions.superAdmin);

  return (
    <div className="min-h-screen bg-[#eef1f3]">
      <header className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="rounded-[8px] bg-white/10 p-2"><Shield size={22} /></span>
            <div>
              <p className="text-sm text-white/60">YPMS</p>
              <h1 className="text-xl font-semibold">Super Admin</h1>
            </div>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link className="rounded-[8px] px-3 py-2 text-white/75 hover:bg-white/10 hover:text-white" href="/admin">
              <Store size={16} className="inline" /> Shops
            </Link>
            <Link className="rounded-[8px] px-3 py-2 text-white/75 hover:bg-white/10 hover:text-white" href="/logout">
              <LogOut size={16} className="inline" /> Sign out
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-5 lg:p-8">{children}</main>
    </div>
  );
}
