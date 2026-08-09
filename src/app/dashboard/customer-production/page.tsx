import { CheckCircle2, Clock3, ImageIcon, PackageCheck, Play, Shirt, Sparkles } from "lucide-react";
import { CustomerProductionRequestStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { customerProductionBalance, paidOrderAmount } from "@/lib/customer-production";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { advanceCustomerProductionAction, quoteCustomerProductionRequestAction } from "./actions";

function record(value: unknown) { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function dateTime(value: Date | null | undefined) { return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value) : "—"; }

function tone(status: CustomerProductionRequestStatus): "green" | "red" | "orange" | "blue" | "slate" {
  if ([CustomerProductionRequestStatus.COMPLETED, CustomerProductionRequestStatus.READY].includes(status)) return "green";
  if (status === CustomerProductionRequestStatus.CANCELLED) return "red";
  if ([CustomerProductionRequestStatus.SUBMITTED, CustomerProductionRequestStatus.CHANGES_REQUESTED].includes(status)) return "orange";
  if ([CustomerProductionRequestStatus.APPROVED, CustomerProductionRequestStatus.DEPOSIT_PAID, CustomerProductionRequestStatus.IN_PRODUCTION].includes(status)) return "blue";
  return "slate";
}

export default async function CustomerProductionDashboard({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  await requireRole(permissions.orders);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const query = await searchParams;
  const requests = await prisma.customerProductionRequest.findMany({ where: { shopId: shop.id }, orderBy: { updatedAt: "desc" }, take: 150 });
  const buyerIds = [...new Set(requests.map((request) => request.buyerId))];
  const orderIds = [...new Set(requests.flatMap((request) => request.orderId ? [request.orderId] : []))];
  const [buyers, assets, orders] = await Promise.all([
    buyerIds.length ? prisma.buyerAccount.findMany({ where: { id: { in: buyerIds } }, select: { id: true, name: true, phone: true, email: true } }) : [],
    requests.length ? prisma.customerProductionAsset.findMany({ where: { shopId: shop.id, requestId: { in: requests.map((request) => request.id) } }, select: { id: true, requestId: true, originalName: true, byteLength: true, createdAt: true }, orderBy: { createdAt: "asc" } }) : [],
    orderIds.length ? prisma.order.findMany({ where: { shopId: shop.id, id: { in: orderIds } }, include: { payments: true } }) : [],
  ]);
  const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer]));
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const assetMap = new Map<string, typeof assets>();
  for (const asset of assets) assetMap.set(asset.requestId, [...(assetMap.get(asset.requestId) ?? []), asset]);
  const waiting = requests.filter((request) => [CustomerProductionRequestStatus.SUBMITTED, CustomerProductionRequestStatus.CHANGES_REQUESTED].includes(request.status)).length;
  const awaitingApproval = requests.filter((request) => request.status === CustomerProductionRequestStatus.PREVIEW_READY).length;
  const active = requests.filter((request) => [CustomerProductionRequestStatus.APPROVED, CustomerProductionRequestStatus.DEPOSIT_PAID, CustomerProductionRequestStatus.IN_PRODUCTION, CustomerProductionRequestStatus.READY].includes(request.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Customers and online approvals" title="Custom production requests" description="Review customer artwork, issue a quoted concept preview, wait for explicit approval and verified deposit, then move the linked order through production, ready and completion." actions={<><LinkButton href="/dashboard/orders" variant="outline"><PackageCheck size={16} /> Orders</LinkButton><LinkButton href="/dashboard/designs" variant="outline"><Shirt size={16} /> Design Studio</LinkButton><LinkButton href="/dashboard/production-stock" variant="outline">Stock & costing</LinkButton></>} />
      {query?.error ? <FeedbackState state="error" title="Request action could not be completed" description="The request changed, a payment milestone is missing, or the submitted quote/stage is invalid. Refresh this queue and use the current request state." /> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">All requests</p><p className="mt-1 text-2xl font-black">{requests.length}</p></div><div className="panel p-4"><p className="text-xs font-bold uppercase text-orange-600">Needs shop action</p><p className="mt-1 text-2xl font-black">{waiting}</p></div><div className="panel p-4"><p className="text-xs font-bold uppercase text-cyan-700">Awaiting buyer approval</p><p className="mt-1 text-2xl font-black">{awaitingApproval}</p></div><div className="panel p-4"><p className="text-xs font-bold uppercase text-emerald-700">Approved / active</p><p className="mt-1 text-2xl font-black">{active}</p></div></div>

      <div className="space-y-4">
        {requests.map((request) => {
          const buyer = buyerMap.get(request.buyerId);
          const order = request.orderId ? orderMap.get(request.orderId) : null;
          const paid = order ? paidOrderAmount(order.payments) : 0;
          const amounts = request.quotedTotal !== null && request.depositAmount !== null ? customerProductionBalance({ quotedTotal: Number(request.quotedTotal), depositAmount: Number(request.depositAmount), paidAmount: paid }) : null;
          const garment = record(request.garmentSnapshot);
          const placement = record(request.placementSnapshot);
          const requestAssets = assetMap.get(request.id) ?? [];
          const canQuote = [CustomerProductionRequestStatus.SUBMITTED, CustomerProductionRequestStatus.QUOTED, CustomerProductionRequestStatus.PREVIEW_READY, CustomerProductionRequestStatus.CHANGES_REQUESTED].includes(request.status);
          return <article key={request.id} className="panel overflow-hidden">
            <div className="border-b border-[#ded8cd] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{request.title}</h2><Badge tone={tone(request.status)}>{titleCase(request.status)}</Badge></div><p className="mt-1 text-sm text-slate-500">{buyer?.name ?? "Buyer"} · {buyer?.phone ?? "No phone"} · submitted {dateTime(request.createdAt)}</p></div>{order ? <a className="inline-flex min-h-10 items-center rounded-xl border border-[#ded8cd] bg-white px-3 text-sm font-semibold" href={`/dashboard/orders/${encodeURIComponent(order.id)}`}>{order.receiptNumber}</a> : null}</div></div>
            <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Garment</p><p className="font-semibold">{text(garment.name, "Garment")} · {request.garmentSize}</p><p className="text-xs text-slate-500">{text(garment.colour)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Placement</p><p className="font-semibold">{text(placement.name, "Placement")}</p><p className="text-xs text-slate-500">{titleCase(text(placement.location, "custom"))}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Text / number</p><p className="font-semibold">{request.requestedText || "No text"}{request.requestedNumber ? ` · #${request.requestedNumber}` : ""}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Fulfilment</p><p className="font-semibold">{titleCase(request.fulfillmentType)}</p><p className="text-xs text-slate-500">{request.deliveryArea || request.deliveryCity || request.deliveryAddress || "Collection at shop"}</p></div></div>{request.requestNotes ? <p className="rounded-xl border border-[#ded8cd] p-3 text-sm leading-6">{request.requestNotes}</p> : null}<div><p className="mb-2 flex items-center gap-2 text-sm font-bold"><ImageIcon size={16} /> Customer artwork</p><div className="grid grid-cols-2 gap-2">{requestAssets.map((asset) => <a key={asset.id} target="_blank" rel="noreferrer" href={`/api/customer-production-assets/${encodeURIComponent(asset.id)}?access=${encodeURIComponent(request.publicAccessToken)}`} className="overflow-hidden rounded-xl border border-[#ded8cd] bg-slate-50"><img className="aspect-square w-full object-contain" src={`/api/customer-production-assets/${encodeURIComponent(asset.id)}?access=${encodeURIComponent(request.publicAccessToken)}`} alt={asset.originalName} /><span className="block truncate border-t border-[#ded8cd] p-2 text-xs font-semibold">{asset.originalName}</span></a>)}{!requestAssets.length ? <p className="col-span-2 text-sm text-slate-500">Text-only request; no customer artwork attached.</p> : null}</div></div></div>
              <div className="space-y-4">{canQuote ? <form action={quoteCustomerProductionRequestAction} className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><div className="flex items-center gap-2"><Sparkles size={17} className="text-cyan-800" /><h3 className="font-bold text-cyan-950">Issue quoted preview</h3></div><p className="mt-1 text-xs text-cyan-900">The generated concept shows garment, placement, text and number. Final cutter/press production still uses the reviewed Design Studio production brief.</p><input type="hidden" name="requestId" value={request.id} /><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Quoted total ({shop.currency})<input className="field mt-1" name="quotedTotal" type="number" min="0.01" step="0.01" required defaultValue={request.quotedTotal ? Number(request.quotedTotal) : ""} /></label><label className="text-sm font-semibold">Deposit amount<input className="field mt-1" name="depositAmount" type="number" min="0" step="0.01" required defaultValue={request.depositAmount ? Number(request.depositAmount) : ""} /></label><label className="text-sm font-semibold sm:col-span-2">Preview / quote note<textarea className="field mt-1 min-h-24" name="previewNote" minLength={3} maxLength={1000} required defaultValue={request.previewNote ?? "Confirm garment size, placement, spelling, number, colours and artwork before approving."} /></label><label className="text-sm font-semibold">Quote expires<input className="field mt-1" name="quoteExpiresAt" type="date" /></label><div className="flex items-end"><button className="min-h-11 rounded-xl bg-cyan-800 px-4 text-sm font-semibold text-white" type="submit">Send preview v{request.previewVersion + 1}</button></div></div></form> : request.previewSvg ? <div className="overflow-hidden rounded-xl border border-[#ded8cd] bg-slate-50"><img className="mx-auto max-h-[460px] w-full object-contain" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(request.previewSvg)}`} alt={`Preview version ${request.previewVersion}`} /></div> : null}
                {amounts ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase text-slate-500">Quote</p><p className="font-black">{currency(amounts.quotedTotal, shop.currency)}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs uppercase text-emerald-700">Paid</p><p className="font-black">{currency(amounts.paidAmount, shop.currency)}</p></div><div className="rounded-xl bg-cyan-50 p-3"><p className="text-xs uppercase text-cyan-700">Deposit</p><p className="font-black">{currency(amounts.depositAmount, shop.currency)}</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs uppercase text-orange-700">Balance</p><p className="font-black">{currency(amounts.balanceDue, shop.currency)}</p></div></div> : null}
                {request.status === CustomerProductionRequestStatus.APPROVED && !request.depositPaidAt ? <FeedbackState state="warning" title="Waiting for verified deposit" description="Production cannot start until successful order payments reach the quoted deposit amount." /> : null}
                {request.status === CustomerProductionRequestStatus.DEPOSIT_PAID ? <form action={advanceCustomerProductionAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="START_PRODUCTION" /><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white" type="submit"><Play size={16} /> Start production</button></form> : null}
                {request.status === CustomerProductionRequestStatus.IN_PRODUCTION ? <form action={advanceCustomerProductionAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="MARK_READY" /><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white" type="submit"><PackageCheck size={16} /> Mark ready & notify customer</button></form> : null}
                {request.status === CustomerProductionRequestStatus.READY ? <>{!request.balancePaidAt ? <FeedbackState state="warning" title="Ready but balance remains" description="The customer can pay the remaining verified balance from their request page. Completion is blocked until full payment." /> : null}<form action={advanceCustomerProductionAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="action" value="COMPLETE" /><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={!request.balancePaidAt}><CheckCircle2 size={16} /> Complete & notify customer</button></form></> : null}
                {request.status === CustomerProductionRequestStatus.PREVIEW_READY ? <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><Clock3 size={16} /> Waiting for customer approval or changes.</p> : null}
              </div>
            </div>
          </article>;
        })}
        {!requests.length ? <FeedbackState state="empty" title="No custom production requests yet" description="Customer requests from customizable storefront products will appear here for quote and preview approval." /> : null}
      </div>
    </div>
  );
}
