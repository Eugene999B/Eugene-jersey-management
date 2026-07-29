import Link from "next/link";
import { SubscriptionInvoiceStatus } from "@prisma/client";
import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, CreditCard, Download, ReceiptText, RefreshCw, Users } from "lucide-react";
import { generateSubscriptionInvoiceAction, startSubscriptionPaymentAction } from "@/app/dashboard/subscription/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { currency, shortDate, titleCase } from "@/lib/format";
import { permissions } from "@/lib/rbac";
import { requireRole } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { listSubscriptionInvoicesForShop } from "@/lib/subscription-billing";
import { subscriptionFeatureIncluded, subscriptionUsage } from "@/lib/subscription-hardening";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ error?: string; feature?: string; payment?: string; invoice?: string; generated?: string }>;
};

const errorCopy: Record<string, string> = {
  "missing-shop": "This account is not connected to a shop subscription.",
  "invoice-unavailable": "A renewal invoice cannot be generated until a configured paid contract and renewal date are assigned.",
  "invoice-invalid": "Choose a valid subscription invoice.",
  "invoice-missing": "That subscription invoice no longer exists.",
  "invoice-paid": "That invoice has already been paid.",
  "invoice-void": "That invoice has been voided by the platform administrator.",
  "invoice-zero": "This invoice does not require an online payment.",
  "paystack-unavailable": "Paystack subscription collection is not configured yet. Contact the platform administrator.",
  "checkout-failed": "The secure subscription checkout could not be started. Review the payment attempt below or try again.",
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

function invoiceTone(status: SubscriptionInvoiceStatus) {
  if (status === SubscriptionInvoiceStatus.PAID) return "green" as const;
  if (status === SubscriptionInvoiceStatus.OVERDUE) return "red" as const;
  if (status === SubscriptionInvoiceStatus.VOID) return "orange" as const;
  return "blue" as const;
}

export default async function SubscriptionPage({ searchParams }: Props) {
  await requireRole(permissions.dashboard);
  const params = (await searchParams) ?? {};
  const { session, shop } = await getTenantContext();
  if (!shop) return null;
  const [usage, invoices] = await Promise.all([
    subscriptionUsage(shop.id),
    listSubscriptionInvoicesForShop(shop.id),
  ]);
  const snapshot = usage.snapshot;
  const selectedPrice = snapshot
    ? shop.billingCycle === "YEARLY" ? snapshot.yearlyPrice : snapshot.monthlyPrice
    : null;
  const isOwner = session.role === "OWNER";
  const isOwnerOrManager = isOwner || session.role === "MANAGER";
  const featureBlocked = params.error === "feature";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Commercial access</p>
          <h1 className="mt-2 text-3xl font-semibold">Subscription &amp; usage</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            See the exact saved plan terms, current usage, renewal invoices, verified payments and any commercial restriction affecting this shop.
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
      {params.error && !featureBlocked ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{errorCopy[params.error] ?? "The subscription operation could not be completed."}</div> : null}
      {params.payment === "success" ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Payment verified. The invoice is paid and the next subscription term is active.</div> : null}
      {params.payment === "failed" || params.payment === "invalid" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">The payment could not be verified. No subscription term was extended; review the payment attempt or try again.</div> : null}
      {params.generated ? <div role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">Renewal invoice generated from the immutable assigned contract.</div> : null}

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

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded8cd] p-5">
          <div>
            <h2 className="text-xl font-semibold">Invoices &amp; payment history</h2>
            <p className="mt-1 text-sm text-slate-600">Every invoice is tied to the exact plan version, price, cycle and period assigned to this shop.</p>
          </div>
          {isOwner ? <form action={generateSubscriptionInvoiceAction}><Button variant="outline"><RefreshCw size={16} />Generate renewal invoice</Button></form> : null}
        </div>
        <div className="grid gap-4 bg-white p-5 lg:grid-cols-2">
          {invoices.map((invoice) => {
            const payable = isOwner && (invoice.status === SubscriptionInvoiceStatus.OPEN || invoice.status === SubscriptionInvoiceStatus.OVERDUE);
            return (
              <article key={invoice.id} className={`rounded-xl border p-4 ${params.invoice === invoice.id ? "border-cyan-400 ring-4 ring-cyan-100" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{invoice.invoiceNumber}</p><h3 className="mt-1 text-lg font-semibold">{invoice.planName} renewal</h3></div>
                  <Badge tone={invoiceTone(invoice.status)}>{titleCase(invoice.status)}</Badge>
                </div>
                <p className="mt-4 text-2xl font-semibold">{currency(invoice.amount.toString(), invoice.currency)}</p>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Due</dt><dd className="mt-1 font-semibold">{shortDate(invoice.dueAt)}</dd></div>
                  <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Coverage</dt><dd className="mt-1 font-semibold">{shortDate(invoice.periodStart)} – {shortDate(invoice.periodEnd)}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/api/subscription-invoices/${invoice.id}/pdf`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold"><Download size={15} />Invoice PDF</Link>
                  {payable ? <form action={startSubscriptionPaymentAction}><input type="hidden" name="invoiceId" value={invoice.id} /><Button>Pay securely</Button></form> : null}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Payment attempts</p>
                  <div className="mt-2 space-y-2">
                    {invoice.paymentAttempts.map((attempt) => <div key={attempt.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{attempt.provider.toUpperCase()} · {titleCase(attempt.status)}</span><span>{shortDate(attempt.createdAt)}</span></div><p className="mt-1 break-all text-slate-500">{attempt.reference}</p>{attempt.gatewayResponse ? <p className="mt-1 text-slate-500">{attempt.gatewayResponse}</p> : null}</div>)}
                    {!invoice.paymentAttempts.length ? <p className="text-sm text-slate-500">No payment attempt has been started.</p> : null}
                  </div>
                </div>
              </article>
            );
          })}
          {!invoices.length ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 lg:col-span-2">No subscription invoice has been issued. The owner can generate one once a configured paid contract and renewal date exist.</div> : null}
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
