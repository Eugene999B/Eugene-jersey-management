"use client";

import { useMemo } from "react";
import { Banknote, CheckCircle2, Clock3, CreditCard, Plus, Smartphone, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectionCard } from "@/components/ui/selection-card";
import { currency } from "@/lib/format";
import {
  POS_TENDER_METHODS,
  moneyToMinor,
  minorToMoney,
  normalizePosTenders,
  posTenderError,
  type PosTenderInput,
  type PosTenderMethod,
  type PosTenderPlan,
} from "@/lib/pos-tenders";

export type PosPaymentMode = "SINGLE" | "MIXED";

export type PosTenderDraft = {
  method: PosTenderMethod;
  enabled: boolean;
  amount: string;
  tenderedAmount: string;
  reference: string;
  confirmed: boolean;
};

export type PosPaymentSelection = {
  inputs: PosTenderInput[];
  plan: PosTenderPlan | null;
  error: string | null;
};

const methodCopy: Record<PosTenderMethod, { label: string; description: string; icon: typeof Banknote }> = {
  CASH: { label: "Cash", description: "Record cash received and change", icon: Banknote },
  CARD: { label: "Card", description: "Confirm terminal payment and reference", icon: CreditCard },
  MOMO: { label: "Mobile money", description: "Confirm network payment and reference", icon: Smartphone },
  STORE_CREDIT: { label: "Credit", description: "Create debt for only this portion", icon: Clock3 },
};

