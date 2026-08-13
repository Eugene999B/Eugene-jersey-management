import { Calculator, FileDown, ReceiptText, Scale } from "lucide-react";
import { closeDayAction } from "@/app/dashboard/closing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { StatCard } from "@/components/ui/stat-card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { financialPeriodTotals } from "@/lib/financial-period";
import { currency, shortDate, titleCase } from "@/lib/format";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";

type Props = {
  searchParams?: Promise<{ date?: string }>;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function validDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function bounds(value: string) {
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function ClosingPage({ searchParams }: Props) {
  await requireRole(permissions.closing);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const params = (await searchParams) ?? {};
  const selectedDate = validDateInput(params.date) ? params.date! : todayInput();
  const { start, end } = bounds(selectedDate);

  const [truth, debtPayments, closings, selectedClosing] = await Promise.all([
    financialPeriodTotals(shop.id, start, end),
    prisma.debtPayment.findMany({
      where: { shopId: shop.id, receivedAt: { gte: start, lt: end } },
      include: { debt: { include: { customer: true } }, receivedBy: true },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.dailyClosing.findMany({
      where: { shopId: shop.id },
      include: { closedBy: true },
      orderBy: { businessDate: "desc" },
      take: 12,
    }),
    prisma.dailyClosing.findUnique({
      where: { shopId_businessDate: { shopId: shop.id, businessDate: start } },
      include: { closedBy: true },
    }),
  ]);

  const cash = truth.netTenders.CASH + truth.debtCollections.CASH;
  const card = truth.netTenders.CARD + truth.debtCollections.CARD;
  const momo = truth.netTenders.MOMO + truth.debtCollections.MOMO;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Daily closing</h1>
          <p className="mt-2 text-sm text-slate-500">Sales are booked on the order date. Cash, card and MoMo reconcile on the date money was actually verified, collected or refunded.</p>
        </div>
        <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:flex sm:w-auto sm:flex-wrap">
          {["pdf", "word", "excel"].map((format) => (
            <a key={format} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#ded8cd] bg-white px-2 py-2 text-xs font-semibold sm:gap-2 sm:px-3 sm:text-sm" href={`/api/exports?module=closing&format=${format}&from=${selectedDate}&to=${selectedDate}`}>
              <FileDown size={15} /> {format.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      <form method="get" className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
        <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700" htmlFor="closing-review-date">
          Review business date
          <input id="closing-review-date" className="field mt-2" name="date" type="date" defaultValue={selectedDate} required />
        </label>
        <Button type="submit" variant="outline">Load day</Button>
      </form>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Sales booked" value={currency(truth.bookedSales, shop.currency)} icon={<ReceiptText size={20} />} helper={`${truth.bookedOrderCount} orders created`} />
        <StatCard label="Expected cash" value={currency(cash, shop.currency)} />
        <StatCard label="Card net" value={currency(card, shop.currency)} helper={truth.providerRefunds.CARD > 0 ? `${currency(truth.providerRefunds.CARD, shop.currency)} refunded today` : undefined} />
        <StatCard label="Momo net" value={currency(momo, shop.currency)} helper={truth.providerRefunds.MOMO > 0 ? `${currency(truth.providerRefunds.MOMO, shop.currency)} refunded today` : undefined} />
        <StatCard label="Credit sales" value={currency(truth.creditSales, shop.currency)} icon={<Scale size={20} />} />
        <StatCard label="Debt collected" value={currency(truth.debtCollections.total, shop.currency)} helper="Assigned by tender" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr] xl:gap-5">
        <div className="panel h-fit p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-2">
            <Calculator size={18} className="mt-0.5 text-[var(--shop-primary)]" />
            <div>
              <h2 className="text-lg font-semibold">{selectedClosing ? "Revise selected closing" : "Close selected day"}</h2>
              <p className="mt-1 text-sm text-slate-500">Business date {selectedDate}. The totals above are for this same date.</p>
            </div>
          </div>

          {selectedClosing ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
              This date is already closed. Saved values are loaded below. It was originally closed by <span className="font-semibold">{selectedClosing.closedBy.name}</span> and last saved {selectedClosing.updatedAt.toLocaleString()}.
            </div>
          ) : null}

          <form className="space-y-3" action={closeDayAction}>
            <input type="hidden" name="businessDate" value={selectedDate} />
            {selectedClosing ? (
              <>
                <input type="hidden" name="existingClosingId" value={selectedClosing.id} />
                <input type="hidden" name="expectedUpdatedAt" value={selectedClosing.updatedAt.toISOString()} />
              </>
            ) : null}
            <input className="field" name="openingFloat" type="number" min="0" step="0.01" placeholder="Opening float" defaultValue={selectedClosing?.openingFloat.toString() ?? "0"} />
            <input className="field" name="manualCash" type="number" min="0" step="0.01" placeholder="Cash counted manually" defaultValue={selectedClosing?.manualCash.toString() ?? ""} required />
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
              <input className="field" name="expenses" type="number" min="0" step="0.01" placeholder="Expenses" defaultValue={selectedClosing?.expenses.toString() ?? "0"} />
              <input className="field" name="refunds" type="number" min="0" step="0.01" placeholder="Cash/manual refunds only" defaultValue={selectedClosing?.refunds.toString() ?? "0"} />
            </div>
            <p className="text-xs leading-5 text-slate-500">Do not enter Paystack card or MoMo refunds here. Processed provider refunds are deducted on the day Paystack actually processes them.</p>
            <textarea className="field min-h-24" name="notes" placeholder="Variance reason, manager notes, cash bag code" defaultValue={selectedClosing?.notes ?? ""} />
            {selectedClosing ? (
              <ConfirmActionButton
                className="w-full"
                variant="danger"
                confirmation={`Revise the saved closing for ${selectedDate}? This replaces its saved amounts and records the revision in the audit log.`}
              >
                Revise saved closing
              </ConfirmActionButton>
            ) : (
              <Button className="w-full">Save closing</Button>
            )}
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Closing history</h2><p className="mt-1 text-sm text-slate-500">Open a date to review its saved values before making a revision.</p></div>
          <div className="divide-y divide-[#ded8cd] bg-white md:hidden">
            {closings.map((closing) => (
              <article key={closing.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <a className="font-semibold text-[var(--shop-primary)] hover:underline" href={`/dashboard/closing?date=${dateInput(closing.businessDate)}`}>{shortDate(closing.businessDate)}</a>
                    <p className="text-sm text-slate-500">{closing.closedBy.name}</p>
                  </div>
                  <Badge tone={closing.status === "BALANCED" ? "green" : "orange"}>{titleCase(closing.status)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 text-sm">
                  <div className="rounded-lg bg-[#f6f4ef] p-2"><p className="text-xs text-slate-500">Sales</p><p className="font-semibold">{currency(closing.totalSales.toString(), shop.currency)}</p></div>
                  <div className="rounded-lg bg-[#f6f4ef] p-2"><p className="text-xs text-slate-500">Manual cash</p><p className="font-semibold">{currency(closing.manualCash.toString(), shop.currency)}</p></div>
                  <div className="rounded-lg bg-[#f6f4ef] p-2"><p className="text-xs text-slate-500">Debt collected</p><p className="font-semibold">{currency(closing.debtCollections.toString(), shop.currency)}</p></div>
                  <div className="rounded-lg bg-[#f6f4ef] p-2"><p className="text-xs text-slate-500">Difference</p><p className="font-semibold">{currency(closing.cashDifference.toString(), shop.currency)}</p></div>
                </div>
              </article>
            ))}
            {!closings.length ? <p className="p-5 text-sm text-slate-500">No days closed yet.</p> : null}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Date</th><th className="p-4">Closed by</th><th className="p-4">Sales</th><th className="p-4">Debt collected</th><th className="p-4">Manual cash</th><th className="p-4">Difference</th><th className="p-4">Status</th></tr></thead>
              <tbody className="divide-y divide-[#ded8cd] bg-white">
                {closings.map((closing) => (
                  <tr key={closing.id}>
                    <td className="p-4 font-semibold"><a className="text-[var(--shop-primary)] hover:underline" href={`/dashboard/closing?date=${dateInput(closing.businessDate)}`}>{shortDate(closing.businessDate)}</a></td>
                    <td className="p-4">{closing.closedBy.name}</td>
                    <td className="p-4">{currency(closing.totalSales.toString(), shop.currency)}</td>
                    <td className="p-4">{currency(closing.debtCollections.toString(), shop.currency)}</td>
                    <td className="p-4">{currency(closing.manualCash.toString(), shop.currency)}</td>
                    <td className="p-4">{currency(closing.cashDifference.toString(), shop.currency)}</td>
                    <td className="p-4"><Badge tone={closing.status === "BALANCED" ? "green" : "orange"}>{titleCase(closing.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {debtPayments.length ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Debt collections for {selectedDate}</h2><p className="mt-1 text-sm text-slate-500">Each collection is assigned to its real payment category for reconciliation.</p></div>
          <div className="divide-y divide-[#ded8cd] bg-white md:hidden">
            {debtPayments.map((payment) => (
              <article key={payment.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0"><p className="truncate font-semibold">{payment.debt.customer.name}</p><p className="text-sm text-slate-500">{titleCase(payment.method)} · {payment.receivedBy.name}</p></div>
                <div className="shrink-0 text-right"><p className="font-semibold">{currency(payment.amount.toString(), shop.currency)}</p><p className="text-xs text-slate-400">{payment.receivedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Customer</th><th className="p-4">Method</th><th className="p-4">Amount</th><th className="p-4">Received by</th><th className="p-4">Time</th></tr></thead>
              <tbody className="divide-y divide-[#ded8cd] bg-white">
                {debtPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="p-4 font-semibold">{payment.debt.customer.name}</td>
                    <td className="p-4">{titleCase(payment.method)}</td>
                    <td className="p-4">{currency(payment.amount.toString(), shop.currency)}</td>
                    <td className="p-4">{payment.receivedBy.name}</td>
                    <td className="p-4">{payment.receivedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
