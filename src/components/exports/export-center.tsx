"use client";

import { CalendarRange, Download, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

const modules = [
  ["pos", "POS sales", "Receipts, payment modes, staff movement, and daily revenue."],
  ["payments", "Payment modes", "Cash, card, mobile money, and store credit status by receipt."],
  ["debts", "Debts", "Balances, installments, due dates, and reminder counts."],
  ["closing", "Daily closing", "System expectation, manual cash, variance, and approvals."],
  ["catalog", "Catalog", "Products, variants, stock levels, and pricing."],
  ["suppliers", "Suppliers", "Supplier contacts, terms, lead time, and purchase orders."],
  ["network", "Shop network", "Linked shops, requests, exchanges, and fulfillment status."],
  ["designs", "Design jobs", "Machine profiles, customers, and production status."],
  ["messages", "Messages", "SMS, WhatsApp, email, receipts, and reminder logs."],
  ["activity", "Activity logs", "Audit trail for security and operations."],
] as const;

export function ExportCenter() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [query, setQuery] = useState("");

  function href(module: string, format: string) {
    const params = new URLSearchParams({ module, format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (query.trim()) params.set("q", query.trim());
    return `/api/exports?${params}`;
  }

  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <div className="flex items-center gap-2"><SlidersHorizontal size={18} /><h2 className="font-semibold">Report scope</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
          <label className="text-xs font-semibold text-slate-600"><span className="flex items-center gap-1"><CalendarRange size={14} /> From</span><input className="field mt-1" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600"><span className="flex items-center gap-1"><CalendarRange size={14} /> To</span><input className="field mt-1" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600"><span className="flex items-center gap-1"><Search size={14} /> Search within exported rows</span><input className="field mt-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Receipt, customer, product, status, staff…" /></label>
          <button className="h-[43px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold" onClick={() => { setFrom(""); setTo(""); setQuery(""); }}>Clear</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">The selected range and search are applied to every download below. Empty dates mean all available records.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(([module, title, description]) => (
          <section key={module} className="panel p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div><Download size={19} className="text-[var(--shop-primary)]" /></div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {["pdf", "word", "excel"].map((format) => <a key={format} href={href(module, format)} className="rounded-lg border border-[#ded8cd] bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:border-[var(--shop-primary)] hover:text-[var(--shop-primary)]">{format.toUpperCase()}</a>)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
