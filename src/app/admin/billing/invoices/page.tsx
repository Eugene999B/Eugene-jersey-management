import Link from "next/link";
import { PaymentStatus, SubscriptionInvoiceStatus } from "@prisma/client";
import { AlertTriangle, Banknote, CheckCircle2, Download, FileText, RefreshCw, Send, ShieldCheck } from "lucide-react";
import {
  issueSubscriptionInvoiceAction,
  markSubscriptionInvoicePaidAction,
  processSubscriptionBillingAction,
  reconcileSubscriptionPaymentAction,
  sendSubscriptionReminderAction,
  voidSubscriptionInvoiceAction,
} from "@/app/admin/billing/invoices/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { compactNumber, currency, shortDate, titleCase } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { platformDb } from "@/lib/platform-db";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    error?: string;
    status?: string;
    shop?: string;
    issued?: string;
    paid?: string;
    voided?: string;
    reminded?: string;
    reconciled?: string;
    processed?: string;
  }>;
};

const errorCopy: Record<string, string> = {
  "shop-invalid": "Choose a valid shop.",
  "invoice-unavailable": "That shop does not yet have a configured paid contract and renewal date.",
  "invoice-invalid": "Choose a valid invoice.",
  "invoice-missing": "That invoice no longer exists.",
  "invoice-paid": "A paid invoice cannot be changed in that way.",
  "invoice-void": "That invoice has been voided.",
  "reason-invalid": "Enter a written operational reason of at least eight characters.",
  "attempt-invalid": "Choose a valid payment attempt.",
  "attempt-missing": "That payment attempt no longer exists.",
  "verification-unavailable": "Paystack did not return a verifiable transaction for that reference.",
  "reminder-closed": "Paid and void invoices do not receive reminders.",
  "reminder-missing-contact": "The shop has no owner email or phone number for billing reminders.",
  "reminder-not-configured": "No configured email or SMS delivery path was available.",
};

function statusTone(status: SubscriptionInvoiceStatus) {
  if (status === SubscriptionInvoiceStatus.PAID) return "green" as const;
  if (status === SubscriptionInvoiceStatus.OVERDUE) return "red" as const;
  if (status === SubscriptionInvoiceStatus.VOID) return "orange" as const;
  return "blue" as const;
}

