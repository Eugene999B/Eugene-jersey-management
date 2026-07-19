import { FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getTenantContext } from "@/lib/tenant";

const exportModules = [
  ["pos", "POS sales", "Receipts, payment modes, staff movement, and daily revenue."],
  ["payments", "Payment modes", "Cash, card, mobile money, and store credit status by receipt."],
  ["debts", "Debts", "Balances, installments, due dates, and reminder counts."],
  ["closing", "Daily closing", "System expectation, manual cash, variance, and approvals."],
  ["catalog", "Catalog", "Products, variants, stock levels, and pricing."],
  ["suppliers", "Suppliers", "Supplier contacts, terms, lead time, and purchase orders."],
  ["network", "Shop network", "Linked shops, requests, exchanges, and fulfillment status."],
  ["designs", "Design jobs", "Machine profiles, export formats, customers, and artwork status."],
  ["messages", "Messages", "SMS, WhatsApp, email, receipts, and reminder logs."],
  ["activity", "Activity logs", "Audit trail for security and operations."],
] as const;

export default async function ExportsPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Exports center</h1>
        <p className="mt-2 text-sm text-slate-500">Download printable reports for every important category.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exportModules.map(([module, title, description]) => (
          <section key={module} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
              <Badge tone="blue"><FileDown size={14} /> Export</Badge>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {["pdf", "word", "excel"].map((format) => (
                <a
                  key={format}
                  href={`/api/exports?module=${module}&format=${format}`}
                  className="rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:border-[var(--shop-primary)] hover:text-[var(--shop-primary)]"
                >
                  {format.toUpperCase()}
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
