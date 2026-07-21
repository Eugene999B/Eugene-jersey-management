"use client";

import { Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export function CustomerSearchSelect({ customers }: { customers: CustomerOption[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers.slice(0, 8);
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email].some((value) => value?.toLowerCase().includes(needle)),
    ).slice(0, 8);
  }, [customers, query]);
  const selected = customers.find((customer) => customer.id === selectedId);

  return (
    <div className="space-y-2">
      <input type="hidden" name="customerId" value={selectedId} />
      <label className="flex items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3">
        <Search size={16} className="text-slate-400" />
        <input
          className="min-h-11 flex-1 bg-transparent text-sm outline-none"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customer by name, phone, or email"
          aria-label="Search customers"
        />
      </label>
      {selected ? (
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm"
          onClick={() => setSelectedId("")}
        >
          <span><strong>{selected.name}</strong><span className="ml-2 text-slate-500">{selected.phone ?? selected.email ?? "Customer selected"}</span></span>
          <span className="text-xs font-semibold text-emerald-700">Change</span>
        </button>
      ) : (
        <div className="max-h-52 overflow-y-auto rounded-[8px] border border-[#ded8cd] bg-white p-1">
          {matches.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-[#f6f4ef]"
              onClick={() => {
                setSelectedId(customer.id);
                setQuery(customer.name);
              }}
            >
              <UserRound size={16} className="text-slate-400" />
              <span><strong className="block">{customer.name}</strong><span className="text-xs text-slate-500">{customer.phone ?? customer.email ?? "No contact saved"}</span></span>
            </button>
          ))}
          {!matches.length ? <p className="px-3 py-4 text-sm text-slate-500">No matching customer. Add them in Customers first.</p> : null}
        </div>
      )}
      {!selectedId ? <p className="text-xs text-slate-500">Choose a customer from the search results before saving.</p> : null}
    </div>
  );
}
