"use client";

import { useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ProductVariantFormRow = {
  id?: string;
  size: string;
  stockQty: number;
  sku: string;
  priceOverride: string;
};

type Props = {
  initialVariants?: ProductVariantFormRow[];
  disabled?: boolean;
};

const commonSizes = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Kids XS", "Kids S", "Kids M", "Kids L", "One size"];

function defaultRow(index: number): ProductVariantFormRow & { rowKey: string } {
  return { rowKey: `new-${index}`, size: "", stockQty: 0, sku: "", priceOverride: "" };
}

export function ProductVariantFields({ initialVariants, disabled = false }: Props) {
  const datalistId = useId();
  const nextRow = useRef((initialVariants?.length ?? 0) + 1);
  const [rows, setRows] = useState<Array<ProductVariantFormRow & { rowKey: string }>>(() => {
    if (initialVariants?.length) {
      return initialVariants.map((row, index) => ({ ...row, rowKey: row.id ?? `initial-${index}` }));
    }
    return [defaultRow(0)];
  });

  const serialized = JSON.stringify(rows.map(({ rowKey: _rowKey, ...row }) => row));

  function updateRow(index: number, patch: Partial<ProductVariantFormRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function addRow() {
    const index = nextRow.current++;
    setRows((current) => current.concat(defaultRow(index)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((row, rowIndex) => rowIndex !== index || Boolean(row.id)));
  }

  return (
    <section className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 sm:p-4">
      <input type="hidden" name="variantsJson" value={serialized} />
      <datalist id={datalistId}>
        {commonSizes.map((size) => <option key={size} value={size} />)}
      </datalist>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-cyan-950">Sizes and stock</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-cyan-900/75">
            Keep one product and add each available size here. Stock is tracked separately for every size. For products without sizes, leave Size blank and use one Standard row.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addRow} disabled={disabled}>
          <Plus size={16} /> Add size
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={row.rowKey} className="rounded-xl border border-cyan-100 bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_130px_1fr_150px_auto]">
              <label className="block text-xs font-semibold text-slate-600">
                Size / option
                <input
                  className="field mt-1"
                  list={datalistId}
                  value={row.size}
                  onChange={(event) => updateRow(index, { size: event.target.value })}
                  placeholder="XL or One size"
                  maxLength={80}
                  disabled={disabled}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Quantity
                <input
                  className="field mt-1"
                  type="number"
                  min="0"
                  max="10000000"
                  value={row.stockQty}
                  onChange={(event) => updateRow(index, { stockQty: Math.max(0, Number(event.target.value || 0)) })}
                  disabled={disabled}
                  required
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                SKU <span className="font-normal text-slate-400">(optional)</span>
                <input
                  className="field mt-1"
                  value={row.sku}
                  onChange={(event) => updateRow(index, { sku: event.target.value })}
                  placeholder="Generated automatically"
                  maxLength={100}
                  disabled={disabled}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Different price <span className="font-normal text-slate-400">(optional)</span>
                <input
                  className="field mt-1"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={row.priceOverride}
                  onChange={(event) => updateRow(index, { priceOverride: event.target.value })}
                  placeholder="Use base price"
                  disabled={disabled}
                />
              </label>
              <div className="flex items-end">
                {row.id ? (
                  <span className="min-h-11 rounded-lg bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-500" title="Existing sizes remain in history. Set quantity to zero when no longer sold.">
                    Existing
                  </span>
                ) : rows.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove size row ${index + 1}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700"
                    onClick={() => removeRow(index)}
                    disabled={disabled}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </div>
            {row.id ? <p className="mt-2 text-xs text-slate-500">Set quantity to 0 to stop selling this existing size while keeping old receipts and reports accurate.</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
