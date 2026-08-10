import { AlertTriangle, CheckCircle2, Clock3, RotateCcw } from "lucide-react";
import { PaymentRefundStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { currency, shortDate, titleCase } from "@/lib/format";
import { platformDb } from "@/lib/platform-db";

function tone(status: PaymentRefundStatus): "green" | "orange" | "red" | "blue" | "slate" {
  if (status === PaymentRefundStatus.PROCESSED) return "green";
  if (status === PaymentRefundStatus.FAILED) return "red";
  if (status === PaymentRefundStatus.RECONCILIATION_REQUIRED || status === PaymentRefundStatus.NEEDS_ATTENTION) return "orange";
  if (status === PaymentRefundStatus.PENDING || status === PaymentRefundStatus.PROCESSING) return "blue";
  return "slate";
}

export async function PaymentRefundReconciliation() {
  const exceptionStatuses = [
    PaymentRefundStatus.NEEDS_ATTENTION,
    PaymentRefundStatus.RECONCILIATION_REQUIRED,
    PaymentRefundStatus.FAILED,
  ];
  const [groups, exceptions, failedProviderEvents] = await Promise.all([
    platformDb.paymentRefund.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    platformDb.paymentRefund.findMany({
      where: { status: { in: exceptionStatuses } },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    platformDb.paymentProviderEvent.count({
      where: { provider: "paystack", status: "FAILED" },
    }),
  ]);

  const countMap = new Map(groups.map((row) => [row.status, row._count._all]));
  const paymentIds = [...new Set(exceptions.map((refund) => refund.paymentId))];
  const payments = paymentIds.length ? await platformDb.payment.findMany({
    where: { id: { in: paymentIds } },
    select: {
      id: true,
      providerReference: true,
      order: { select: { receiptNumber: true, shop: { select: { name: true } } } },
    },
  }) : [];
  const paymentMap = new Map(payments.map((payment) => [payment.id, payment]));
  const pending = (countMap.get(PaymentRefundStatus.REQUESTED) ?? 0)
    + (countMap.get(PaymentRefundStatus.PENDING) ?? 0)
    + (countMap.get(PaymentRefundStatus.PROCESSING) ?? 0);
  const attention = (countMap.get(PaymentRefundStatus.NEEDS_ATTENTION) ?? 0)
    + (countMap.get(PaymentRefundStatus.RECONCILIATION_REQUIRED) ?? 0);
  const failed = countMap.get(PaymentRefundStatus.FAILED) ?? 0;
  const processed = countMap.get(PaymentRefundStatus.PROCESSED) ?? 0;

  return (
    <section className="panel p-5" aria-labelledby="refund-reconciliation-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><RotateCcw size={19} /><h2 id="refund-reconciliation-heading" className="text-xl font-semibold">Refund reconciliation</h2></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Platform-wide read-only visibility into Paystack refund states. Tenant owners, managers and accountants resolve individual refunds from the order control room.</p>
        </div>
        <Badge tone={attention || failed || failedProviderEvents ? "orange" : "green"}>{attention || failed || failedProviderEvents ? "Review exceptions" : "No refund exceptions"}</Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl bg-slate-50 p-4"><Clock3 size={17} className="text-blue-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">In flight</p><p className="mt-1 text-2xl font-semibold">{pending}</p></div>
        <div className="rounded-xl bg-amber-50 p-4"><AlertTriangle size={17} className="text-amber-700" /><p className="mt-2 text-xs font-bold uppercase text-amber-800">Needs action</p><p className="mt-1 text-2xl font-semibold text-amber-950">{attention}</p></div>
        <div className="rounded-xl bg-red-50 p-4"><AlertTriangle size={17} className="text-red-700" /><p className="mt-2 text-xs font-bold uppercase text-red-800">Failed refunds</p><p className="mt-1 text-2xl font-semibold text-red-950">{failed}</p></div>
        <div className="rounded-xl bg-emerald-50 p-4"><CheckCircle2 size={17} className="text-emerald-700" /><p className="mt-2 text-xs font-bold uppercase text-emerald-800">Processed</p><p className="mt-1 text-2xl font-semibold text-emerald-950">{processed}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><AlertTriangle size={17} className={failedProviderEvents ? "text-red-700" : "text-slate-500"} /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Failed Paystack events</p><p className="mt-1 text-2xl font-semibold">{failedProviderEvents}</p></div>
      </div>

      {exceptions.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Store / order</th><th className="p-3">Refund</th><th className="p-3">Status</th><th className="p-3">Provider reference</th><th className="p-3">Updated</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {exceptions.map((refund) => {
                const payment = paymentMap.get(refund.paymentId);
                return <tr key={refund.id}><td className="p-3"><strong>{payment?.order.shop.name ?? "Unknown store"}</strong><br /><span className="text-xs text-slate-500">{payment?.order.receiptNumber ?? refund.paymentId}</span></td><td className="p-3 font-semibold">{currency(refund.amount.toString(), refund.currency)}</td><td className="p-3"><Badge tone={tone(refund.status)}>{titleCase(refund.status)}</Badge>{refund.failureMessage ? <p className="mt-1 max-w-xs text-xs text-red-700">{refund.failureMessage}</p> : null}</td><td className="p-3 break-all text-xs">{refund.providerRefundReference ?? payment?.providerReference ?? "Not assigned"}</td><td className="p-3">{shortDate(refund.updatedAt)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">No refund currently needs reconciliation or provider attention.</p>}
    </section>
  );
}
