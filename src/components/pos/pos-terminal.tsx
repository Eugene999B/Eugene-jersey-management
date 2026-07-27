"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Clock3, CreditCard, Minus, Plus, Printer, Search, ShoppingCart, Smartphone, Trash2, Wallet } from "lucide-react";
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
  customers: Array<{ id: string; name: string; phone: string | null; email: string | null }>;
  currencyCode: string;
};

export function PosTerminal({ products, customers, currencyCode }: PosTerminalProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "MOMO" | "STORE_CREDIT">("CASH");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [creditInstallments, setCreditInstallments] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [lastReceiptUrl, setLastReceiptUrl] = useState<string | null>(null);
  const checkoutKeyRef = useRef<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [personalizing, setPersonalizing] = useState<{ product: PosProduct; variant: PosVariant } | null>(null);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const filtered = products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase()) || product.variants.some((variant) => variant.sku.toLowerCase().includes(query.toLowerCase()));
    return matchesCategory && matchesQuery;
  });
  const customerMatches = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase();
    if (!needle) return customers.slice(0, 6);
    return customers.filter((customer) => [customer.name, customer.phone, customer.email].some((value) => value?.toLowerCase().includes(needle))).slice(0, 6);
  }, [customerQuery, customers]);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const total = Math.max(subtotal - discountAmount, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

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

  function showCart() {
    document.getElementById("pos-cart")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function checkout() {
    setMessage(null);
    setLastReceiptUrl(null);
    const receiptWindow = window.open("", "_blank");
    startTransition(async () => {
      checkoutKeyRef.current ??= crypto.randomUUID();
      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName || undefined,
          customerId: selectedCustomerId || undefined,
          customerPhone: customerPhone || undefined,
          customerEmail: customerEmail || undefined,
          paymentMethod,
          creditDueDate: paymentMethod === "STORE_CREDIT" ? creditDueDate || undefined : undefined,
          creditInstallments: paymentMethod === "STORE_CREDIT" ? creditInstallments : undefined,
          discountAmount,
          discountReason: discountReason || undefined,
          paymentReference: paymentReference || undefined,
          paymentConfirmed,
          idempotencyKey: checkoutKeyRef.current,
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
        receiptWindow?.close();
        setMessage(payload.error ?? "Checkout failed.");
        return;
      }

      setCart([]);
      setDiscountAmount(0);
      setDiscountReason("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCustomerQuery("");
      setSelectedCustomerId("");
      setPaymentReference("");
      setPaymentConfirmed(false);
      setCreditDueDate("");
      setCreditInstallments(1);
      checkoutKeyRef.current = null;
      setLastReceiptUrl(payload.receiptUrl);
      if (receiptWindow && payload.receiptUrl) receiptWindow.location.href = payload.receiptUrl;
      setMessage(`Sale complete. Receipt ${payload.receiptNumber} for ${currency(payload.totalAmount, currencyCode)}${receiptWindow ? " opened for printing" : " is ready to reprint"}.`);
    });
  }

  return (
    <div className="grid gap-5 pb-16 xl:grid-cols-[1fr_420px] xl:pb-0">
      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Point of Sale</h1>
              <p className="text-sm text-slate-500">Touch-friendly checkout with personalization and payment stubs.</p>
            </div>
            <Badge tone="green">{products.length} products</Badge>
          </div>
          <div className="-mx-3 mt-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setCategory(item)}
                className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${category === item ? "bg-[var(--shop-primary)] text-white" : "bg-white text-slate-600 hover:bg-[#f6f4ef]"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-lg border border-[#ded8cd] bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search product or SKU" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4 2xl:grid-cols-3">
          {filtered.map((product) => {
            const variant = product.variants[0];
            return (
              <button
                type="button"
                key={product.id}
                className="min-w-0 rounded-lg border border-[#ded8cd] bg-white p-3 text-left transition hover:border-[var(--shop-primary)] hover:shadow-md sm:min-h-40 sm:p-4"
                onClick={() => {
                  if (!variant) return;
                  if (product.isPersonalizable) setPersonalizing({ product, variant });
                  else addLine(product, variant);
                }}
              >
                {product.imageUrl ? (
                  <div
                    aria-label={product.name}
                    className="mb-2 aspect-[4/3] rounded-lg bg-cover bg-center sm:mb-3"
                    role="img"
                    style={{ backgroundImage: `url(${product.imageUrl})` }}
                  />
                ) : null}
                <div className="mb-2 flex min-w-0 items-start justify-between gap-2 sm:mb-4 sm:gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-sm font-semibold text-slate-950 sm:text-base">{product.name}</h2>
                    <p className="truncate text-xs text-slate-500 sm:text-sm">{product.category}</p>
                  </div>
                  <span className="shrink-0">{product.isService ? <Badge tone="orange">Service</Badge> : <Badge tone={variant?.stockQty ? "green" : "red"}>{variant?.stockQty ?? 0}</Badge>}</span>
                </div>
                <p className="text-base font-semibold sm:text-2xl">{currency(variant?.price ?? product.basePrice, currencyCode)}</p>
                <p className="mt-1 truncate text-xs text-slate-500 sm:mt-3 sm:text-sm">{variant?.sku ?? "No variant"}</p>
              </button>
            );
          })}
          {!filtered.length ? <p className="col-span-2 rounded-lg bg-white p-6 text-center text-sm text-slate-500 2xl:col-span-3">No products match this search.</p> : null}
        </div>
      </section>

      <aside id="pos-cart" className="panel flex scroll-mt-24 flex-col overflow-hidden xl:max-h-[calc(100vh-120px)]">
        <div className="border-b border-[#ded8cd] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Cart</h2>
            <Badge tone={itemCount ? "green" : undefined}>{itemCount} item{itemCount === 1 ? "" : "s"}</Badge>
          </div>
          <label className="mt-3 block text-xs font-semibold text-slate-600">Find existing customer
            <input className="field mt-1" aria-label="Find existing customer" placeholder="Search name, phone or email" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} />
          </label>
          {!selectedCustomerId && customerQuery ? <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-[#ded8cd] bg-white p-1">{customerMatches.map((customer) => <button key={customer.id} type="button" className="block min-h-11 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#f6f4ef]" onClick={() => { setSelectedCustomerId(customer.id); setCustomerName(customer.name); setCustomerPhone(customer.phone ?? ""); setCustomerEmail(customer.email ?? ""); setCustomerQuery(customer.name); }}><strong className="block">{customer.name}</strong><span className="text-xs text-slate-500">{customer.phone ?? customer.email ?? "No contact"}</span></button>)}{!customerMatches.length ? <p className="p-3 text-xs text-slate-500">No match. Enter a new customer below.</p> : null}</div> : null}
          {selectedCustomerId ? <button type="button" className="mt-2 min-h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs font-semibold text-emerald-800" onClick={() => { setSelectedCustomerId(""); setCustomerQuery(""); setCustomerName(""); setCustomerPhone(""); setCustomerEmail(""); }}>Existing customer selected · click to change</button> : null}
          <label className="mt-3 block text-xs font-semibold text-slate-600">Customer name
            <input className="field mt-1" placeholder="Walk-in or new customer (optional)" value={customerName} onChange={(event) => { setCustomerName(event.target.value); if (selectedCustomerId) setSelectedCustomerId(""); }} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-600">Phone<input className="field mt-1" placeholder="Phone for receipt" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label>
            <label className="text-xs font-semibold text-slate-600">Email<input className="field mt-1" type="email" placeholder="Email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></label>
          </div>
        </div>
        <div className="scrollbar-thin max-h-[55vh] space-y-3 overflow-y-auto p-3 sm:p-4 xl:max-h-none xl:flex-1">
          {cart.length ? cart.map((line) => (
            <div key={line.key} className="rounded-lg border border-[#ded8cd] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{line.productName}</p>
                  <p className="break-all text-sm text-slate-500">{line.sku}</p>
                  {line.personalName || line.personalNumber ? <p className="mt-1 text-xs text-orange-700">Print: {line.personalName} #{line.personalNumber}</p> : null}
                </div>
                <button type="button" aria-label={`Remove ${line.productName}`} onClick={() => setCart((current) => current.filter((item) => item.key !== line.key))} className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button type="button" aria-label={`Decrease ${line.productName} quantity`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-[#f6f4ef]" onClick={() => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}><Minus size={14} /></button>
                  <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                  <button type="button" aria-label={`Increase ${line.productName} quantity`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-[#f6f4ef]" onClick={() => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: item.quantity + 1 } : item))}><Plus size={14} /></button>
                </div>
                <p className="font-semibold">{currency(line.unitPrice * line.quantity, currencyCode)}</p>
              </div>
            </div>
          )) : <div className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">Tap products to build a cart.</div>}
        </div>
        <div className="space-y-3 border-t border-[#ded8cd] p-3 sm:p-4">
          <label className="block text-xs font-semibold text-slate-600">Discount amount<input className="field mt-1" type="number" min="0" step="0.01" placeholder="0.00" value={discountAmount || ""} onChange={(event) => setDiscountAmount(Number(event.target.value || 0))} /></label>
          {discountAmount > 0 ? <label className="block text-xs font-semibold text-slate-600">Discount reason<input className="field mt-1" maxLength={180} placeholder="Promotion, manager approval, damaged item..." value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} required /></label> : null}
          <div className="grid grid-cols-4 gap-2">
            {[["CASH", Wallet], ["CARD", CreditCard], ["MOMO", Smartphone], ["STORE_CREDIT", Clock3]].map(([method, Icon]) => (
              <button type="button" key={String(method)} onClick={() => { setPaymentMethod(method as "CASH" | "CARD" | "MOMO" | "STORE_CREDIT"); setPaymentReference(""); setPaymentConfirmed(false); }} className={`min-h-14 rounded-lg border px-2 py-2 text-xs font-semibold sm:py-3 sm:text-sm ${paymentMethod === method ? "border-[var(--shop-primary)] bg-[var(--shop-primary)] text-white" : "border-[#ded8cd] bg-white text-slate-700"}`}>
                <Icon className="mx-auto mb-1" size={18} />
                {method === "STORE_CREDIT" ? "CREDIT" : String(method)}
              </button>
            ))}
          </div>
          {paymentMethod === "CARD" || paymentMethod === "MOMO" ? <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3"><label className="block text-xs font-semibold text-sky-900">Terminal / network reference<input className="field mt-1" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Required reference" /></label><label className="flex items-start gap-2 text-xs font-semibold text-sky-900"><input className="mt-0.5 h-5 w-5 shrink-0" type="checkbox" checked={paymentConfirmed} onChange={(event) => setPaymentConfirmed(event.target.checked)} /><span>I confirmed that this payment was received on the card terminal or mobile-money network.</span></label></div> : null}
          {paymentMethod === "STORE_CREDIT" ? <div className="grid grid-cols-2 gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3"><label className="block"><span className="mb-1 block text-xs font-semibold text-orange-800">Credit due date</span><input className="field" type="date" value={creditDueDate} onChange={(event) => setCreditDueDate(event.target.value)} /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-orange-800">Installments</span><input className="field" type="number" min="1" max="12" value={creditInstallments} onChange={(event) => setCreditInstallments(Number(event.target.value || 1))} /></label><p className="col-span-2 text-xs text-orange-800">Credit sales require a customer name and automatically appear under Debts.</p></div> : null}
          <div className="rounded-lg bg-white p-3 text-sm"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{currency(subtotal, currencyCode)}</span></div><div className="mt-1 flex justify-between text-slate-500"><span>Discount</span><span>{currency(discountAmount, currencyCode)}</span></div><div className="mt-3 flex justify-between text-lg font-semibold"><span>Total</span><span>{currency(total, currencyCode)}</span></div></div>
          <Button className="w-full" onClick={checkout} disabled={!cart.length || isPending}><Printer size={16} />{isPending ? "Processing..." : "Complete sale & print"}</Button>
          {message ? <p className="rounded-lg bg-[#f6f4ef] p-3 text-sm text-slate-700">{message}</p> : null}
          {lastReceiptUrl ? <a className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#ded8cd] bg-white px-3 text-sm font-semibold" href={lastReceiptUrl} target="_blank" rel="noreferrer"><Printer size={16} /> Reprint receipt</a> : null}
        </div>
      </aside>

      <button type="button" onClick={showCart} className="fixed inset-x-3 bottom-[4.65rem] z-30 flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-slate-950 px-4 text-left text-white shadow-2xl xl:hidden" aria-label={`View cart with ${itemCount} items`}>
        <span className="flex min-w-0 items-center gap-3"><span className="relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-white/10"><ShoppingCart size={20} />{itemCount ? <span className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--shop-secondary)] px-1.5 text-[10px] font-bold text-slate-950">{itemCount}</span> : null}</span><span className="min-w-0"><span className="block text-xs text-white/60">{itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Cart is empty"}</span><span className="block truncate text-sm font-semibold">View cart & checkout</span></span></span>
        <strong className="shrink-0">{currency(total, currencyCode)}</strong>
      </button>

      {personalizing ? <PersonalizationModal product={personalizing.product} onClose={() => setPersonalizing(null)} onSave={(data) => { addLine(personalizing.product, personalizing.variant, data); setPersonalizing(null); }} /> : null}
    </div>
  );
}

function PersonalizationModal({ product, onClose, onSave }: { product: PosProduct; onClose: () => void; onSave: (data: Partial<CartLine>) => void }) {
  const [personalName, setPersonalName] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center sm:p-5">
      <div className="panel max-h-[90vh] w-full max-w-md overflow-y-auto p-4 sm:p-5">
        <h2 className="text-xl font-semibold">Personalize {product.name}</h2>
        <p className="mt-2 text-sm text-slate-500">Capture print details before adding it to the cart.</p>
        <div className="mt-5 space-y-3"><input className="field" placeholder="Name on item" value={personalName} onChange={(event) => setPersonalName(event.target.value)} /><input className="field" placeholder="Number" value={personalNumber} onChange={(event) => setPersonalNumber(event.target.value)} /><textarea className="field min-h-20" placeholder="Production notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
        <div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => onSave({ personalName, personalNumber, notes })}>Add to cart</Button></div>
      </div>
    </div>
  );
}