export function createPosTenderDrafts(): PosTenderDraft[] {
  return POS_TENDER_METHODS.map((method) => ({
    method,
    enabled: method === "CASH",
    amount: "",
    tenderedAmount: "",
    reference: "",
    confirmed: false,
  }));
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildPosTenderSelection(
  mode: PosPaymentMode,
  drafts: readonly PosTenderDraft[],
  total: number,
): PosPaymentSelection {
  if (moneyToMinor(total) === 0) {
    return { inputs: [], plan: normalizePosTenders([], 0), error: null };
  }

  const active = drafts.filter((draft) => draft.enabled);
  const inputs: PosTenderInput[] = active.map((draft) => {
    const amount = mode === "SINGLE" ? total : numberValue(draft.amount);
    return {
      method: draft.method,
      amount,
      tenderedAmount: draft.method === "CASH"
        ? draft.tenderedAmount.trim() ? numberValue(draft.tenderedAmount) : amount
        : undefined,
      reference: draft.reference,
      confirmed: draft.confirmed,
    };
  });

  try {
    return { inputs, plan: normalizePosTenders(inputs, total), error: null };
  } catch (error) {
    return { inputs, plan: null, error: posTenderError(error)?.message ?? "Check the payment breakdown." };
  }
}

function updateDraft(
  drafts: readonly PosTenderDraft[],
  method: PosTenderMethod,
  patch: Partial<PosTenderDraft>,
) {
  return drafts.map((draft) => draft.method === method ? { ...draft, ...patch } : draft);
}

type Props = {
  total: number;
  currencyCode: string;
  mode: PosPaymentMode;
  onModeChange: (mode: PosPaymentMode) => void;
  tenders: PosTenderDraft[];
  onTendersChange: (tenders: PosTenderDraft[]) => void;
  creditDueDate: string;
  onCreditDueDateChange: (value: string) => void;
  creditInstallments: number;
  onCreditInstallmentsChange: (value: number) => void;
  selectedCustomer: { name: string; outstandingBalance: number } | null;
  customerName: string;
};

export function PosPaymentPanel({
  total,
  currencyCode,
  mode,
  onModeChange,
  tenders,
  onTendersChange,
  creditDueDate,
  onCreditDueDateChange,
  creditInstallments,
  onCreditInstallmentsChange,
  selectedCustomer,
  customerName,
}: Props) {
  const selection = useMemo(() => buildPosTenderSelection(mode, tenders, total), [mode, tenders, total]);
  const active = tenders.filter((tender) => tender.enabled);
  const allocatedMinor = mode === "SINGLE"
    ? moneyToMinor(total)
    : active.reduce((sum, tender) => sum + moneyToMinor(numberValue(tender.amount)), 0);
  const remainingMinor = Math.max(moneyToMinor(total) - allocatedMinor, 0);
  const creditEnabled = tenders.some((tender) => tender.enabled && tender.method === "STORE_CREDIT");

  function chooseSingle(method: PosTenderMethod) {
    onTendersChange(tenders.map((tender) => ({
      ...tender,
      enabled: tender.method === method,
      amount: "",
      confirmed: tender.method === method ? tender.confirmed : false,
    })));
  }

  function changeMode(next: PosPaymentMode) {
    if (next === mode) return;
    if (next === "SINGLE") {
      const first = active[0]?.method ?? "CASH";
      chooseSingle(first);
    } else {
      const single = active[0]?.method ?? "CASH";
      onTendersChange(tenders.map((tender) => ({
        ...tender,
        enabled: tender.method === single,
        amount: tender.method === single ? total.toFixed(2) : "",
      })));
    }
    onModeChange(next);
  }

  function enableTender(method: PosTenderMethod) {
    const otherAllocated = tenders
      .filter((tender) => tender.enabled && tender.method !== method)
      .reduce((sum, tender) => sum + moneyToMinor(numberValue(tender.amount)), 0);
    const suggested = minorToMoney(Math.max(moneyToMinor(total) - otherAllocated, 0));
    onTendersChange(updateDraft(tenders, method, { enabled: true, amount: suggested ? suggested.toFixed(2) : "" }));
  }

  function disableTender(method: PosTenderMethod) {
    if (active.length <= 1) return;
    onTendersChange(updateDraft(tenders, method, {
      enabled: false,
      amount: "",
      tenderedAmount: "",
      reference: "",
      confirmed: false,
    }));
  }

  function useRemaining(method: PosTenderMethod) {
    const otherAllocated = tenders
      .filter((tender) => tender.enabled && tender.method !== method)
      .reduce((sum, tender) => sum + moneyToMinor(numberValue(tender.amount)), 0);
    const remaining = minorToMoney(Math.max(moneyToMinor(total) - otherAllocated, 0));
    onTendersChange(updateDraft(tenders, method, { amount: remaining.toFixed(2) }));
  }

  if (moneyToMinor(total) === 0) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-bold text-emerald-900">No payment is due</p>
        <p className="mt-1 text-xs leading-5 text-emerald-800">The final total is zero. ESM will complete the order without creating a payment or debt record.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4" aria-label="Payment breakdown">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">Payment breakdown</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Every amount must reconcile exactly to {currency(total, currencyCode)}.</p>
        </div>
        <Badge tone={selection.plan ? "green" : "orange"}>{selection.plan ? "Balanced" : "Needs attention"}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment mode">
        <SelectionCard
          role="radio"
          aria-checked={mode === "SINGLE"}
          selected={mode === "SINGLE"}
          selectedLabel="Selected"
          title="Single payment"
          description="One method covers the full total"
          onClick={() => changeMode("SINGLE")}
        />
        <SelectionCard
          role="radio"
          aria-checked={mode === "MIXED"}
          selected={mode === "MIXED"}
          selectedLabel="Selected"
          title="Split or mixed"
          description="Combine cash, card, MoMo or credit"
          onClick={() => changeMode("MIXED")}
        />
      </div>

      {mode === "SINGLE" ? (
        <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Single payment method">
          {tenders.map((tender) => {
            const copy = methodCopy[tender.method];
            const Icon = copy.icon;
            return (
              <SelectionCard
                key={tender.method}
                role="radio"
                aria-checked={tender.enabled}
                selected={tender.enabled}
                selectedLabel="Selected"
                leading={<Icon size={18} />}
                title={copy.label}
                description={copy.description}
                onClick={() => chooseSingle(tender.method)}
              />
            );
          })}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tenders.map((tender) => {
            const copy = methodCopy[tender.method];
            const Icon = copy.icon;
            return tender.enabled ? (
              <button
                key={tender.method}
                type="button"
                onClick={() => disableTender(tender.method)}
                disabled={active.length <= 1}
                className="flex min-h-16 items-center justify-between gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-50 px-3 text-left text-xs font-bold text-cyan-950 disabled:cursor-not-allowed"
                aria-label={`Remove ${copy.label} from mixed payment`}
              >
                <span className="flex min-w-0 items-center gap-2"><Icon size={17} /><span className="truncate">{copy.label}</span></span>
                <X size={15} />
              </button>
            ) : (
              <button
                key={tender.method}
                type="button"
                onClick={() => enableTender(tender.method)}
                className="flex min-h-16 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-xs font-bold text-slate-600"
                aria-label={`Add ${copy.label} to mixed payment`}
              >
                <Plus size={16} /> {copy.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {active.map((tender) => {
          const copy = methodCopy[tender.method];
          const Icon = copy.icon;
          const effectiveAmount = mode === "SINGLE" ? total.toFixed(2) : tender.amount;
          const amountMinor = moneyToMinor(numberValue(effectiveAmount));
          const cashReceivedMinor = tender.method === "CASH"
            ? moneyToMinor(tender.tenderedAmount.trim() ? numberValue(tender.tenderedAmount) : numberValue(effectiveAmount))
            : 0;
          const cashChange = tender.method === "CASH" ? minorToMoney(Math.max(cashReceivedMinor - amountMinor, 0)) : 0;
          return (
            <article key={tender.method} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><Icon size={17} />{copy.label}</p>
                {mode === "MIXED" ? <button type="button" className="text-xs font-bold text-cyan-700 underline" onClick={() => useRemaining(tender.method)}>Use remaining</button> : <Badge>{currency(total, currencyCode)}</Badge>}
              </div>

              {mode === "MIXED" ? (
                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Amount allocated
                  <input
                    className="field mt-1"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={tender.amount}
                    onChange={(event) => onTendersChange(updateDraft(tenders, tender.method, { amount: event.target.value }))}
                    placeholder="0.00"
                  />
                </label>
              ) : null}

              {tender.method === "CASH" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Cash received
                    <input
                      className="field mt-1"
                      type="number"
                      min={numberValue(effectiveAmount)}
                      step="0.01"
                      inputMode="decimal"
                      value={tender.tenderedAmount}
                      onChange={(event) => onTendersChange(updateDraft(tenders, tender.method, { tenderedAmount: event.target.value }))}
                      placeholder={effectiveAmount || "0.00"}
                    />
                  </label>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Change due</p>
                    <p className="mt-1 text-lg font-black text-emerald-950">{currency(cashChange, currencyCode)}</p>
                  </div>
                </div>
              ) : null}

              {tender.method === "CARD" || tender.method === "MOMO" ? (
                <div className="mt-3 space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <label className="block text-xs font-semibold text-sky-900">
                    {tender.method === "CARD" ? "Terminal reference" : "Mobile-money reference"}
                    <input
                      className="field mt-1"
                      value={tender.reference}
                      onChange={(event) => onTendersChange(updateDraft(tenders, tender.method, { reference: event.target.value }))}
                      placeholder="Required reference"
                      maxLength={120}
                    />
                  </label>
                  <label className="flex items-start gap-2 text-xs font-semibold text-sky-900">
                    <input
                      className="mt-0.5 h-5 w-5 shrink-0"
                      type="checkbox"
                      checked={tender.confirmed}
                      onChange={(event) => onTendersChange(updateDraft(tenders, tender.method, { confirmed: event.target.checked }))}
                    />
                    <span>I confirmed this {tender.method === "CARD" ? "card" : "mobile-money"} amount was received.</span>
                  </label>
                </div>
              ) : null}

              {tender.method === "STORE_CREDIT" ? (
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-orange-800">First due date</span><input className="field" type="date" value={creditDueDate} onChange={(event) => onCreditDueDateChange(event.target.value)} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-orange-800">Installments</span><input className="field" type="number" min="1" max="12" value={creditInstallments} onChange={(event) => onCreditInstallmentsChange(Number(event.target.value || 1))} /></label>
                  <div className="col-span-2 rounded-lg bg-white/70 p-3 text-xs leading-5 text-orange-900">
                    {selectedCustomer ? <><strong>{selectedCustomer.name}</strong> currently owes {currency(selectedCustomer.outstandingBalance, currencyCode)}. Only the credit allocation will be added to debt.</> : customerName.trim() ? <>A new customer named <strong>{customerName.trim()}</strong> will be created. Only the credit allocation will become debt.</> : <>Choose an existing customer or enter a new customer name before using credit.</>}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {mode === "MIXED" ? (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-900 p-3 text-white">
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Allocated</p><p className="mt-1 font-black">{currency(minorToMoney(allocatedMinor), currencyCode)}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Remaining</p><p className="mt-1 font-black">{currency(minorToMoney(remainingMinor), currencyCode)}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Methods</p><p className="mt-1 font-black">{active.length}</p></div>
        </div>
      ) : null}

      {selection.error ? <p role="alert" className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs font-semibold text-orange-900">{selection.error}</p> : null}
      {selection.plan ? (
        <div role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={16} /> Payment balances exactly.</p>
          <p className="mt-1">Paid now: {currency(selection.plan.paidAmount, currencyCode)} · Credit: {currency(selection.plan.creditAmount, currencyCode)} · Change: {currency(selection.plan.changeAmount, currencyCode)}</p>
        </div>
      ) : null}
      {creditEnabled && !selectedCustomer && !customerName.trim() ? <p className="mt-3 text-xs font-semibold text-orange-800">Customer details are required for any credit allocation.</p> : null}
    </section>
  );
}
