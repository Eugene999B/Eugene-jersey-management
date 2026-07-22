import { Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { currency, shortDate } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { createCustomerAction, updateCustomerAction } from "@/app/dashboard/customers/actions";
import { hasRole, permissions } from "@/lib/rbac";
import { requireRole } from "@/lib/auth";

type Props = { searchParams?: Promise<{ q?: string; error?: string; selected?: string }> };

export default async function CustomersPage({ searchParams }: Props) {
  await requireRole(permissions.customersRead);
  const params = (await searchParams) ?? {};
  const { shop, session } = await getTenantContext();
  if (!shop) return null;
  const query = params.q?.trim() ?? "";
  const canWrite = hasRole(session, permissions.customersWrite);
  const customers = await prisma.customer.findMany({
    where: {
      shopId: shop.id,
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }, { email: { contains: query, mode: "insensitive" } }, { group: { contains: query, mode: "insensitive" } }] } : {}),
    },
    include: { orders: true, debts: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Customer records</h1><p className="mt-2 text-sm text-slate-500">Search, create and maintain the customer record used by POS, debts, orders and messages.</p></div>
        <form className="flex w-full max-w-md gap-2"><label className="flex min-h-11 flex-1 items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3"><Search size={16} className="text-slate-400" /><input className="min-w-0 flex-1 outline-none" name="q" defaultValue={query} placeholder="Name, phone, email or group" aria-label="Search customers" /></label><Button variant="outline">Search</Button></form>
      </div>
      {params.error === "duplicate" ? <div className="rounded-[8px] border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">A customer with that phone or email already exists. The matching record is highlighted below.</div> : null}
      {params.error === "invalid" ? <div className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">Check the customer details and try again.</div> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {canWrite ? <section className="panel h-fit p-5"><div className="flex items-center gap-2"><UserPlus size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Add customer</h2></div><form action={createCustomerAction} className="mt-4 space-y-3"><label className="block text-sm font-semibold">Name<input className="field mt-1" name="name" required /></label><label className="block text-sm font-semibold">Phone<input className="field mt-1" name="phone" placeholder="+233..." /></label><label className="block text-sm font-semibold">Email<input className="field mt-1" name="email" type="email" /></label><label className="block text-sm font-semibold">Group<input className="field mt-1" name="group" defaultValue="Retail" /></label><label className="block text-sm font-semibold">Notes<textarea className="field mt-1 min-h-24" name="notes" /></label><Button className="w-full">Create customer</Button></form></section> : null}

        <section className="space-y-3">
          {customers.map((customer) => {
            const spent = customer.orders.filter((order) => order.status !== "CANCELLED").reduce((sum, order) => sum + Number(order.totalAmount), 0);
            const openDebt = customer.debts.reduce((sum, debt) => sum + Number(debt.principalAmount) - Number(debt.paidAmount), 0);
            return <details key={customer.id} open={params.selected === customer.id} className={`panel overflow-hidden ${params.selected === customer.id ? "ring-2 ring-[var(--shop-primary)]" : ""}`}><summary className="cursor-pointer list-none p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{customer.name}</p><p className="mt-1 text-sm text-slate-500">{customer.phone ?? customer.email ?? "No contact saved"}</p></div><div className="flex flex-wrap items-center gap-2 text-sm"><Badge>{customer.group}</Badge><span>{customer.orders.length} order(s)</span><span className="font-semibold">{currency(spent, shop.currency)}</span>{openDebt > 0 ? <Badge tone="orange">Debt {currency(openDebt, shop.currency)}</Badge> : null}<span className="text-slate-400">{shortDate(customer.updatedAt)}</span></div></div></summary>{canWrite ? <form action={updateCustomerAction} className="grid gap-3 border-t border-[#ded8cd] bg-white p-4 md:grid-cols-2"><input type="hidden" name="customerId" value={customer.id} /><label className="text-sm font-semibold">Name<input className="field mt-1" name="name" defaultValue={customer.name} required /></label><label className="text-sm font-semibold">Phone<input className="field mt-1" name="phone" defaultValue={customer.phone ?? ""} /></label><label className="text-sm font-semibold">Email<input className="field mt-1" name="email" type="email" defaultValue={customer.email ?? ""} /></label><label className="text-sm font-semibold">Group<input className="field mt-1" name="group" defaultValue={customer.group} /></label><label className="text-sm font-semibold md:col-span-2">Notes<textarea className="field mt-1 min-h-20" name="notes" defaultValue={customer.notes ?? ""} /></label><Button className="md:col-span-2">Save customer</Button></form> : null}</details>;
          })}
          {!customers.length ? <div className="panel p-8 text-center text-sm text-slate-500">No matching customer records.</div> : null}
        </section>
      </div>
    </div>
  );
}
