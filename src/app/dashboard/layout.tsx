import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { businessModuleEnabled, businessModuleForDashboardPath } from "@/lib/business-modules";
import { canAccessDashboardPath } from "@/lib/dashboard-access";
import { SUPPORTED_PLAN_FEATURES } from "@/lib/subscription-plans";
import { subscriptionAccessForDashboardPath, subscriptionFeatureIncluded } from "@/lib/subscription-hardening";
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

  const subscription = await subscriptionAccessForDashboardPath(shop.id, pathname);
  const isSubscriptionPath = pathname === "/dashboard/subscription" || pathname.startsWith("/dashboard/subscription/");
  const isSettingsPath = pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/");
  const requiredModule = businessModuleForDashboardPath(pathname);
  const includedFeatures = SUPPORTED_PLAN_FEATURES.filter((feature) => subscriptionFeatureIncluded(subscription, feature));

  if (!subscription.operational && !isSubscriptionPath && !isSettingsPath) {
    redirect(`/dashboard/subscription?error=${encodeURIComponent(subscription.blockCode ?? "subscription")}`);
  }
  if (requiredModule && !businessModuleEnabled(shop.enabledModules, requiredModule.key) && !isSubscriptionPath) {
    redirect(`/dashboard/subscription?error=module&module=${encodeURIComponent(requiredModule.key)}`);
  }
  if (!subscription.featureIncluded && !isSubscriptionPath) {
    redirect(`/dashboard/subscription?error=feature&feature=${encodeURIComponent(subscription.feature ?? "PLAN_FEATURE")}`);
  }

  const style = {
    "--shop-primary": shop.primaryColor,
    "--shop-secondary": shop.secondaryColor,
  } as CSSProperties;

  const notice = subscription.notice && !isSubscriptionPath ? (
    <div className={`mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold sm:mx-4 lg:mx-6 ${subscription.operational ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
      <span>{subscription.notice}</span>
      <Link href="/dashboard/subscription" className="rounded-lg bg-white px-3 py-2 text-xs font-bold shadow-sm">View subscription</Link>
    </div>
  ) : undefined;

  return (
    <DashboardShell
      role={session.role}
      shop={shop}
      includedFeatures={includedFeatures}
      style={style}
      topbar={<DashboardTopbar session={session} shop={shop} includedFeatures={includedFeatures} pathname={pathname} />}
      notice={notice}
    >
      {children}
    </DashboardShell>
  );
}
