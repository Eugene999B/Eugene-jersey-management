import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Bike, CheckCircle2, Clock3, History, MapPin, PackageCheck, Phone, ShieldCheck, Store } from "lucide-react";
import { FulfillmentType, PaymentMethod, PaymentStatus } from "@prisma/client";
import { verifyFulfillmentAction } from "@/app/track/[orderId]/actions";
import { requestReturnAction } from "@/app/track/[orderId]/return-actions";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getBuyerSession } from "@/lib/buyer-session";
import { getOrderWorkflow, listOrderWorkflowEvents } from "@/lib/order-workflow";
import { productVariantOptionLabel } from "@/lib/product-variants";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ verify?: string; access?: string; return?: string; payment?: string }>;
};

const steps = ["PENDING", "IN_PRODUCTION", "READY", "COMPLETED"] as const;
const publicEventTypes = new Set(["CREATED", "STATUS_CHANGED", "APPROVAL_CHANGED", "FULFILLMENT_UPDATED", "CANCELLED"]);

function publicEventSummary(event: { type: string; fromStatus: string | null; toStatus: string | null; createdAt: Date }) {
  if (event.type === "CREATED") return "Order received";
  if (event.type === "APPROVAL_CHANGED") return "Customer approval updated";
  if (event.type === "FULFILLMENT_UPDATED") return "Collection or delivery updated";
  if (event.type === "CANCELLED") return "Order cancelled";
  if (event.toStatus) return `Order moved to ${titleCase(event.toStatus)}`;
  return "Order progress updated";
}

