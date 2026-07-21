import { CalendarClock, CreditCard, MessageSquareText, Plus } from "lucide-react";
import { NotificationChannel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { createDebtAction, recordDebtPaymentAction, sendDebtReminderAction } from "@/app/dashboard/debts/actions";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { CustomerSearchSelect } from "@/components/customers/customer-search-select";

type Props = { searchParams?: Promise<{ error?: string }> };

const debtErrors: Record<string, string> = {
  invalid: "Choose a customer and enter a valid debt amount and due date.",
  customer: "That customer could not be found in this shop.",
  payment: "Enter a valid payment amount and choose cash, card, or mobile money.",
  "amount-exceeds-balance": "The amount received cannot be greater than the outstanding balance.",
};

export default async function DebtsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [customers, debts] = await Promise.all([
    prisma.customer.findMany({ where: { shopId: shop.id }, orderBy: { name: "asc" } }),
    prisma.debt.findMany({
      where: { shopId: shop.id },
      include: { customer: true, installments: { orderBy: { dueDate: "asc" } }, payments: { orderBy: { receivedAt: "desc" }, take: 3 } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 80,
    }),
  ]);

  const openDebts = debts.filter((debt) => debt.status !== "PAID" && debt.status !== "WRITTEN_OFF");
  const totalDebt = openDebts.reduce((sum, debt) => sum + Number(debt.principalAmount) - Number(debt.paidAmount), 0);
  const overdue = openDebts.filter((debt) => debt.dueDate < new Date());
  const installmentCount = debts.reduce((sum, debt) => sum + debt.installments.length, 0);

  return (
    <div className="space-y-5">
      {params.error && debtErrors[params.error] ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{debtErrors[params.error]}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Debts and installments</h1>
          <p className="mt-2 text-sm text-slate-500">Track customer credit, payment plans, reminders, and collection risk.</p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open balance" value={currency(totalDebt, shop.currency)} icon={<CreditCard size={20} />} />
        <StatCard label="Open debts" value={String(openDebts.length)} />
        <StatCard label="Overdue" value={String(overdue.length)} helper="Needs reminder or follow-up" icon={<CalendarClock size={20} />} />
        <StatCard label="Installments" value={String(installmentCount)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-lg font-semibold">Create debt plan</h2>
          </div>
          <form action={createDebtAction} className="space-y-3">
            <CustomerSearchSelect customers={customers.map(({ id, name, phone, email }) => ({ id, name, phone, email }))} />
            <div className="grid grid-cols-2 gap-3">
              <input className="field" name="principalAmount" type="number" min="1" step="0.01" placeholder="Amount owed" required />
              <input className="field" name="installments" type="number" min="1" max="12" defaultValue="1" placeholder="Installments" />
            </div>
            <input className="field" name="dueDate" type="date" required />
            <textarea className="field min-h-24" name="notes" placeholder="Reason, receipt, agreement, or production note" />
            <Button className="w-full">Save debt</Button>
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-lg font-semibold">Collection board</h2>
          </div>
          <div className="divide-y divide-[#ded8cd] bg-white">
            {debts.map((debt) => {
              const balance = Number(debt.principalAmount) - Number(debt.paidAmount);
              const isOverdue = debt.status !== "PAID" && debt.dueDate < new Date();
              return (
                <article key={debt.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{debt.customer.name}</h3>
                      <Badge tone={debt.status === "PAID" ? "green" : isOverdue ? "red" : "orange"}>
                        {isOverdue ? "Overdue" : titleCase(debt.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Balance {currency(balance, shop.currency)} of {currency(debt.principalAmount.toString(), shop.currency)} - due {shortDate(debt.dueDate)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {debt.installments.map((installment) => (
                        <span key={installment.id} className="rounded-[8px] bg-[#f6f4ef] px-2 py-1 text-xs font-semibold text-slate-600">
                          {currency(installment.amount.toString(), shop.currency)} - {shortDate(installment.dueDate)}
                        </span>
                      ))}
                    </div>
                    {debt.notes ? <p className="mt-3 text-sm text-slate-600">{debt.notes}</p> : null}
                    {debt.payments.length ? <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent collections</p><div className="mt-2 flex flex-wrap gap-2">{debt.payments.map((payment) => <span key={payment.id} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{titleCase(payment.method)} · {currency(payment.amount.toString(), shop.currency)}</span>)}</div></div> : null}
                  </div>
                  <div className="space-y-2">
                    <form action={recordDebtPaymentAction} className="rounded-[8px] border border-[#ded8cd] bg-[#f9f8f5] p-3">
                      <input type="hidden" name="debtId" value={debt.id} />
                      <p className="mb-2 text-sm font-semibold">Receive debt payment</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input className="field min-w-0" name="amount" type="number" min="0.01" max={balance} step="0.01" placeholder="Amount received" required />
                        <select className="field" name="method" defaultValue="CASH" required>
                          <option value="CASH">Cash</option>
                          <option value="CARD">Card</option>
                          <option value="MOMO">Mobile money</option>
                        </select>
                      </div>
                      <input className="field mt-2" name="reference" placeholder="Reference (optional)" />
                      <Button className="mt-2 w-full" variant="outline">Post collection</Button>
                    </form>
                    <div className="grid grid-cols-2 gap-2">
                      {[NotificationChannel.SMS, NotificationChannel.WHATSAPP].map((channel) => (
                        <form key={channel} action={sendDebtReminderAction}>
                          <input type="hidden" name="debtId" value={debt.id} />
                          <input type="hidden" name="channel" value={channel} />
                          <Button variant="outline" className="w-full">
                            <MessageSquareText size={15} /> {channel}
                          </Button>
                        </form>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
            {!debts.length ? <p className="p-5 text-sm text-slate-500">No customer debt recorded yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