export default async function SubscriptionInvoicesPage({ searchParams }: Props) {
  await requirePlatformPermission("billing");
  const params = (await searchParams) ?? {};
  const status = Object.values(SubscriptionInvoiceStatus).includes(params.status as SubscriptionInvoiceStatus)
    ? params.status as SubscriptionInvoiceStatus
    : undefined;
  const [shops, contracts, invoices, failedAttempts] = await Promise.all([
    platformDb.shop.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, subscriptionStatus: true } }),
    platformDb.shopSubscriptionContract.findMany({ select: { shopId: true, planVersion: true, renewalAt: true } }),
    platformDb.subscriptionInvoice.findMany({
      where: { status, shopId: params.shop || undefined },
      include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 8 } },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 250,
    }),
    platformDb.subscriptionPaymentAttempt.count({ where: { status: PaymentStatus.FAILED } }),
  ]);
  const shopMap = new Map(shops.map((shop) => [shop.id, shop]));
  const contractShopIds = new Set(contracts.map((contract) => contract.shopId));
  const payableShops = shops.filter((shop) => contractShopIds.has(shop.id));
  const open = invoices.filter((invoice) => invoice.status === SubscriptionInvoiceStatus.OPEN);
  const overdue = invoices.filter((invoice) => invoice.status === SubscriptionInvoiceStatus.OVERDUE);
  const paid = invoices.filter((invoice) => invoice.status === SubscriptionInvoiceStatus.PAID);
  const openValue = [...open, ...overdue].reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const paidValue = paid.reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Commercial collections</p>
          <h1 className="mt-2 text-3xl font-semibold">Subscription invoices &amp; reconciliation</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Issue immutable renewal invoices, monitor Paystack attempts, send dunning reminders, reconcile references and apply audited manual settlement or void decisions.</p>
        </div>
        <Link href="/admin/billing" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold">Plan catalogue</Link>
      </div>

      {params.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{errorCopy[params.error] ?? "The billing operation could not be completed."}</div> : null}
      {params.issued ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Renewal invoice issued from the shop’s saved contract.</div> : null}
      {params.paid ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Manual payment recorded, audited and applied to the next subscription term.</div> : null}
      {params.voided ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Invoice voided with its pending attempts closed.</div> : null}
      {params.reminded ? <div role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">Billing reminder dispatched through the configured owner contact channels.</div> : null}
      {params.reconciled ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Paystack reference reconciled successfully.</div> : null}
      {params.processed ? <div role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">Due invoices, overdue states and scheduled reminders processed.</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open invoices" value={compactNumber(open.length)} icon={<FileText size={20} />} />
        <StatCard label="Overdue invoices" value={compactNumber(overdue.length)} icon={<AlertTriangle size={20} />} />
        <StatCard label="Outstanding value" value={currency(openValue)} icon={<Banknote size={20} />} />
        <StatCard label="Failed attempts" value={compactNumber(failedAttempts)} icon={<ShieldCheck size={20} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-5">
          <div className="panel p-5">
            <h2 className="text-xl font-semibold">Issue renewal invoice</h2>
            <p className="mt-2 text-sm text-slate-600">The amount, cycle, currency, plan version and coverage period are copied from the shop’s immutable assigned contract.</p>
            <form action={issueSubscriptionInvoiceAction} className="mt-4 space-y-3">
              <select className="field" name="shopId" required><option value="">Select contracted shop</option>{payableShops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name} · {shop.subscriptionStatus}</option>)}</select>
              <Button className="w-full">Issue or locate invoice</Button>
            </form>
          </div>
          <div className="panel p-5">
            <h2 className="text-xl font-semibold">Run billing processor</h2>
            <p className="mt-2 text-sm text-slate-600">Creates invoices inside the configured lead window, marks overdue invoices and sends reminders that are due.</p>
            <form action={processSubscriptionBillingAction} className="mt-4"><Button variant="outline" className="w-full"><RefreshCw size={16} />Process now</Button></form>
          </div>
          <div className="panel p-5">
            <h2 className="text-xl font-semibold">Current register value</h2>
            <dl className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between"><dt className="text-slate-500">Paid value shown</dt><dd className="font-semibold">{currency(paidValue)}</dd></div><div className="flex items-center justify-between"><dt className="text-slate-500">Invoices shown</dt><dd className="font-semibold">{invoices.length}</dd></div></dl>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-xl font-semibold">Invoice register</h2>
            <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <select className="field" name="shop" defaultValue={params.shop ?? ""}><option value="">All shops</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>
              <select className="field" name="status" defaultValue={params.status ?? ""}><option value="">All statuses</option>{Object.values(SubscriptionInvoiceStatus).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select>
              <Button variant="outline">Filter</Button>
            </form>
          </div>
          <div className="divide-y divide-[#ded8cd] bg-white">
            {invoices.map((invoice) => {
              const shop = shopMap.get(invoice.shopId);
              const mutable = invoice.status === SubscriptionInvoiceStatus.OPEN || invoice.status === SubscriptionInvoiceStatus.OVERDUE;
              return (
                <article key={invoice.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{invoice.invoiceNumber}</p><h3 className="mt-1 text-lg font-semibold">{shop?.name ?? invoice.shopId}</h3><p className="mt-1 text-sm text-slate-500">{invoice.planName} · v{invoice.planVersion} · {titleCase(invoice.billingCycle)}</p></div>
                    <div className="text-right"><Badge tone={statusTone(invoice.status)}>{titleCase(invoice.status)}</Badge><p className="mt-2 text-xl font-semibold">{currency(invoice.amount.toString(), invoice.currency)}</p></div>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Due</dt><dd className="mt-1 font-semibold">{shortDate(invoice.dueAt)}</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Period</dt><dd className="mt-1 font-semibold">{shortDate(invoice.periodStart)} – {shortDate(invoice.periodEnd)}</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Reminders</dt><dd className="mt-1 font-semibold">{invoice.reminderCount}</dd></div></dl>
                  <div className="mt-4 flex flex-wrap gap-2"><Link href={`/api/subscription-invoices/${invoice.id}/pdf`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold"><Download size={15} />PDF</Link>{mutable ? <form action={sendSubscriptionReminderAction}><input type="hidden" name="invoiceId" value={invoice.id} /><Button variant="outline"><Send size={15} />Remind</Button></form> : null}</div>

                  {invoice.paymentAttempts.length ? <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Payment attempts</p>{invoice.paymentAttempts.map((attempt) => <div key={attempt.id} className="rounded-lg bg-slate-50 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{attempt.provider.toUpperCase()} · {titleCase(attempt.status)}</span><span>{shortDate(attempt.createdAt)}</span></div><p className="mt-1 break-all text-slate-500">{attempt.reference}</p>{attempt.gatewayResponse ? <p className="mt-1 text-slate-500">{attempt.gatewayResponse}</p> : null}{attempt.provider === "paystack" && attempt.status !== PaymentStatus.SUCCESS ? <form action={reconcileSubscriptionPaymentAction} className="mt-2"><input type="hidden" name="attemptId" value={attempt.id} /><Button variant="outline" className="min-h-9 text-xs">Reconcile with Paystack</Button></form> : null}</div>)}</div> : null}

                  {mutable ? <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Audited manual decision</summary><div className="mt-3 grid gap-3 lg:grid-cols-2"><form action={markSubscriptionInvoicePaidAction} className="space-y-2 rounded-lg bg-white p-3"><input type="hidden" name="invoiceId" value={invoice.id} /><label className="block text-xs font-semibold">Manual payment reason<textarea className="field mt-1 min-h-20" name="reason" minLength={8} required placeholder="Bank transfer confirmed by…" /></label><Button className="w-full"><CheckCircle2 size={15} />Mark paid</Button></form><form action={voidSubscriptionInvoiceAction} className="space-y-2 rounded-lg bg-white p-3"><input type="hidden" name="invoiceId" value={invoice.id} /><label className="block text-xs font-semibold">Void reason<textarea className="field mt-1 min-h-20" name="reason" minLength={8} required placeholder="Duplicate invoice caused by…" /></label><Button variant="outline" className="w-full">Void invoice</Button></form></div></details> : null}
                  {invoice.voidReason ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Void reason: {invoice.voidReason}</p> : null}
                </article>
              );
            })}
            {!invoices.length ? <p className="p-6 text-sm text-slate-500">No subscription invoice matches the selected filters.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
