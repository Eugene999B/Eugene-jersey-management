import Link from "next/link";
import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, CreditCard, ReceiptText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { currency, shortDate } from "@/lib/format";
import { permissions } from "@/lib/rbac";
import { requireRole } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { subscriptionFeatureIncluded, subscriptionUsage } from "@/lib/subscription-hardening";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ error?: string; feature?: string }>;
};

function usageText(current: number, limit: number | null) {
  return limit === null ? `${current.toLocaleString("en-GB")} used · no configured limit` : `${current.toLocaleString("en-GB")} of ${limit.toLocaleString("en-GB")}`;
}

function usagePercent(current: number, limit: number | null) {
  if (limit === null || limit <= 0) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

function usageTone(current: number, limit: number | null) {
  if (limit === null) return "bg-emerald-500";
  const ratio = current / Math.max(1, limit);
  if (ratio >= 1) return "bg-red-500";
  if (ratio >= 0.8) return "bg-amber-500";
  return "bg-emerald-500";
}

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number | null }) {
  const percent = usagePercent(current, limit);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-slate-800">{label}</p>
        <p className="text-slate-500">{usageText(current, limit)}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${usageTone(current, limit)}`} style={{ width: limit === null ? "8%" : `${percent}%` }} />
      </div>
    </div>
  );
}

export default async function SubscriptionPage({ searchParams }: Props) {
  await requireRole(permissions.dashboard);
  const params = (await searchParams) ?? {};
  const { session, shop } = await getTenantContext();
  if (!shop) return null;
  const usage = await subscriptionUsage(shop.id);
  const snapshot = usage.snapshot;
  const selectedPrice = snapshot
    ? shop.billingCycle === "YEARLY" ? snapshot.yearlyPrice : snapshot.monthlyPrice
    : null;
  const isOwnerOrManager = session.role === "OWNER" || session.role === "MANAGER";
  const featureBlocked = params.error === "feature";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Commercial access</p>
          <h1 className="mt-2 text-3xl font-semibold">Subscription &amp; usage</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            See the exact saved plan terms, current product and order usage, staff reservations, renewal deadline and any commercial restriction affecting this shop.
          </p>
        </div>
        <Badge tone={usage.operational ? usage.effectiveStatus === "PAST_DUE" ? "orange" : "green" : "red"} className="px-3 py-2 text-sm">
          {usage.effectiveStatus.replaceAll("_", " ")}
        </Badge>
      </div>

      {featureBlocked ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {params.feature?.replaceAll("_", " ") || "That feature"} is not included in the assigned plan. Review the entitlements below and contact the platform administrator before relying on it.
        </div>
      ) : null}

      {usage.notice ? (
        <div role={usage.operational ? "status" : "alert"} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${usage.operational ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          {usage.notice}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned plan" value={snapshot?.name ?? shop.planTier} icon={<CreditCard size={20} />} />
        <StatCard label="Products" value={usageText(usage.productCount, usage.productLimit)} icon={<Boxes size={20} />} />
        <StatCard label="Orders this month" value={usageText(usage.monthlyOrderCount, usage.monthlyOrderLimit)} icon={<ReceiptText size={20} />} />
        <StatCard label="Reserved staff slots" value={usageText(usage.reservedStaff, usage.staffLimit)} icon={<Users size={20} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-5">
          <div className="flex items-center gap-2">
            {usage.operational ? <CheckCircle2 size={20} className="text-emerald-600" /> : <AlertTriangle size={20} className="text-red-600" />}
            <h2 className="text-xl font-semibold">Assigned commercial terms</h2>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Plan version</dt><dd className="mt-1 font-semibold">{snapshot ? `${snapshot.tier} · version ${snapshot.version}` : `${shop.planTier} · legacy`}</dd></div>
            <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Billing cycle</dt><dd className="mt-1 font-semibold">{shop.billingCycle}</dd></div>
            <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Price</dt><dd className="mt-1 font-semibold">{selectedPrice === null ? "Not configured" : currency(selectedPrice, snapshot?.currency ?? shop.currency)}</dd></div>
            <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Renewal / deadline</dt><dd className="mt-1 font-semibold">{usage.deadline ? shortDate(usage.deadline) : "Not set"}</dd></div>
            <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Trial ends</dt><dd className="mt-1 font-semibold">{usage.trialEndsAt ? shortDate(usage.trialEndsAt) : "—"}</dd></div>
            <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Grace ends</dt><dd className="mt-1 font-semibold">{usage.graceEndsAt ? shortDate(usage.graceEndsAt) : "—"}</dd></div>
          </dl>
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold">Staff calculation</p>
            <p className="mt-1 text-sm text-slate-600">{usage.activeStaff} active staff account{usage.activeStaff === 1 ? "" : "s"} plus {usage.pendingInvites} unexpired invitation{usage.pendingInvites === 1 ? "" : "s"} reserve {usage.reservedStaff} slot{usage.reservedStaff === 1 ? "" : "s"}.</p>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2"><CalendarClock size={20} /><h2 className="text-xl font-semibold">Live plan usage</h2></div>
          <p className="mt-2 text-sm text-slate-600">The database enforces these limits across POS, public single-item checkout, cart checkout and product creation.</p>
          <div className="mt-5 space-y-3">
            <UsageBar label="Products" current={usage.productCount} limit={usage.productLimit} />
            <UsageBar label="Orders created this calendar month" current={usage.monthlyOrderCount} limit={usage.monthlyOrderLimit} />
            <UsageBar label="Staff accounts and pending invitations" current={usage.reservedStaff} limit={usage.staffLimit} />
          </div>
          {isOwnerOrManager ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/dashboard/staff" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">Review staff slots</Link>
              <Link href="/dashboard/settings" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Open shop settings</Link>
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-white p-3 text-sm text-slate-600">Ask the shop owner or manager to review renewal or plan changes with the platform administrator.</p>
          )}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-semibold">Included features</h2>
        <p className="mt-1 text-sm text-slate-600">An empty legacy feature list remains unrestricted until the contract is deliberately reconfigured. Once features are assigned, access is enforced from this saved contract version.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["STOREFRONT", "POS", "INVENTORY", "DESIGN_STUDIO", "SUPPLIERS", "SHOP_NETWORK", "CUSTOMER_MESSAGING", "ADVANCED_REPORTS"] as const).map((feature) => {
            const included = subscriptionFeatureIncluded(usage, feature);
            return <div key={feature} className={`rounded-xl border p-3 text-sm font-semibold ${included ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}>{included ? "Included" : "Not included"} · {feature.replaceAll("_", " ")}</div>;
          })}
        </div>
      </section>
    </div>
  );
}
