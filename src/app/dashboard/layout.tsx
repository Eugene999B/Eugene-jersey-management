import type { CSSProperties, ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { canAccessDashboardPath } from "@/lib/dashboard-access";
import { getTenantContext } from "@/lib/tenant";
import { LinkButton } from "@/components/ui/button";

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
      <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-6">
        <div className="panel max-w-md p-6 text-center">
          <h1 className="text-2xl font-semibold">No shop assigned</h1>
          <p className="mt-3 text-sm text-slate-600">This account is not connected to a shop workspace.</p>
          <LinkButton href="/logout" className="mt-5">Return to login</LinkButton>
        </div>
      </main>
    );
  }

  const style = {
    "--shop-primary": shop.primaryColor,
    "--shop-secondary": shop.secondaryColor,
  } as CSSProperties;

  return (
    <div style={style} className="grid min-h-screen bg-[#f6f4ef] lg:grid-cols-[260px_1fr]">
      <div className="hidden lg:block">
        <DashboardSidebar role={session.role} shop={shop} />
      </div>
      <div className="min-w-0">
        <div className="lg:hidden">
          <DashboardSidebar role={session.role} shop={shop} variant="mobile" />
        </div>
        <DashboardTopbar session={session} shopId={shop.id} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
