import { AlertTriangle, Landmark, RefreshCw, RotateCcw } from "lucide-react";
import { PaymentMethod, PaymentRefundStatus, PaymentStatus, type Payment } from "@prisma/client";
import {
  reconcilePaymentRefundAction,
  requestPaymentRefundAction,
  retryPaymentRefundAction,
} from "@/app/dashboard/orders/refund-actions";
import { Badge } from "@/components/ui/badge";
import { currency, shortDate, titleCase } from "@/lib/format";
import { netRecognizedPaymentAmount } from "@/lib/payment-accounting";
import {
  activePaymentRefundStatuses,
  listPaymentRefundsForPayment,
  listPaystackGhanaBanks,
  paymentRefundSummary,
} from "@/lib/payment-refunds";

type Props = {
  shopId: string;
  orderId: string;
  currencyCode: string;
  payments: Payment[];
  canManage: boolean;
};

function refundTone(status: PaymentRefundStatus): "green" | "orange" | "red" | "blue" | "slate" {
  if (status === PaymentRefundStatus.PROCESSED) return "green";
  if (status === PaymentRefundStatus.FAILED) return "red";
  if (status === PaymentRefundStatus.RECONCILIATION_REQUIRED || status === PaymentRefundStatus.NEEDS_ATTENTION) return "orange";
  if (status === PaymentRefundStatus.PENDING || status === PaymentRefundStatus.PROCESSING) return "blue";
  return "slate";
}

function isPaystackPayment(payment: Payment) {
  return (payment.method === PaymentMethod.CARD || payment.method === PaymentMethod.MOMO) && Boolean(payment.providerReference);
}

export async function PaymentRefundPanel({ shopId, orderId, currencyCode, payments, canManage }: Props) {
  const refundRows = await Promise.all(payments.map(async (payment) => ({
    payment,
    refunds: await listPaymentRefundsForPayment(shopId, payment.id),
  })));
  const hasNeedsAttention = refundRows.some((row) => row.refunds.some((refund) => refund.status === PaymentRefundStatus.NEEDS_ATTENTION));
  const banks = canManage && hasNeedsAttention
    ? await listPaystackGhanaBanks().catch(() => [])
    : [];
  const paystackRows = refundRows.filter((row) => isPaystackPayment(row.payment) || row.refunds.length > 0);

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="refund-control-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><RotateCcw size={18} className="text-cyan-700" /><h2 id="refund-control-heading" className="font-bold">Paystack refunds and reconciliation</h2></div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Refunds keep the original captured payment intact and record the refunded amount separately. Only processed refunds reduce the order&apos;s paid amount.</p>
        </div>
        <Badge tone={canManage ? "green" : "slate"}>{canManage ? "Refund authority" : "Read only"}</Badge>
      </div>

      <div className="mt-4 space-y-4">
        {paystackRows.map(({ payment, refunds }) => {
          const summary = paymentRefundSummary({ paymentAmount: payment.amount, paymentStatus: payment.status, refunds });
          const active = refunds.find((refund) => activePaymentRefundStatuses.includes(refund.status));
          const netRecognized = netRecognizedPaymentAmount(payment);
          const captured = payment.status === PaymentStatus.SUCCESS || payment.status === PaymentStatus.REFUNDED;
          const canStart = canManage
            && isPaystackPayment(payment)
            && captured
            && summary.refundable > 0.005
            && !active;

          return (
            <article key={payment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{titleCase(payment.method)} payment · {currency(payment.amount.toString(), currencyCode)}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{payment.providerReference ?? "No provider reference"} · {shortDate(payment.createdAt)}</p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p>Net recognized <strong className="text-slate-950">{currency(netRecognized, currencyCode)}</strong></p>
                  <p>Processed refunds <strong className="text-red-700">{currency(summary.refunded, currencyCode)}</strong></p>
                  <p>Still refundable <strong>{currency(summary.refundable, currencyCode)}</strong></p>
                </div>
              </div>

              {refunds.length ? (
                <div className="mt-4 space-y-2">
                  {refunds.map((refund) => (
                    <div key={refund.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><strong>{currency(refund.amount.toString(), refund.currency)}</strong><Badge tone={refundTone(refund.status)}>{titleCase(refund.status)}</Badge></div>
                          <p className="mt-1 text-xs text-slate-500">Requested {shortDate(refund.requestedAt)}{refund.providerRefundReference ? ` · ${refund.providerRefundReference}` : ""}</p>
                          {refund.reason ? <p className="mt-2 text-sm text-slate-700">{refund.reason}</p> : null}
                          {refund.failureMessage ? <p className="mt-2 text-xs font-semibold text-red-700">{refund.failureMessage}</p> : null}
                        </div>
                        {canManage && refund.status === PaymentRefundStatus.RECONCILIATION_REQUIRED ? (
                          <form action={reconcilePaymentRefundAction}>
                            <input type="hidden" name="orderId" value={orderId} />
                            <input type="hidden" name="refundId" value={refund.id} />
                            <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-bold hover:bg-slate-100"><RefreshCw size={14} />Reconcile with Paystack</button>
                          </form>
                        ) : null}
                      </div>

                      {canManage && refund.status === PaymentRefundStatus.NEEDS_ATTENTION ? (
                        <form action={retryPaymentRefundAction} className="mt-3 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                          <input type="hidden" name="orderId" value={orderId} />
                          <input type="hidden" name="refundId" value={refund.id} />
                          <label className="text-xs font-bold text-amber-950">Customer bank
                            <select name="bankId" required className="field mt-1 bg-white" defaultValue="">
                              <option value="" disabled>Select bank</option>
                              {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-bold text-amber-950">Customer account number
                            <input name="accountNumber" required inputMode="numeric" autoComplete="off" minLength={6} maxLength={30} className="field mt-1 bg-white" placeholder="Account number" />
                          </label>
                          <button type="submit" disabled={!banks.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Landmark size={15} />Retry refund</button>
                          {!banks.length ? <p className="text-xs text-amber-900 sm:col-span-3">Bank list is unavailable. Reconcile later; do not submit unverified bank details.</p> : null}
                          <p className="text-xs text-amber-900 sm:col-span-3">Bank details are sent to Paystack for this retry and are not stored by ESM.</p>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {canStart ? (
                <form action={requestPaymentRefundAction} className="mt-4 grid gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={orderId} />
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <label className="text-xs font-bold text-cyan-950">Refund amount
                    <input name="amount" type="number" required min="0.01" max={summary.refundable.toFixed(2)} step="0.01" defaultValue={summary.refundable.toFixed(2)} className="field mt-1 bg-white" />
                  </label>
                  <label className="text-xs font-bold text-cyan-950">Reason
                    <input name="reason" maxLength={300} className="field mt-1 bg-white" placeholder="Why is this refund being issued?" />
                  </label>
                  <label className="text-xs font-bold text-cyan-950 sm:col-span-2">Customer note <span className="font-normal">(optional)</span>
                    <input name="customerNote" maxLength={300} className="field mt-1 bg-white" placeholder="Message Paystack may attach to the refund" />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                    <p className="flex max-w-xl gap-2 text-xs leading-5 text-cyan-950"><AlertTriangle size={15} className="mt-0.5 shrink-0" />Submitting this form sends a real refund request to Paystack. An uncertain network outcome is locked for reconciliation instead of automatically retried.</p>
                    <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"><RotateCcw size={15} />Issue refund</button>
                  </div>
                </form>
              ) : null}
            </article>
          );
        })}

        {!paystackRows.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No captured Paystack card or mobile-money payment exists on this order.</p> : null}
      </div>
    </section>
  );
}
