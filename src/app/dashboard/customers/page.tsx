import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { currency, shortDate } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";

export default async function CustomersPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const customers = await prisma.customer.findMany({
    where: { shopId: shop.id },
    include: { orders: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-[#ded8cd] p-5">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="mt-2 text-sm text-slate-500">CRM profiles, purchase history, groups, and loyalty points.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
            <tr><th className="p-4">Customer</th><th className="p-4">Group</th><th className="p-4">Orders</th><th className="p-4">Spent</th><th className="p-4">Loyalty</th><th className="p-4">Updated</th></tr>
          </thead>
          <tbody className="divide-y divide-[#ded8cd] bg-white">
            {customers.map((customer) => {
              const spent = customer.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
              return (
                <tr key={customer.id}>
                  <td className="p-4">
                    <p className="font-semibold">{customer.name}</p>
                    <p className="text-slate-500">{customer.phone ?? customer.email ?? "No contact"}</p>
                  </td>
                  <td className="p-4"><Badge>{customer.group}</Badge></td>
                  <td className="p-4">{customer.orders.length}</td>
                  <td className="p-4 font-semibold">{currency(spent, shop.currency)}</td>
                  <td className="p-4">{customer.loyaltyPoints}</td>
                  <td className="p-4 text-slate-500">{shortDate(customer.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
