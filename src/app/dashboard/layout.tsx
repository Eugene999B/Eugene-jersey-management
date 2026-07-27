import type { CSSProperties, ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { canAccessDashboardPath } from "@/lib/dashboard-access";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { session, shop } = await getTenantContext();
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") || "/dashboard";

  if (session.role === Role.SUPER_ADMIN) redirect("/admin");
  if (session.role === Role.SUPPLIER) redirect("/supplier");

  if (!canAccessDashboardPath(pathname, session.role)) {
    redirect(`/dashboard?error=permission&from=${encodeURIComponent(pathname)}`);
  }

  if (!shop) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
        <div className="panel max-w-md p-5 text-center sm:p-6">
          <h1 className="text-2xl font-semibold">No shop assigned</h1>
          <p className="mt-3 text-sm text-slate-600">This account is not connected to a shop workspace.</p>
          <LogoutButton className="mt-5 bg-slate-950 text-white hover:bg-slate-800" label="Return to login" />
        </div>
      </main>
    );
  }

  const style = {
    "--shop-primary": shop.primaryColor,
    "--shop-secondary": shop.secondaryColor,
  } as CSSProperties;

  return (
    <div style={style} className="grid min-h-screen min-w-0 bg-slate-100 lg:grid-cols-[260px_1fr]">
      <div className="hidden lg:block"><DashboardSidebar role={session.role} shop={shop} /></div>
      <div className="min-w-0 overflow-x-clip">
        <div className="lg:hidden"><DashboardSidebar role={session.role} shop={shop} variant="mobile" /></div>
        <DashboardTopbar session={session} shopId={shop.id} />
        <main className="min-w-0 overflow-x-clip px-3 pb-24 pt-3 sm:p-4 sm:pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>
    </div>
  );
}
