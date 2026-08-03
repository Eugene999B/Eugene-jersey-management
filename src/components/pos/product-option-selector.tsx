"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/format";
import { variantOptionEntries, variantOptionLabel } from "@/lib/catalog-options";

export type SelectablePosVariant = {
  id: string;
  sku: string;
  stockQty: number;
  price: number;
  attributes: Record<string, unknown>;
};

export type SelectablePosProduct = {
  id: string;
  name: string;
  itemType: string;
  isService: boolean;
  variants: SelectablePosVariant[];
};

type Props = {
  product: SelectablePosProduct;
  currencyCode: string;
  onClose: () => void;
  onConfirm: (variant: SelectablePosVariant) => void;
};

export function ProductOptionSelector({ product, currencyCode, onClose, onConfirm }: Props) {
  const available = useMemo(
    () => product.variants.filter((variant) => product.isService || variant.stockQty > 0),
    [product],
  );
  const [selectedId, setSelectedId] = useState(available.length === 1 ? available[0].id : "");
  const selected = product.variants.find((variant) => variant.id === selectedId) ?? null;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Close option selector backdrop"
        className="absolute inset-0 bg-slate-950/60"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="option-selector-title"
        className="panel relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Exact option required</p>
            <h2 id="option-selector-title" className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
              Choose {product.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Select the exact available combination. ESM will not silently use the first option.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close option selector"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={`Options for ${product.name}`}>
          {product.variants.map((variant) => {
            const isAvailable = product.isService || variant.stockQty > 0;
            const isSelected = selectedId === variant.id;
            const details = variantOptionEntries(variant.attributes);
            return (
              <label
                key={variant.id}
                className={`relative min-h-32 rounded-2xl border-2 p-4 text-left transition ${isSelected ? "border-cyan-600 bg-cyan-50 shadow-md" : isAvailable ? "cursor-pointer border-slate-200 bg-white hover:border-cyan-300" : "cursor-not-allowed border-slate-100 bg-slate-100 opacity-65"}`}
              >
                <input
                  type="radio"
                  name={`product-option-${product.id}`}
                  value={variant.id}
                  checked={isSelected}
                  disabled={!isAvailable}
                  onChange={() => setSelectedId(variant.id)}
                  className="sr-only"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-950">{variantOptionLabel(variant.attributes)}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{variant.sku}</p>
                  </div>
                  {isSelected ? (
                    <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-cyan-700 px-3 text-xs font-black text-white">
                      <Check size={14} /> Selected
                    </span>
                  ) : (
                    <Badge tone={isAvailable ? "green" : "red"}>
                      {isAvailable ? product.isService ? "Available" : `${variant.stockQty} left` : "Unavailable"}
                    </Badge>
                  )}
                </div>
                {details.length ? (
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {details.map(([label, value]) => (
                      <div key={`${label}-${value}`} className="contents">
                        <dt className="truncate text-slate-500">{label}</dt>
                        <dd className="truncate font-semibold text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <p className="mt-3 text-lg font-black text-slate-950">{currency(variant.price, currencyCode)}</p>
              </label>
            );
          })}
        </div>

        {!available.length ? (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            Every option is currently unavailable. Update stock before selling this item.
          </div>
        ) : null}
        {selected ? (
          <div role="status" className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-cyan-700">Selected option</p>
            <p className="mt-1 font-black text-cyan-950">
              {variantOptionLabel(selected.attributes)} · {currency(selected.price, currencyCode)}
            </p>
            <button type="button" className="mt-2 text-xs font-bold text-cyan-800 underline" onClick={() => setSelectedId("")}>
              Change selection
            </button>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!selected} onClick={() => { if (selected) onConfirm(selected); }}>Add selected option</Button>
        </div>
      </section>
    </div>
  );
}
