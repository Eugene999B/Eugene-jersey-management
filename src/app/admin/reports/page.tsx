import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FolderKanban,
  Gift,
  HeartPulse,
  Layers3,
  Store,
} from "lucide-react";
import { PaymentStatus, SubscriptionInvoiceStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import { getProductionIntegrationHealth } from "@/lib/production-integration-health";
import { getAllowedPlatformPermissions, platformAdminHomePath, requirePlatformPermission } from "@/lib/platform-admin";
import { platformDb } from "@/lib/platform-db";
import { percentage } from "@/lib/reporting-analytics";
import { platformDeviceBridgeReport } from "@/lib/reporting-data";
import { accessTypeLabel } from "@/lib/subscription-access";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ from?: string; to?: string }> };

function inputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function validDate(value: string | undefined, fallback: Date, endOfDay = false) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function AdminReportsPage({ searchParams }: Props) {
  const session = await requirePlatformPermission();
  const allowedPermissions = await getAllowedPlatformPermissions(session.id);
  if (allowedPermissions && allowedPermissions.length > 0) redirect(`${platformAdminHomePath(allowedPermissions)}?error=permission`);
  if (allowedPermissions?.length === 0) redirect("/admin?error=permission");

  const params = (await searchParams) ?? {};
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultTo = new Date();
  const parsedFrom = validDate(params.from, defaultFrom);
  const parsedTo = validDate(params.to, defaultTo, true);
  const from = parsedFrom <= parsedTo ? parsedFrom : defaultFrom;
  const to = parsedFrom <= parsedTo ? parsedTo : defaultTo;

  const [
    shops,
    accessGrants,
    paidInvoices,
    failedSubscriptionAttempts,
    supportCases,
    providerHealth,
    deviceBridge,
  ] = await Promise.all([
    prisma.shop.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        verificationStatus: true,
        subscriptionStatus: true,
        planTier: true,
        enabledModules: true,
        monthlyPrice: true,
        yearlyPrice: true,
        billingCycle: true,
      },
      orderBy: { name: "asc" },
    }),
    platformDb.shopAccessGrant.findMany({
      where: { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      select: { id: true, shopId: true, accessType: true, startsAt: true, endsAt: true, invoicesDisabled: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscriptionInvoice.findMany({
      where: { status: SubscriptionInvoiceStatus.PAID, paidAt: { gte: from, lte: to } },
      select: { id: true, shopId: true, amount: true, paidAt: true },
      orderBy: { paidAt: "desc" },
      take: 5000,
    }),
    prisma.subscriptionPaymentAttempt.findMany({
      where: {
        status: PaymentStatus.FAILED,
        OR: [{ failedAt: { gte: from, lte: to } }, { failedAt: null, createdAt: { gte: from, lte: to } }],
      },
      select: { id: true, shopId: true, amount: true, provider: true, failedAt: true, createdAt: true, failureReason: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.supportCase.findMany({ orderBy: { updatedAt: "desc" }, take: 5000 }),
    getProductionIntegrationHealth(),
    platformDeviceBridgeReport(from, to),
  ]);

  const activeShops = shops.filter((shop) => shop.isActive);
  const verifiedActive = activeShops.filter((shop) => shop.verificationStatus === "VERIFIED").length;
  const grantByShop = new Map(accessGrants.map((grant) => [grant.shopId, grant]));
  const accessCounts = new Map<string, number>();
  for (const shop of activeShops) {
    const grant = grantByShop.get(shop.id);
    const key = grant ? grant.accessType : `SUBSCRIPTION_${shop.subscriptionStatus}`;
    accessCounts.set(key, (accessCounts.get(key) ?? 0) + 1);
  }
  const subscriptionRevenue = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const failedSubscriptionValue = failedSubscriptionAttempts.reduce((sum, attempt) => sum + Number(attempt.amount), 0);
  const moduleCounts = new Map<string, number>();
  for (const shop of activeShops) {
    for (const module of shop.enabledModules) moduleCounts.set(module, (moduleCounts.get(module) ?? 0) + 1);
  }
  const moduleRows = [...moduleCounts.entries()].sort((a, b) => b[1] - a[1]);
  const openSupportCases = supportCases.filter((supportCase) => supportCase.status !== "RESOLVED" && supportCase.status !== "CLOSED");
  const urgentSupportCases = openSupportCases.filter((supportCase) => supportCase.priority === "URGENT" || supportCase.priority === "HIGH");
  const resolvedInRange = supportCases.filter((supportCase) => supportCase.resolvedAt && supportCase.resolvedAt >= from && supportCase.resolvedAt <= to).length;
  const shopName = new Map(shops.map((shop) => [shop.id, shop.name]));

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-[#081528] p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Unrestricted platform intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Platform reports</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">Active businesses, commercial access, subscription revenue/failures, module footprint, support workload, provider health and recorded cutter bridge activity. Global tenant intelligence is restricted to unrestricted platform administrators.</p>
          </div>
          <Link href="/admin" className="inline-flex min-h-11 w-fit items-center rounded-xl border border-white/15 px-4 text-sm font-bold text-white hover:bg-white/10">Back to command centre</Link>
        </div>
      </header>

      <form className="panel grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-semibold">From<input className="field mt-1" name="from" type="date" defaultValue={inputDate(from)} /></label>
        <label className="text-sm font-semibold">To<input className="field mt-1" name="to" type="date" defaultValue={inputDate(to)} /></label>
        <button className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" type="submit">Apply range</button>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="panel p-4"><Store size={18} className="text-cyan-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Active businesses</p><p className="mt-1 text-3xl font-black">{activeShops.length}</p><p className="text-xs text-slate-500">{verifiedActive} verified · {shops.length} total records</p></div>
        <div className="panel p-4"><CreditCard size={18} className="text-emerald-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Subscription revenue</p><p className="mt-1 text-3xl font-black">{currency(subscriptionRevenue, "GHS")}</p><p className="text-xs text-slate-500">{paidInvoices.length} paid invoice(s) in range</p></div>
        <div className="panel p-4"><AlertTriangle size={18} className="text-red-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Failed subscription payments</p><p className="mt-1 text-3xl font-black">{failedSubscriptionAttempts.length}</p><p className="text-xs text-slate-500">{currency(failedSubscriptionValue, "GHS")} attempted value</p></div>
        <div className="panel p-4"><FolderKanban size={18} className="text-orange-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Open support cases</p><p className="mt-1 text-3xl font-black">{openSupportCases.length}</p><p className="text-xs text-slate-500">{urgentSupportCases.length} high/urgent · {resolvedInRange} resolved in range</p></div>
        <div className="panel p-4"><HeartPulse size={18} className={deviceBridge.failedJobs || deviceBridge.staleSendingJobs ? "text-orange-700" : "text-emerald-700"} /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Direct cutter success</p><p className="mt-1 text-3xl font-black">{deviceBridge.successRatePercent.toFixed(1)}%</p><p className="text-xs text-slate-500">{deviceBridge.sentJobs} sent · {deviceBridge.failedJobs} failed in range</p></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Gift size={18} /> Subscription / sponsored / grant status</h2><p className="mt-1 text-sm text-slate-600">Active administrator access grants override the commercial label; businesses without a current grant are grouped by normal subscription status.</p></div>
          <div className="divide-y divide-[#ded8cd]">{[...accessCounts.entries()].sort((a, b) => b[1] - a[1]).map(([access, count]) => <div key={access} className="flex items-center justify-between gap-3 p-3 text-sm"><span className="font-semibold">{access.startsWith("SUBSCRIPTION_") ? `Subscription · ${titleCase(access.replace("SUBSCRIPTION_", ""))}` : accessTypeLabel(access as Parameters<typeof accessTypeLabel>[0])}</span><div className="flex items-center gap-2"><span>{count}</span><Badge>{percentage(count, activeShops.length).toFixed(1)}%</Badge></div></div>)}{!accessCounts.size ? <p className="p-4 text-sm text-slate-500">No active businesses.</p> : null}</div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Layers3 size={18} /> Module usage footprint</h2><p className="mt-1 text-sm text-slate-600">Counts businesses with each module enabled. This is configuration footprint, not a claim that every enabled module was actively used in the period.</p></div>
          <div className="max-h-[420px] divide-y divide-[#ded8cd] overflow-y-auto">{moduleRows.map(([module, count]) => <div key={module} className="flex items-center justify-between gap-3 p-3 text-sm"><span className="font-semibold">{titleCase(module)}</span><div className="flex items-center gap-2"><span>{count}</span><Badge tone="blue">{percentage(count, activeShops.length).toFixed(1)}%</Badge></div></div>)}{!moduleRows.length ? <p className="p-4 text-sm text-slate-500">No module assignments found.</p> : null}</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><CreditCard size={18} /> Subscription billing evidence</h2></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Business</th><th className="p-3">Result</th><th className="p-3">Amount</th><th className="p-3">Provider / detail</th><th className="p-3">Time</th></tr></thead><tbody className="divide-y divide-[#ded8cd]">{paidInvoices.slice(0, 20).map((invoice) => <tr key={invoice.id}><td className="p-3 font-semibold">{shopName.get(invoice.shopId) ?? invoice.shopId}</td><td className="p-3"><Badge tone="green">Paid invoice</Badge></td><td className="p-3">{currency(Number(invoice.amount), "GHS")}</td><td className="p-3 text-slate-500">Verified subscription invoice</td><td className="p-3">{invoice.paidAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(invoice.paidAt) : "—"}</td></tr>)}{failedSubscriptionAttempts.slice(0, 20).map((attempt) => <tr key={attempt.id}><td className="p-3 font-semibold">{shopName.get(attempt.shopId) ?? attempt.shopId}</td><td className="p-3"><Badge tone="red">Failed attempt</Badge></td><td className="p-3">{currency(Number(attempt.amount), "GHS")}</td><td className="p-3 text-slate-500">{attempt.provider} · {attempt.failureReason ?? "No provider reason"}</td><td className="p-3">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(attempt.failedAt ?? attempt.createdAt)}</td></tr>)}{!paidInvoices.length && !failedSubscriptionAttempts.length ? <tr><td className="p-5 text-slate-500" colSpan={5}>No subscription payment evidence in this range.</td></tr> : null}</tbody></table></div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><FolderKanban size={18} /> Support cases</h2></div>
          <div className="max-h-[520px] divide-y divide-[#ded8cd] overflow-y-auto">{openSupportCases.slice(0, 30).map((supportCase) => <Link key={supportCase.id} href={`/admin/support/cases/${encodeURIComponent(supportCase.id)}`} className="block p-3 text-sm hover:bg-slate-50"><div className="flex flex-wrap items-center gap-2"><span className="font-bold">{supportCase.caseNumber}</span><Badge tone={supportCase.priority === "URGENT" || supportCase.priority === "HIGH" ? "red" : "orange"}>{titleCase(supportCase.priority)}</Badge><Badge>{titleCase(supportCase.status)}</Badge></div><p className="mt-1 font-semibold">{supportCase.subject}</p><p className="mt-1 text-xs text-slate-500">{shopName.get(supportCase.shopId ?? "") ?? supportCase.requesterName ?? "Platform case"} · updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(supportCase.updatedAt)}</p></Link>)}{!openSupportCases.length ? <p className="p-4 text-sm text-slate-500">No open support cases.</p> : null}</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Activity size={18} /> Provider health</h2><p className="mt-1 text-sm text-slate-600">Read-only production integration checks; no payment, message or file is created by this report.</p></div>
          <div className="divide-y divide-[#ded8cd]">{providerHealth.checks.map((check) => <div key={check.key} className="flex items-start justify-between gap-3 p-3 text-sm"><div><p className="font-semibold">{check.label}</p><p className="mt-1 text-xs text-slate-500">{check.detail}</p></div><Badge tone={check.state === "healthy" ? "green" : check.state === "unreachable" ? "red" : "orange"}>{titleCase(check.state)}</Badge></div>)}</div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><HeartPulse size={18} /> Device bridge / Web Serial health</h2><p className="mt-1 text-sm text-slate-600">ESM has browser-mediated Web Serial cutter control rather than a continuously connected server USB bridge. Health therefore reports active direct profiles and durable send/failure job evidence.</p></div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Active direct profiles</p><p className="text-2xl font-black">{deviceBridge.activeWebSerialProfiles}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs uppercase text-emerald-700">Sent</p><p className="text-2xl font-black">{deviceBridge.sentJobs}</p></div><div className="rounded-xl bg-red-50 p-3"><p className="text-xs uppercase text-red-700">Failed</p><p className="text-2xl font-black">{deviceBridge.failedJobs}</p></div><div className="rounded-xl bg-cyan-50 p-3"><p className="text-xs uppercase text-cyan-700">Prepared</p><p className="text-2xl font-black">{deviceBridge.preparedJobs}</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs uppercase text-orange-700">Sending</p><p className="text-2xl font-black">{deviceBridge.sendingJobs}</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs uppercase text-orange-700">Stale sending &gt;10m</p><p className="text-2xl font-black">{deviceBridge.staleSendingJobs}</p></div></div>
          <div className="divide-y divide-[#ded8cd] border-t border-[#ded8cd]">{deviceBridge.shopsWithFailures.map((row) => <div key={row.shopId} className="flex items-center justify-between gap-3 p-3 text-sm"><div><p className="font-semibold">{row.shopName}</p><p className="text-xs text-slate-500">Last failed send {row.lastFailureAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(row.lastFailureAt) : "—"}</p></div><Badge tone="red">{row.failedJobs} failed</Badge></div>)}{!deviceBridge.shopsWithFailures.length ? <div className="flex items-center gap-2 p-4 text-sm text-emerald-800"><CheckCircle2 size={16} /> No failed direct cutter sends in the selected range.</div> : null}</div>
        </div>
      </section>

      {providerHealth.summary.unreachable || deviceBridge.staleSendingJobs ? <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900"><div className="flex items-center gap-2 font-bold"><AlertTriangle size={17} /> Platform operations need attention</div><p className="mt-1">Resolve unreachable provider checks or stale direct-device sends before broad production rollout.</p></div> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><div className="flex items-center gap-2 font-bold"><CheckCircle2 size={17} /> No current platform reporting alarm</div><p className="mt-1">No provider is unreachable and no Web Serial production job has remained stuck in sending state for more than ten minutes.</p></div>}
    </div>
  );
}