export default async function TrackOrderPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const query = (await searchParams) ?? {};
  const verifyStatus = query.verify;
  const buyerSession = await getBuyerSession();
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderId }, { receiptNumber: orderId }],
    },
    include: {
      shop: true,
      buyer: true,
      customer: true,
      payments: true,
      returnRequests: { orderBy: { requestedAt: "desc" }, take: 3 },
      items: { include: { productVariant: { include: { product: true } } } },
    },
  });

  if (!order) notFound();
  const tokenAuthorized = Boolean(query.access && query.access === order.publicAccessToken);
  const buyerAuthorized = Boolean(buyerSession && order.buyerId === buyerSession.id);
  if (!tokenAuthorized && !buyerAuthorized) notFound();

  const [workflow, workflowEvents] = await Promise.all([
    getOrderWorkflow(order.shopId, order.id),
    listOrderWorkflowEvents(order.shopId, order.id, 40),
  ]);
  if (!workflow) notFound();
  const publicEvents = workflowEvents.filter((event) => publicEventTypes.has(event.type)).slice(0, 12);

  const activeIndex = steps.indexOf(order.status as (typeof steps)[number]);
  const paidAmount = order.payments
    .filter((payment) => payment.status === PaymentStatus.SUCCESS)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const creditAmount = order.payments
    .filter((payment) => payment.method === PaymentMethod.STORE_CREDIT && payment.status === PaymentStatus.PENDING)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balanceAmount = Math.max(Number(order.totalAmount) - paidAmount, 0);
  const paid = balanceAmount <= 0.005;
  const isDelivery = order.fulfillmentType === FulfillmentType.DELIVERY;
  const verified = Boolean(order.customerVerifiedAt);
  const returnDeadline = new Date((order.customerVerifiedAt ?? order.updatedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
  const openReturn = order.returnRequests.find((request) => ["REQUESTED", "APPROVED", "RECEIVED"].includes(request.status));
  const returnEligible = order.status === "COMPLETED" && returnDeadline >= new Date() && !openReturn;
  const style = {
    "--shop-primary": order.shop.primaryColor,
    "--shop-secondary": order.shop.secondaryColor,
  } as CSSProperties;

  return (
    <main style={style} className="min-h-screen bg-[#f6f4ef] px-3 py-4 sm:px-5">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-[8px] border border-[#ded8cd] bg-white">
        <div className="bg-[var(--shop-primary)] p-5 text-white sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Image src={order.shop.logoUrl || "/brand/accra-pro.svg"} alt={order.shop.name} width={52} height={52} className="rounded-[8px]" />
              <h1 className="mt-5 text-3xl font-semibold">Order {order.receiptNumber}</h1>
              <p className="mt-2 text-white/75">{order.shop.name} tracking and verification</p>
            </div>
            <Link className="rounded-[8px] border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold" href={`/shop/${order.shop.slug}`}>
              Back to shop
            </Link>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-[8px] bg-[#f6f4ef] p-3"><p className="text-xs font-semibold uppercase text-slate-500">Customer</p><p className="mt-1 font-semibold">{order.buyer?.name ?? order.customer?.name ?? "Customer"}</p></div>
            <div className="rounded-[8px] bg-[#f6f4ef] p-3"><p className="text-xs font-semibold uppercase text-slate-500">Total</p><p className="mt-1 font-semibold">{currency(order.totalAmount.toString(), order.shop.currency)}</p></div>
            <div className="rounded-[8px] bg-[#f6f4ef] p-3"><p className="text-xs font-semibold uppercase text-slate-500">Payment balance</p><p className="mt-1 font-semibold">{currency(balanceAmount, order.shop.currency)}</p>{creditAmount > 0 ? <p className="mt-1 text-xs text-slate-500">Credit portion {currency(creditAmount, order.shop.currency)}</p> : null}</div>
            <div className="rounded-[8px] bg-[#f6f4ef] p-3"><p className="text-xs font-semibold uppercase text-slate-500">Fulfillment</p><p className="mt-1 flex items-center gap-2 font-semibold">{isDelivery ? <Bike size={16} /> : <Store size={16} />} {titleCase(order.fulfillmentType)}</p></div>
            <div className="rounded-[8px] bg-[#f6f4ef] p-3"><p className="text-xs font-semibold uppercase text-slate-500">Expected date</p><p className="mt-1 flex items-center gap-2 font-semibold"><Clock3 size={16} />{workflow.dueAt ? shortDate(workflow.dueAt) : "Shop will confirm"}</p></div>
            <div className="rounded-[8px] bg-[#f6f4ef] p-3"><p className="text-xs font-semibold uppercase text-slate-500">Approval</p><p className="mt-1 font-semibold">{titleCase(workflow.approvalStatus)}</p></div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Badge tone={paid ? "green" : "orange"}>{paid ? "Paid" : `${currency(paidAmount, order.shop.currency)} paid`}</Badge>
            <Badge tone={order.status === "COMPLETED" ? "green" : order.status === "CANCELLED" ? "red" : order.rush ? "red" : "blue"}>{titleCase(order.status)}</Badge>
            <Badge tone={workflow.approvalStatus === "APPROVED" ? "green" : workflow.approvalStatus === "CHANGES_REQUESTED" ? "red" : workflow.approvalStatus === "PENDING" ? "orange" : "slate"}>{titleCase(workflow.approvalStatus)}</Badge>
            <Badge tone={verified ? "green" : "orange"}>{verified ? "Customer verified" : "Awaiting verification"}</Badge>
          </div>

          {workflow.approvalStatus === "PENDING" ? <div className="mb-6 rounded-[8px] border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900"><p className="font-semibold">Approval is still required.</p><p className="mt-1">The shop will not start approval-controlled production until the design, wording, option, or service details are approved.</p></div> : null}
          {workflow.approvalStatus === "CHANGES_REQUESTED" ? <div className="mb-6 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">Changes are being handled.</p><p className="mt-1">Production remains paused until the requested changes are completed and approved.</p></div> : null}

          {verifyStatus === "success" ? <div className="mb-6 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Verification saved successfully.</div> : null}
          {verifyStatus === "failed" ? <div className="mb-6 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">The phone number or code did not match this order.</div> : null}
          {verifyStatus === "rate" ? <div className="mb-6 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Too many verification attempts. Wait 15 minutes before trying again.</div> : null}
          {verifyStatus === "payment" ? <div className="mb-6 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Payment must be confirmed before delivery can be completed.</div> : null}
          {query.payment === "failed" ? <div className="mb-6 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Payment could not be opened.</p><p className="mt-1">Your order was saved, but it is still unpaid. Contact the shop before making another payment attempt.</p></div> : null}
          {query.payment === "success" ? <div className="mb-6 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Payment confirmed successfully.</div> : null}
          {query.return === "success" ? <div className="mb-6 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Return request sent to the shop.</div> : null}
          {query.return === "failed" ? <div className="mb-6 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">The phone number did not match this order, so the return request was not created.</div> : null}

          {order.cashHoldExpiresAt && !paid ? <div className="mb-6 rounded-[8px] border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">Cash reservation expires on {shortDate(order.cashHoldExpiresAt)}. Credit is only approved in-shop through POS.</div> : null}

          {isDelivery ? (
            <div className="mb-6 rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold"><MapPin size={16} /> Delivery details</p>
              <p>{order.deliveryAddress ?? "Address not provided"}</p>
              <p className="text-slate-500">{[order.deliveryArea, order.deliveryCity].filter(Boolean).join(", ") || "Area not provided"}</p>
              <p className="mt-2 text-slate-600">Delivery status: {titleCase(order.deliveryStatus)}</p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-4">
            {steps.map((step, index) => {
              const active = activeIndex >= index;
              return (
                <div key={step} className={`rounded-[8px] border p-4 ${active ? "border-[var(--shop-primary)] bg-white" : "border-[#ded8cd] bg-[#f6f4ef]"}`}>
                  <CheckCircle2 className={active ? "text-[var(--shop-primary)]" : "text-slate-300"} size={22} />
                  <p className="mt-3 text-sm font-semibold">{titleCase(step)}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 overflow-hidden rounded-[8px] border border-[#ded8cd] bg-white">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 border-b border-[#ded8cd] p-4 last:border-0">
                <div><p className="font-semibold">{item.quantity}x {item.productVariant.product.name}</p><p className="text-sm font-semibold text-cyan-700">{productVariantOptionLabel(item.productVariant.attributes)}</p><p className="text-xs text-slate-500">{item.productVariant.sku}</p></div>
                <p className="font-semibold">{currency(Number(item.unitPrice) * item.quantity, order.shop.currency)}</p>
              </div>
            ))}
          </div>

          {publicEvents.length ? (
            <section className="mt-6 rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-4" aria-labelledby="customer-order-updates-heading">
              <div className="flex items-center gap-2"><History size={18} className="text-[var(--shop-primary)]" /><h2 id="customer-order-updates-heading" className="font-semibold">Order updates</h2></div>
              <ol className="mt-4 space-y-3">
                {publicEvents.map((event) => <li key={event.id} className="border-l-2 border-slate-200 pl-3 text-sm"><p className="font-semibold">{publicEventSummary(event)}</p><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(event.createdAt)}</p></li>)}
              </ol>
            </section>
          ) : null}

          {!verified && order.pickupCodeHash && isDelivery ? (
            <form action={verifyFulfillmentAction} className="mt-6 rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center gap-2">{isDelivery ? <Bike size={18} className="text-[var(--shop-primary)]" /> : <PackageCheck size={18} className="text-[var(--shop-primary)]" />}<h2 className="font-semibold">{isDelivery ? "Verify delivery" : "Verify pickup"}</h2></div>
              <p className="mb-3 text-sm text-slate-600">Enter the complete 6-digit code sent to the order phone. The code is never displayed on this page.</p>
              <input type="hidden" name="receiptNumber" value={order.receiptNumber} />
              <input type="hidden" name="accessToken" value={order.publicAccessToken} />
              <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                <label className="flex items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3"><Phone size={16} className="text-slate-400" /><input className="min-h-11 flex-1 bg-transparent text-sm outline-none" name="phone" placeholder="+233..." required /></label>
                <input className="field tracking-[0.18em]" name="code" inputMode="numeric" placeholder="Code" required />
                <Button><ShieldCheck size={16} /> Verify</Button>
              </div>
            </form>
          ) : null}

          {returnEligible ? (
            <form action={requestReturnAction} className="mt-6 rounded-[8px] border border-[#ded8cd] bg-white p-4">
              <h2 className="font-semibold">Request return, refund, or exchange</h2>
              <p className="mt-1 text-sm text-slate-600">Use the same phone number on the order. The shop will review it in Commerce.</p>
              <input type="hidden" name="receiptNumber" value={order.receiptNumber} />
              <input type="hidden" name="accessToken" value={order.publicAccessToken} />
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><input className="field" name="phone" placeholder="+233..." required /><input className="field" name="reason" placeholder="Reason for return or exchange" required /><Button variant="outline">Send request</Button></div>
            </form>
          ) : null}
          {openReturn ? <p className="mt-6 rounded-[8px] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">A return request is already open for this order. Current status: <strong>{titleCase(openReturn.status)}</strong>.</p> : null}
          {!verified && order.pickupCodeHash && !isDelivery ? <div className="mt-6 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Pickup release happens at the shop.</p><p className="mt-1">Show the complete 6-digit code and the order phone number to staff. Staff will confirm payment, verify the code, and release the order.</p></div> : null}
        </div>
      </section>
    </main>
  );
}
