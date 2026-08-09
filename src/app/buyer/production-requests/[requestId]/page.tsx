import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, ImageUp, PackageCheck, Shirt } from "lucide-react";
import { CustomerProductionRequestStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { getBuyerSession } from "@/lib/buyer-session";
import { customerProductionBalance, paidOrderAmount } from "@/lib/customer-production";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import {
  approveCustomerProductionPreviewAction,
  attachCustomerProductionArtworkAction,
  requestCustomerProductionChangesAction,
} from "./actions";

function record(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function dateTime(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value) : "—";
}

function statusTone(status: CustomerProductionRequestStatus): "green" | "red" | "orange" | "blue" | "slate" {
  if ([CustomerProductionRequestStatus.COMPLETED, CustomerProductionRequestStatus.READY].includes(status)) return "green";
  if (status === CustomerProductionRequestStatus.CANCELLED) return "red";
  if ([CustomerProductionRequestStatus.CHANGES_REQUESTED, CustomerProductionRequestStatus.SUBMITTED].includes(status)) return "orange";
  if ([CustomerProductionRequestStatus.APPROVED, CustomerProductionRequestStatus.DEPOSIT_PAID, CustomerProductionRequestStatus.IN_PRODUCTION].includes(status)) return "blue";
  return "slate";
}

export default async function BuyerProductionRequestPage({ params, searchParams }: { params: Promise<{ requestId: string }>; searchParams?: Promise<Record<string, string | undefined>> }) {
  const { requestId } = await params;
  const query = await searchParams;
  const buyer = await getBuyerSession();
  if (!buyer) return <main className="min-h-screen bg-[#f6f4ef] p-5"><div className="mx-auto max-w-3xl rounded-xl bg-white p-5"><h1 className="text-xl font-bold">Login required</h1><Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white" href={`/buyer/login?next=${encodeURIComponent(`/buyer/production-requests/${requestId}`)}`}>Login to view request</Link></div></main>;

  const productionRequest = await prisma.customerProductionRequest.findFirst({ where: { id: requestId, buyerId: buyer.id } });
  if (!productionRequest) return <main className="min-h-screen bg-[#f6f4ef] p-5"><div className="mx-auto max-w-3xl rounded-xl bg-white p-5"><h1 className="text-xl font-bold">Request not found</h1><Link className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#ded8cd] bg-white px-4 text-sm font-semibold" href="/shops">Browse marketplace</Link></div></main>;
  const [shop, assets, events, order] = await Promise.all([
    prisma.shop.findUnique({ where: { id: productionRequest.shopId } }),
    prisma.customerProductionAsset.findMany({ where: { shopId: productionRequest.shopId, requestId: productionRequest.id, buyerId: buyer.id }, select: { id: true, originalName: true, mimeType: true, byteLength: true, sha256: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.customerProductionEvent.findMany({ where: { shopId: productionRequest.shopId, requestId: productionRequest.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    productionRequest.orderId ? prisma.order.findFirst({ where: { id: productionRequest.orderId, buyerId: buyer.id }, include: { payments: true } }) : null,
  ]);
  if (!shop) return null;

  const garment = record(productionRequest.garmentSnapshot);
  const placement = record(productionRequest.placementSnapshot);
  const product = record(productionRequest.productSnapshot);
  const paidAmount = order ? paidOrderAmount(order.payments) : 0;
  const amounts = productionRequest.quotedTotal !== null && productionRequest.depositAmount !== null
    ? customerProductionBalance({ quotedTotal: Number(productionRequest.quotedTotal), depositAmount: Number(productionRequest.depositAmount), paidAmount })
    : null;
  const previewSrc = productionRequest.previewSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(productionRequest.previewSvg)}` : null;
  const canApprove = productionRequest.status === CustomerProductionRequestStatus.PREVIEW_READY && productionRequest.quotedTotal !== null;
  const canAttach = ![CustomerProductionRequestStatus.COMPLETED, CustomerProductionRequestStatus.CANCELLED].includes(productionRequest.status) && assets.length < 6;
  const canPayDeposit = Boolean(order && amounts && amounts.depositDue > 0.005 && productionRequest.status !== CustomerProductionRequestStatus.CANCELLED);
  const canPayBalance = Boolean(order && amounts && amounts.depositSatisfied && amounts.balanceDue > 0.005 && productionRequest.status !== CustomerProductionRequestStatus.CANCELLED);

  return (
    <main className="min-h-screen bg-[#f6f4ef]">
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-5 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-cyan-700">{shop.name} · custom production</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">{productionRequest.title}</h1><p className="mt-2 text-sm text-slate-600">Submitted {dateTime(productionRequest.createdAt)}</p></div><div className="flex flex-wrap gap-2"><Badge tone={statusTone(productionRequest.status)}>{titleCase(productionRequest.status)}</Badge><Link href={`/shop/${shop.slug}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#ded8cd] bg-white px-3 text-sm font-semibold"><ArrowLeft size={15} /> Shop</Link></div></div>

        {query?.approved ? <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Preview approved. Your order is created; the deposit can now be paid.</p> : null}
        {query?.payment === "success" ? <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Verified payment received and added to this order.</p> : null}
        {query?.error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">This action could not be completed. Refresh the request and try again.</p> : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-[#ded8cd] bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2"><Shirt size={19} className="text-cyan-700" /><h2 className="text-lg font-bold">Your requested production</h2></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Product</p><p className="mt-1 font-semibold">{text(product.productName, "Custom product")}</p><p className="text-xs text-slate-500">{text(product.sku)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Garment</p><p className="mt-1 font-semibold">{text(garment.name, "Garment")} · {productionRequest.garmentSize}</p><p className="text-xs text-slate-500">{[text(garment.colour), text(garment.fabric)].filter(Boolean).join(" · ")}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Placement</p><p className="mt-1 font-semibold">{text(placement.name, "Placement")}</p><p className="text-xs text-slate-500">{titleCase(text(placement.location, "custom"))}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Personalization</p><p className="mt-1 font-semibold">{productionRequest.requestedText || "No text"}{productionRequest.requestedNumber ? ` · #${productionRequest.requestedNumber}` : ""}</p><p className="text-xs text-slate-500">{productionRequest.fulfillmentType === "DELIVERY" ? `Delivery · ${productionRequest.deliveryArea || productionRequest.deliveryCity || productionRequest.deliveryAddress}` : "Collection"}</p></div></div>
              {productionRequest.requestNotes ? <p className="mt-3 rounded-xl border border-[#ded8cd] p-3 text-sm leading-6 text-slate-700">{productionRequest.requestNotes}</p> : null}
            </section>

            <section className="rounded-2xl border border-[#ded8cd] bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">Preview & approval</h2><p className="mt-1 text-sm text-slate-600">The shop must send a preview and final quote before any approval or deposit.</p></div>{productionRequest.previewVersion ? <Badge tone="blue">Preview v{productionRequest.previewVersion}</Badge> : null}</div>
              {previewSrc ? <div className="mt-4 overflow-hidden rounded-xl border border-[#ded8cd] bg-slate-50"><img className="mx-auto max-h-[620px] w-full object-contain" src={previewSrc} alt={`Concept preview version ${productionRequest.previewVersion}`} /></div> : <div className="mt-4 rounded-xl border border-dashed border-[#ded8cd] bg-slate-50 p-6 text-center text-sm text-slate-500"><Clock3 className="mx-auto mb-2" size={22} />The shop is preparing your preview and quote.</div>}
              {productionRequest.previewNote ? <p className="mt-3 rounded-xl bg-cyan-50 p-3 text-sm text-cyan-950">{productionRequest.previewNote}</p> : null}
              {canApprove ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><form action={approveCustomerProductionPreviewAction}><input type="hidden" name="requestId" value={productionRequest.id} /><button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white" type="submit"><CheckCircle2 size={17} /> Approve preview & create order</button></form><form action={requestCustomerProductionChangesAction} className="space-y-2"><input type="hidden" name="requestId" value={productionRequest.id} /><textarea className="field min-h-20" name="note" minLength={3} maxLength={1200} required placeholder="Describe the changes you need" /><button className="min-h-11 w-full rounded-xl border border-orange-300 bg-orange-50 px-4 text-sm font-semibold text-orange-900" type="submit">Request changes</button></form></div> : null}
            </section>

            <section className="rounded-2xl border border-[#ded8cd] bg-white p-4 sm:p-5"><div className="flex items-center gap-2"><ImageUp size={18} className="text-cyan-700" /><h2 className="text-lg font-bold">Artwork references</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{assets.map((asset) => <figure key={asset.id} className="overflow-hidden rounded-xl border border-[#ded8cd] bg-slate-50"><img className="aspect-square w-full object-contain" src={`/api/customer-production-assets/${encodeURIComponent(asset.id)}?access=${encodeURIComponent(productionRequest.publicAccessToken)}`} alt={`Customer artwork ${asset.originalName}`} /><figcaption className="border-t border-[#ded8cd] p-2 text-xs text-slate-600"><p className="truncate font-semibold">{asset.originalName}</p><p>{Math.ceil(asset.byteLength / 1024)} KB</p></figcaption></figure>)}{!assets.length ? <p className="text-sm text-slate-500">No artwork uploaded yet. Text-only requests are allowed.</p> : null}</div>{canAttach ? <form action={attachCustomerProductionArtworkAction} className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-cyan-300 bg-cyan-50 p-3 sm:flex-row sm:items-end"><input type="hidden" name="requestId" value={productionRequest.id} /><label className="flex-1 text-sm font-semibold">Attach another artwork file<input className="mt-1 block w-full text-sm" type="file" name="artwork" accept="image/jpeg,image/png,image/webp" required /></label><button className="min-h-11 rounded-xl bg-cyan-800 px-4 text-sm font-semibold text-white" type="submit">Attach artwork</button></form> : null}</section>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl border border-[#ded8cd] bg-white p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><CreditCard size={18} /> Quote & payments</h2>{amounts ? <><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase text-slate-500">Quoted total</p><p className="font-black">{currency(amounts.quotedTotal, shop.currency)}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs uppercase text-emerald-700">Paid</p><p className="font-black">{currency(amounts.paidAmount, shop.currency)}</p></div><div className="rounded-xl bg-cyan-50 p-3"><p className="text-xs uppercase text-cyan-700">Deposit target</p><p className="font-black">{currency(amounts.depositAmount, shop.currency)}</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs uppercase text-orange-700">Balance due</p><p className="font-black">{currency(amounts.balanceDue, shop.currency)}</p></div></div>{order ? <p className="mt-3 text-xs text-slate-500">Order {order.receiptNumber} · {titleCase(order.status)} · payments are provider-verified before they count as paid.</p> : <p className="mt-3 text-xs text-slate-500">Approve the preview to create the order and unlock payment.</p>}{canPayDeposit ? <form className="mt-4" action={`/api/customer-production-requests/${productionRequest.id}/payment`} method="post"><input type="hidden" name="stage" value="DEPOSIT" /><button className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-bold text-white" type="submit">Pay deposit · {currency(amounts.depositDue, shop.currency)}</button></form> : null}{canPayBalance ? <form className="mt-3" action={`/api/customer-production-requests/${productionRequest.id}/payment`} method="post"><input type="hidden" name="stage" value="BALANCE" /><button className="min-h-12 w-full rounded-xl bg-[var(--shop-primary,#0f766e)] px-4 text-sm font-bold text-white" type="submit">Pay remaining balance · {currency(amounts.balanceDue, shop.currency)}</button></form> : null}{amounts.fullyPaid ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Fully paid</p> : null}</> : <p className="mt-3 text-sm text-slate-500">The shop has not issued the final quote yet.</p>}</section>

            <section className="rounded-2xl border border-[#ded8cd] bg-white p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><PackageCheck size={18} /> Production tracking</h2><div className="mt-4 space-y-2"><div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Request submitted</span><strong>{dateTime(productionRequest.createdAt)}</strong></div><div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Preview approved</span><strong>{dateTime(productionRequest.approvedAt)}</strong></div><div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Deposit received</span><strong>{dateTime(productionRequest.depositPaidAt)}</strong></div><div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Production started</span><strong>{dateTime(productionRequest.productionStartedAt)}</strong></div><div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Ready / completed</span><strong>{dateTime(productionRequest.completedAt ?? productionRequest.readyAt)}</strong></div></div>{productionRequest.status === CustomerProductionRequestStatus.READY ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Your custom production is ready. Pay any remaining balance and follow the shop’s collection/delivery instructions.</p> : null}{productionRequest.status === CustomerProductionRequestStatus.COMPLETED ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Completed. Thank you for your order.</p> : null}</section>

            <section className="rounded-2xl border border-[#ded8cd] bg-white p-4 sm:p-5"><h2 className="text-lg font-bold">Activity</h2><div className="mt-3 space-y-3">{events.map((event) => <div key={event.id} className="border-l-2 border-cyan-300 pl-3 text-sm"><p className="font-semibold">{titleCase(event.type)}</p><p className="mt-0.5 text-slate-600">{event.note ?? "Status updated"}</p><p className="mt-1 text-xs text-slate-400">{dateTime(event.createdAt)}</p></div>)}</div></section>
          </div>
        </div>
      </div>
    </main>
  );
}
