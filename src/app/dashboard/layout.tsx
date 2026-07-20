import type { CSSProperties, ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { getTenantContext } from "@/lib/tenant";
import { LinkButton } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { session, shop, suspended } = await getTenantContext();

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

  if (suspended) {
    return (
      <main style={style} className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-6">
        <div className="panel max-w-lg p-6 text-center">
          <p className="text-sm font-semibold uppercase text-red-600">Shop suspended</p>
          <h1 className="mt-2 text-3xl font-semibold">{shop.name} is currently inactive</h1>
          <p className="mt-3 text-slate-600">
            Contact the platform Super Admin to reactivate this tenant before staff can access operations.
          </p>
          <LinkButton href="/logout" className="mt-6">Sign out</LinkButton>
        </div>
      </main>
    );
  }

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
