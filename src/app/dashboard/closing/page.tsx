import { Calculator, FileDown, ReceiptText, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { closeDayAction } from "@/app/dashboard/closing/actions";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

type Props = {
  searchParams?: Promise<{ date?: string }>;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function bounds(value: string) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function ClosingPage({ searchParams }: Props) {
  await requireRole(permissions.closing);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const params = (await searchParams) ?? {};
  const selectedDate = params.date ?? todayInput();
  const { start, end } = bounds(selectedDate);

  const [orders, debtPayments, closings] = await Promise.all([
    prisma.order.findMany({
      where: { shopId: shop.id, createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      include: { payments: true, processedBy: true },
      orderBy: { createdAt: "desc" },
    }),
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
  ]);

  const debtCash = debtPayments.filter((payment) => payment.method === "CASH").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const debtCard = debtPayments.filter((payment) => payment.method === "CARD").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const debtMomo = debtPayments.filter((payment) => payment.method === "MOMO").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const debtCollections = debtCash + debtCard + debtMomo;
  const cash = orders.flatMap((order) => order.payments).filter((payment) => payment.method === "CASH" && payment.status === "SUCCESS").reduce((sum, payment) => sum + Number(payment.amount), 0) + debtCash;
  const card = orders.flatMap((order) => order.payments).filter((payment) => payment.method === "CARD" && payment.status === "SUCCESS").reduce((sum, payment) => sum + Number(payment.amount), 0) + debtCard;
  const momo = orders.flatMap((order) => order.payments).filter((payment) => payment.method === "MOMO" && payment.status === "SUCCESS").reduce((sum, payment) => sum + Number(payment.amount), 0) + debtMomo;
  const credit = orders.flatMap((order) => order.payments).filter((payment) => payment.method === "STORE_CREDIT").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Daily closing</h1>
          <p className="mt-2 text-sm text-slate-500">Compare the system expectation with the money counted by staff.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["pdf", "word", "excel"].map((format) => (
            <a key={format} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-sm font-semibold" href={`/api/exports?module=closing&format=${format}&from=${selectedDate}&to=${selectedDate}`}>
              <FileDown size={16} /> {format.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total sales" value={currency(total, shop.currency)} icon={<ReceiptText size={20} />} />
        <StatCard label="Expected cash" value={currency(cash, shop.currency)} />
        <StatCard label="Card" value={currency(card, shop.currency)} />
        <StatCard label="Momo" value={currency(momo, shop.currency)} />
        <StatCard label="Credit sales" value={currency(credit, shop.currency)} icon={<Scale size={20} />} />
        <StatCard label="Debt collected" value={currency(debtCollections, shop.currency)} helper="Included by tender, not counted as new sales" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Calculator size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-lg font-semibold">Close selected day</h2>
          </div>
          <form className="space-y-3" action={closeDayAction}>
            <input className="field" name="businessDate" type="date" defaultValue={selectedDate} required />
            <input className="field" name="openingFloat" type="number" min="0" step="0.01" placeholder="Opening float" defaultValue="0" />
            <input className="field" name="manualCash" type="number" min="0" step="0.01" placeholder="Cash counted manually" required />
            <div className="grid grid-cols-2 gap-2">
              <input className="field" name="expenses" type="number" min="0" step="0.01" placeholder="Expenses" defaultValue="0" />
              <input className="field" name="refunds" type="number" min="0" step="0.01" placeholder="Refunds" defaultValue="0" />
            </div>
            <textarea className="field min-h-24" name="notes" placeholder="Variance reason, manager notes, cash bag code" />
            <Button className="w-full">Save closing</Button>
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-lg font-semibold">Closing history</h2>
          </div>
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
              <tr><th className="p-4">Date</th><th className="p-4">Closed by</th><th className="p-4">Sales</th><th className="p-4">Debt collected</th><th className="p-4">Manual cash</th><th className="p-4">Difference</th><th className="p-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#ded8cd] bg-white">
              {closings.map((closing) => (
                <tr key={closing.id}>
                  <td className="p-4 font-semibold">{shortDate(closing.businessDate)}</td>
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
          {!closings.length ? <p className="p-5 text-sm text-slate-500">No days closed yet.</p> : null}
        </div>
      </section>

      {debtPayments.length ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-lg font-semibold">Debt collections for {selectedDate}</h2>
            <p className="mt-1 text-sm text-slate-500">Each collection is assigned to its real payment category for reconciliation.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Customer</th><th className="p-4">Method</th><th className="p-4">Amount</th><th className="p-4">Received by</th><th className="p-4">Time</th></tr></thead>
              <tbody className="divide-y divide-[#ded8cd] bg-white">
                {debtPayments.map((payment) => <tr key={payment.id}><td className="p-4 font-semibold">{payment.debt.customer.name}</td><td className="p-4">{titleCase(payment.method)}</td><td className="p-4">{currency(payment.amount.toString(), shop.currency)}</td><td className="p-4">{payment.receivedBy.name}</td><td className="p-4">{payment.receivedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
