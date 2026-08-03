"use client";

import { useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VARIANT_OPTION_FIELDS, variantOptionsFromRow } from "@/lib/catalog-options";

export type ProductVariantFormRow = {
  id?: string;
  size: string;
  color: string;
  material: string;
  model: string;
  capacity: string;
  unit: string;
  condition: string;
  duration: string;
  customAttributes: string;
  stockQty: number;
  sku: string;
  priceOverride: string;
};

type Props = {
  initialVariants?: ProductVariantFormRow[];
  disabled?: boolean;
};

const commonValues: Record<string, string[]> = {
  size: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Kids S", "Kids M", "Kids L", "One size", "Standard"],
  unit: ["Piece", "Pair", "Box", "Pack", "Metre", "Kilogram", "Litre", "Hour", "Day"],
  condition: ["New", "Used", "Refurbished", "Damaged"],
};

function defaultRow(index: number): ProductVariantFormRow & { rowKey: string } {
  return {
    rowKey: `new-${index}`,
    size: "",
    color: "",
    material: "",
    model: "",
    capacity: "",
    unit: "",
    condition: "",
    duration: "",
    customAttributes: "",
    stockQty: 0,
    sku: "",
    priceOverride: "",
  };
}

function optionSummary(row: ProductVariantFormRow) {
  const values = variantOptionsFromRow(row);
  const visible = Object.entries(values).map(([key, value]) => `${key.replace(/^custom_/, "").replaceAll("_", " ")}: ${value}`);
  return visible.length ? visible.join(" · ") : "Standard option";
}

export function ProductVariantFields({ initialVariants, disabled = false }: Props) {
  const idPrefix = useId().replaceAll(":", "");
  const nextRow = useRef((initialVariants?.length ?? 0) + 1);
  const [rows, setRows] = useState<Array<ProductVariantFormRow & { rowKey: string }>>(() => {
    if (initialVariants?.length) return initialVariants.map((row, index) => ({ ...row, rowKey: row.id ?? `initial-${index}` }));
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
      {Object.entries(commonValues).map(([key, values]) => (
        <datalist key={key} id={`${idPrefix}-${key}`}>{values.map((value) => <option key={value} value={value} />)}</datalist>
      ))}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-cyan-950">Exact options, stock and price</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-cyan-900/75">
            Add every sellable combination separately. Size, colour, material, model, capacity, unit, condition and duration are optional, but two rows cannot describe the same combination. The operator must choose the exact available option before sale.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addRow} disabled={disabled}>
          <Plus size={16} /> Add option
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <details key={row.rowKey} open={rows.length === 1 || !row.id} className="rounded-xl border border-cyan-100 bg-white p-3">
            <summary className="cursor-pointer list-none">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <div className="min-w-0"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Option {index + 1}</span><p className="mt-1 truncate text-sm font-semibold text-slate-900">{optionSummary(row)}</p></div>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{row.stockQty} available</span>
              </div>
            </summary>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {VARIANT_OPTION_FIELDS.map((field) => (
                <label key={field.key} className="block text-xs font-semibold text-slate-600">
                  {field.label} <span className="font-normal text-slate-400">(optional)</span>
                  <input
                    className="field mt-1"
                    list={commonValues[field.key] ? `${idPrefix}-${field.key}` : undefined}
                    value={row[field.key]}
                    onChange={(event) => updateRow(index, { [field.key]: event.target.value })}
                    placeholder={field.placeholder}
                    maxLength={120}
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>

            <label className="mt-3 block text-xs font-semibold text-slate-600">
              Custom attributes <span className="font-normal text-slate-400">(optional)</span>
              <input
                className="field mt-1"
                value={row.customAttributes}
                onChange={(event) => updateRow(index, { customAttributes: event.target.value })}
                placeholder="Voltage: 240V; Grade: Premium"
                maxLength={1200}
                disabled={disabled}
              />
              <span className="mt-1 block font-normal text-slate-500">Use “Name: Value” pairs separated by semicolons.</span>
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[130px_1fr_170px_auto]">
              <label className="block text-xs font-semibold text-slate-600">
                Quantity
                <input className="field mt-1" type="number" min="0" max="10000000" value={row.stockQty} onChange={(event) => updateRow(index, { stockQty: Math.max(0, Number(event.target.value || 0)) })} disabled={disabled} required />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                SKU <span className="font-normal text-slate-400">(optional)</span>
                <input className="field mt-1" value={row.sku} onChange={(event) => updateRow(index, { sku: event.target.value })} placeholder="Generated automatically" maxLength={100} disabled={disabled} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Different price <span className="font-normal text-slate-400">(optional)</span>
                <input className="field mt-1" type="number" min="0.01" step="0.01" value={row.priceOverride} onChange={(event) => updateRow(index, { priceOverride: event.target.value })} placeholder="Use base price" disabled={disabled} />
              </label>
              <div className="flex items-end">
                {row.id ? <span className="min-h-11 rounded-lg bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-500" title="Existing options remain in history. Set quantity to zero when unavailable.">Existing</span> : rows.length > 1 ? <button type="button" aria-label={`Remove option row ${index + 1}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700" onClick={() => removeRow(index)} disabled={disabled}><Trash2 size={16} /></button> : null}
              </div>
            </div>
            {row.id ? <p className="mt-2 text-xs text-slate-500">Set quantity to 0 to make this option unavailable while keeping historical orders and receipts accurate.</p> : null}
          </details>
        ))}
      </div>
    </section>
  );
}
