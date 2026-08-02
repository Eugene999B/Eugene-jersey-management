"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { Role } from "@prisma/client";
import { visibleShopNavigationItems } from "@/lib/shop-navigation";
import type { SubscriptionFeature } from "@/lib/subscription-hardening";

type DashboardToolSearchProps = {
  role: Role;
  enabledModules: string[];
  includedFeatures: readonly SubscriptionFeature[];
};

export function DashboardToolSearch({ role, enabledModules, includedFeatures }: DashboardToolSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo(
    () => visibleShopNavigationItems(role, enabledModules, includedFeatures),
    [role, enabledModules, includedFeatures],
  );
  const matches = items.filter((item) => `${item.label} ${item.description} ${item.section}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search ESM tools" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-slate-700 hover:border-[var(--line-strong)] hover:text-slate-950">
        <Search size={17} />
        <span className="hidden md:inline">Find a tool</span>
        <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 xl:inline">/</kbd>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/60 p-3 pt-[10vh] sm:p-6" role="dialog" aria-modal="true" aria-label="Search ESM tools">
          <button type="button" aria-label="Close tool search" className="absolute inset-0" onClick={() => setOpen(false)} />
          <section className="relative z-10 flex max-h-[76vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-200 p-3 sm:p-4">
              <Search size={19} className="shrink-0 text-slate-400" />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none" placeholder="Search pages and tools" aria-label="Search pages and tools" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><X size={19} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
              {matches.length ? matches.map((item) => {
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-100"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-950">{item.label}</span><span className="block truncate text-xs text-slate-500">{item.description}</span></span><span className="hidden text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:block">{item.section}</span></Link>;
              }) : <div className="p-8 text-center"><p className="font-semibold text-slate-800">No matching tool</p><p className="mt-1 text-sm text-slate-500">Try another page name or operation.</p></div>}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
