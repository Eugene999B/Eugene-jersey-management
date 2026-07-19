"use client";

import { useMemo, useState, useTransition } from "react";
import { CreditCard, Minus, Plus, Printer, Search, Smartphone, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/format";

type PosVariant = {
  id: string;
  sku: string;
  stockQty: number;
  price: number;
  attributes: Record<string, unknown>;
};

type PosProduct = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  imageUrl: string | null;
  isPersonalizable: boolean;
  isService: boolean;
  basePrice: number;
  variants: PosVariant[];
};

type CartLine = {
  key: string;
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  personalName?: string;
  personalNumber?: string;
  notes?: string;
};

type PosTerminalProps = {
  products: PosProduct[];
  currencyCode: string;
};

export function PosTerminal({ products, currencyCode }: PosTerminalProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "MOMO">("CASH");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [personalizing, setPersonalizing] = useState<{ product: PosProduct; variant: PosVariant } | null>(null);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const filtered = products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase()) || product.variants.some((variant) => variant.sku.toLowerCase().includes(query.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const total = Math.max(subtotal - discountAmount, 0);

  function addLine(product: PosProduct, variant: PosVariant, personalization?: Partial<CartLine>) {
    const key = `${variant.id}-${personalization?.personalName ?? ""}-${personalization?.personalNumber ?? ""}-${personalization?.notes ?? ""}`;
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) => line.key === key ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return current.concat({
        key,
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        sku: variant.sku,
        quantity: 1,
        unitPrice: variant.price,
        ...personalization,
      });
    });
  }

  function checkout() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          customerEmail: customerEmail || undefined,
          paymentMethod,
          discountAmount,
          items: cart.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
            personalizationData: line.personalName || line.personalNumber || line.notes
              ? { name: line.personalName ?? "", number: line.personalNumber ?? "", notes: line.notes ?? "" }
              : undefined,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Checkout failed.");
        return;
      }

      setCart([]);
      setDiscountAmount(0);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setMessage(`Sale complete. Receipt ${payload.receiptNumber} for ${currency(payload.totalAmount, currencyCode)}.`);
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Point of Sale</h1>
              <p className="text-sm text-slate-500">Touch-friendly checkout with personalization and payment stubs.</p>
            </div>
            <Badge tone="green">{products.length} products</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`rounded-[8px] px-3 py-2 text-sm font-semibold transition ${category === item ? "bg-[var(--shop-primary)] text-white" : "bg-white text-slate-600 hover:bg-[#f6f4ef]"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input className="min-h-11 flex-1 bg-transparent text-sm outline-none" placeholder="Search product or SKU" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((product) => {
            const variant = product.variants[0];
            return (
              <button
                key={product.id}
                className="min-h-40 rounded-[8px] border border-[#ded8cd] bg-white p-4 text-left transition hover:border-[var(--shop-primary)] hover:shadow-md"
                onClick={() => {
                  if (!variant) return;
                  if (product.isPersonalizable) setPersonalizing({ product, variant });
                  else addLine(product, variant);
                }}
              >
                {product.imageUrl ? (
                  <div
                    aria-label={product.name}
                    className="mb-3 aspect-[4/3] rounded-[8px] bg-cover bg-center"
                    role="img"
                    style={{ backgroundImage: `url(${product.imageUrl})` }}
                  />
                ) : null}
                <div className="mb-4 flex justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-950">{product.name}</h2>
                    <p className="text-sm text-slate-500">{product.category}</p>
                  </div>
                  {product.isService ? <Badge tone="orange">Service</Badge> : <Badge tone={variant?.stockQty ? "green" : "red"}>{variant?.stockQty ?? 0}</Badge>}
                </div>
                <p className="text-2xl font-semibold">{currency(variant?.price ?? product.basePrice, currencyCode)}</p>
                <p className="mt-3 text-sm text-slate-500">{variant?.sku ?? "No variant"}</p>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="panel flex max-h-[calc(100vh-120px)] flex-col overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4">
          <h2 className="text-lg font-semibold">Cart</h2>
          <input className="field mt-3" placeholder="Customer name (optional)" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input className="field" placeholder="Phone for receipt" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            <input className="field" type="email" placeholder="Email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
          </div>
        </div>
        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
          {cart.length ? cart.map((line) => (
            <div key={line.key} className="rounded-[8px] border border-[#ded8cd] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{line.productName}</p>
                  <p className="text-sm text-slate-500">{line.sku}</p>
                  {line.personalName || line.personalNumber ? (
                    <p className="mt-1 text-xs text-orange-700">Print: {line.personalName} #{line.personalNumber}</p>
                  ) : null}
                </div>
                <button onClick={() => setCart((current) => current.filter((item) => item.key !== line.key))} className="rounded-[8px] p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button className="rounded-[8px] bg-[#f6f4ef] p-2" onClick={() => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}><Minus size={14} /></button>
                  <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                  <button className="rounded-[8px] bg-[#f6f4ef] p-2" onClick={() => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: item.quantity + 1 } : item))}><Plus size={14} /></button>
                </div>
                <p className="font-semibold">{currency(line.unitPrice * line.quantity, currencyCode)}</p>
              </div>
            </div>
          )) : (
            <div className="rounded-[8px] bg-white p-6 text-center text-sm text-slate-500">Tap products to build a cart.</div>
          )}
        </div>
        <div className="space-y-3 border-t border-[#ded8cd] p-4">
          <input className="field" type="number" min="0" step="0.01" placeholder="Discount amount" value={discountAmount || ""} onChange={(event) => setDiscountAmount(Number(event.target.value || 0))} />
          <div className="grid grid-cols-3 gap-2">
            {[
              ["CASH", Wallet],
              ["CARD", CreditCard],
              ["MOMO", Smartphone],
            ].map(([method, Icon]) => (
              <button
                key={String(method)}
                onClick={() => setPaymentMethod(method as "CASH" | "CARD" | "MOMO")}
                className={`rounded-[8px] border px-2 py-3 text-sm font-semibold ${paymentMethod === method ? "border-[var(--shop-primary)] bg-[var(--shop-primary)] text-white" : "border-[#ded8cd] bg-white text-slate-700"}`}
              >
                <Icon className="mx-auto mb-1" size={18} />
                {String(method)}
              </button>
            ))}
          </div>
          <div className="rounded-[8px] bg-white p-3 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{currency(subtotal, currencyCode)}</span></div>
            <div className="mt-1 flex justify-between text-slate-500"><span>Discount</span><span>{currency(discountAmount, currencyCode)}</span></div>
            <div className="mt-3 flex justify-between text-lg font-semibold"><span>Total</span><span>{currency(total, currencyCode)}</span></div>
          </div>
          <Button className="w-full" onClick={checkout} disabled={!cart.length || isPending}>
            <Printer size={16} />
            {isPending ? "Processing..." : "Complete sale"}
          </Button>
          {message ? <p className="rounded-[8px] bg-[#f6f4ef] p-3 text-sm text-slate-700">{message}</p> : null}
        </div>
      </aside>

      {personalizing ? (
        <PersonalizationModal
          product={personalizing.product}
          onClose={() => setPersonalizing(null)}
          onSave={(data) => {
            addLine(personalizing.product, personalizing.variant, data);
            setPersonalizing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PersonalizationModal({
  product,
  onClose,
  onSave,
}: {
  product: PosProduct;
  onClose: () => void;
  onSave: (data: Partial<CartLine>) => void;
}) {
  const [personalName, setPersonalName] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-5">
      <div className="panel w-full max-w-md p-5">
        <h2 className="text-xl font-semibold">Personalize {product.name}</h2>
        <p className="mt-2 text-sm text-slate-500">Capture print details before adding it to the cart.</p>
        <div className="mt-5 space-y-3">
          <input className="field" placeholder="Name on item" value={personalName} onChange={(event) => setPersonalName(event.target.value)} />
          <input className="field" placeholder="Number" value={personalNumber} onChange={(event) => setPersonalNumber(event.target.value)} />
          <textarea className="field min-h-20" placeholder="Production notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ personalName, personalNumber, notes })}>Add to cart</Button>
        </div>
      </div>
    </div>
  );
}
