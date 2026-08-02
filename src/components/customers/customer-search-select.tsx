"use client";

import { Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { FeedbackState } from "@/components/ui/feedback-state";
import { SelectionCard } from "@/components/ui/selection-card";

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
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 focus-within:border-[var(--shop-primary)] focus-within:ring-4 focus-within:ring-[color-mix(in_srgb,var(--shop-primary),white_78%)]">
        <Search size={16} className="shrink-0 text-slate-400" />
        <input
          className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (selectedId) setSelectedId("");
          }}
          placeholder="Search customer by name, phone, or email"
          aria-label="Search customers"
        />
      </label>
      {selected ? (
        <SelectionCard
          selected
          selectedLabel="Selected"
          leading={<UserRound size={17} />}
          title={selected.name}
          description={selected.phone ?? selected.email ?? "Customer selected"}
          detail="Tap to change customer"
          onClick={() => {
            setSelectedId("");
            setQuery("");
          }}
        />
      ) : (
        <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1.5 scrollbar-thin">
          {matches.map((customer) => (
            <SelectionCard
              key={customer.id}
              leading={<UserRound size={16} />}
              title={customer.name}
              description={customer.phone ?? customer.email ?? "No contact saved"}
              onClick={() => {
                setSelectedId(customer.id);
                setQuery(customer.name);
              }}
            />
          ))}
          {!matches.length ? <FeedbackState compact state="empty" title="No matching customer" description="Add the customer in Customer records first." /> : null}
        </div>
      )}
      {!selectedId ? <p className="text-xs leading-5 text-slate-500">Choose a customer from the search results before saving.</p> : null}
    </div>
  );
}
