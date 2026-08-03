import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, History, PackageCheck, Printer, UserRound } from "lucide-react";
import { PaymentMethod, PaymentStatus, Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { OrderWorkflowPanel } from "@/components/orders/order-workflow-panel";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getOrderWorkflow, listOrderWorkflowEvents } from "@/lib/order-workflow";
import { productVariantOptionLabel } from "@/lib/product-variants";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";

type Props = { params: Promise<{ orderId: string }> };

const workflowRoles = [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.DESIGNER, Role.ACCOUNTANT];

function eventTitle(type: string) {
  const labels: Record<string, string> = {
    CREATED: "Order created",
    STATUS_CHANGED: "Order stage changed",
    ASSIGNED: "Responsibility changed",
    PRIORITY_CHANGED: "Priority changed",
    DUE_DATE_CHANGED: "Due date changed",
    APPROVAL_CHANGED: "Customer approval changed",
    INSTRUCTIONS_CHANGED: "Work instructions changed",
    FINANCE_TARGET_CHANGED: "Deposit or balance target changed",
    NOTE_ADDED: "Internal note updated",
    FULFILLMENT_UPDATED: "Fulfilment updated",
    CANCELLED: "Order cancelled",
  };
  return labels[type] ?? titleCase(type);
}

function eventSummary(event: {
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
}) {
  if (event.fromStatus || event.toStatus) return `${event.fromStatus ? titleCase(event.fromStatus) : "Created"} → ${event.toStatus ? titleCase(event.toStatus) : "Updated"}`;
  if (event.note) return event.note;
  const from = typeof event.metadata.from === "string" ? event.metadata.from : null;
  const to = typeof event.metadata.to === "string" ? event.metadata.to : null;
  if (from || to) return `${from ? titleCase(from) : "None"} → ${to ? titleCase(to) : "None"}`;
  return "Workflow information recorded.";
}

export default async function OrderDetailPage({ params }: Props) {
  const session = await requireRole([...new Set([...permissions.ordersRead, ...permissions.orderFinance])]);
  const { orderId } = await params;
  const { shop } = await getTenantContext();
  if (!shop || !session.shopId) return null;

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId: shop.id },
    include: {
      customer: true,
      buyer: true,
      processedBy: true,
      payments: { orderBy: { createdAt: "asc" } },
      debts: { include: { installments: { orderBy: { dueDate: "asc" } }, payments: { orderBy: { receivedAt: "asc" } } } },
      designJobs: { orderBy: { updatedAt: "desc" } },
      returnRequests: { orderBy: { requestedAt: "desc" } },
      items: { include: { productVariant: { include: { product: true } } } },
    },
  });
  if (!order) notFound();

  const [workflow, events, staff] = await Promise.all([
    getOrderWorkflow(shop.id, order.id),
    listOrderWorkflowEvents(shop.id, order.id),
    prisma.user.findMany({
      where: { shopId: shop.id, isActive: true, role: { notIn: [Role.SUPER_ADMIN, Role.SUPPLIER] } },
      select: { id: true, name: true, role: true, staffTitle: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);
  if (!workflow) notFound();

  const paidAmount = order.payments
    .filter((payment) => payment.status === PaymentStatus.SUCCESS)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const creditAmount = order.payments
    .filter((payment) => payment.method === PaymentMethod.STORE_CREDIT && payment.status === PaymentStatus.PENDING)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const refundedAmount = order.payments
    .filter((payment) => payment.status === PaymentStatus.REFUNDED)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalAmount = Number(order.totalAmount);
  const balanceAmount = Math.max(totalAmount - paidAmount, 0);
  const overdue = Boolean(workflow.dueAt && workflow.dueAt < new Date() && !["COMPLETED", "CANCELLED"].includes(order.status));
  const canEditWorkflow = workflowRoles.includes(session.role);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Order and job control room"
        title={order.receiptNumber}
        description={`${order.customer?.name ?? order.buyer?.name ?? "Walk-in customer"} · ${titleCase(order.channel)} · Created ${shortDate(order.createdAt)}`}
        aside={<div className="flex flex-wrap gap-2"><Badge tone={order.status === "COMPLETED" ? "green" : order.status === "CANCELLED" ? "red" : "blue"}>{titleCase(order.status)}</Badge><Badge tone={workflow.priority === "URGENT" ? "red" : workflow.priority === "HIGH" ? "orange" : "slate"}>{titleCase(workflow.priority)}</Badge>{overdue ? <Badge tone="red">Overdue</Badge> : null}</div>}
        actions={(
          <>
            <LinkButton href="/dashboard/orders" variant="outline"><ArrowLeft size={16} /> Orders</LinkButton>
            <LinkButton href={`/api/receipts/${order.id}`} variant="outline" target="_blank" rel="noreferrer"><Printer size={16} /> Receipt</LinkButton>
            <LinkButton href={`/track/${order.receiptNumber}?access=${encodeURIComponent(order.publicAccessToken)}`} target="_blank"><ExternalLink size={16} /> Customer view</LinkButton>
          </>
        )}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6" aria-label="Order summary">
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">Total</p><p className="mt-2 text-xl font-black">{currency(totalAmount, shop.currency)}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-emerald-700">Paid now</p><p className="mt-2 text-xl font-black text-emerald-950">{currency(paidAmount, shop.currency)}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-orange-700">Balance</p><p className="mt-2 text-xl font-black text-orange-950">{currency(balanceAmount, shop.currency)}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">Credit portion</p><p className="mt-2 text-xl font-black">{currency(creditAmount, shop.currency)}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">Assigned to</p><p className="mt-2 font-black">{workflow.assignedToName ?? "Unassigned"}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">Due</p><p className={`mt-2 font-black ${overdue ? "text-red-700" : ""}`}>{workflow.dueAt ? shortDate(workflow.dueAt) : "Not set"}</p></div>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
        <div className="space-y-5">
          {canEditWorkflow ? (
            <OrderWorkflowPanel
              orderId={order.id}
              receiptNumber={order.receiptNumber}
              role={session.role}
              status={order.status}
              orderTotal={totalAmount}
              paidAmount={paidAmount}
              currencyCode={shop.currency}
              workflow={{
                assignedToId: workflow.assignedToId,
                assignedToName: workflow.assignedToName,
                priority: workflow.priority,
                dueAt: workflow.dueAt?.toISOString() ?? null,
                approvalStatus: workflow.approvalStatus,
                approvalAt: workflow.approvalAt?.toISOString() ?? null,
                approvalNote: workflow.approvalNote,
                productionInstructions: workflow.productionInstructions,
                internalNotes: workflow.internalNotes,
                depositTargetAmount: workflow.depositTargetAmount,
                balanceDueAt: workflow.balanceDueAt?.toISOString() ?? null,
              }}
              staff={staff}
            />
          ) : (
            <section className="panel p-5">
              <h2 className="font-bold">Workflow overview</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase text-slate-500">Approval</dt><dd className="mt-1 font-semibold">{titleCase(workflow.approvalStatus)}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-500">Deposit target</dt><dd className="mt-1 font-semibold">{currency(workflow.depositTargetAmount, shop.currency)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-slate-500">Instructions</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{workflow.productionInstructions ?? "No work instructions recorded."}</dd></div>
              </dl>
            </section>
          )}

          <section className="panel p-4 sm:p-5" aria-labelledby="order-items-heading">
            <div className="flex items-center gap-2"><PackageCheck size={18} className="text-cyan-700" /><h2 id="order-items-heading" className="font-bold">Items and exact options</h2></div>
            <div className="mt-4 divide-y divide-slate-200">
              {order.items.map((item) => (
                <div key={item.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div><p className="font-bold">{item.quantity}× {item.productVariant.product.name}</p><p className="mt-1 text-sm font-semibold text-cyan-700">{productVariantOptionLabel(item.productVariant.attributes)}</p><p className="mt-1 text-xs text-slate-500">SKU {item.productVariant.sku}</p>{item.personalizationData ? <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-2 text-xs">{JSON.stringify(item.personalizationData, null, 2)}</pre> : null}</div>
                  <p className="font-black">{currency(Number(item.unitPrice) * item.quantity, shop.currency)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-4 sm:p-5" aria-labelledby="payment-history-heading">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><FileText size={18} className="text-cyan-700" /><h2 id="payment-history-heading" className="font-bold">Payment and debt history</h2></div>{refundedAmount > 0 ? <Badge tone="red">Refunded {currency(refundedAmount, shop.currency)}</Badge> : null}</div>
            <div className="mt-4 space-y-2">
              {order.payments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm"><div><p className="font-bold">{titleCase(payment.method)}</p><p className="text-xs text-slate-500">{shortDate(payment.createdAt)}{payment.providerReference ? ` · ${payment.providerReference}` : ""}</p></div><div className="text-right"><p className="font-black">{currency(payment.amount.toString(), shop.currency)}</p><Badge tone={payment.status === "SUCCESS" ? "green" : payment.status === "REFUNDED" || payment.status === "FAILED" ? "red" : "orange"}>{titleCase(payment.status)}</Badge></div></div>
              ))}
              {!order.payments.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No payment record exists yet.</p> : null}
            </div>
            {order.debts.map((debt) => (
              <div key={debt.id} className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">Credit account · {titleCase(debt.status)}</p><p className="font-black">{currency(Number(debt.principalAmount) - Number(debt.paidAmount), shop.currency)} outstanding</p></div><p className="mt-1">Principal {currency(debt.principalAmount.toString(), shop.currency)} · Paid {currency(debt.paidAmount.toString(), shop.currency)} · Due {shortDate(debt.dueDate)}</p><p className="mt-2 text-xs">{debt.installments.length} installment(s) · {debt.payments.length} collection(s)</p></div>
            ))}
          </section>

          <section className="panel p-4 sm:p-5" aria-labelledby="related-work-heading">
            <h2 id="related-work-heading" className="font-bold">Design jobs, fulfilment, and returns</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Design jobs</p><p className="mt-2 text-2xl font-black">{order.designJobs.length}</p>{order.designJobs.map((job) => <p key={job.id} className="mt-2 text-xs"><strong>{job.title}</strong> · {titleCase(job.status)}</p>)}</div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Fulfilment</p><p className="mt-2 font-black">{titleCase(order.fulfillmentType)}</p><p className="mt-1 text-xs">{titleCase(order.deliveryStatus)} · {order.customerVerifiedAt ? "Customer verified" : "Verification pending"}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Returns</p><p className="mt-2 text-2xl font-black">{order.returnRequests.length}</p>{order.returnRequests.slice(0, 2).map((request) => <p key={request.id} className="mt-2 text-xs"><strong>{titleCase(request.status)}</strong> · {request.reason}</p>)}</div>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="panel p-4 sm:p-5">
            <div className="flex items-center gap-2"><UserRound size={18} className="text-cyan-700" /><h2 className="font-bold">Customer and fulfilment</h2></div>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="font-bold text-slate-500">Customer</dt><dd>{order.customer?.name ?? order.buyer?.name ?? "Walk-in customer"}</dd></div>
              <div><dt className="font-bold text-slate-500">Phone</dt><dd>{order.customer?.phone ?? order.buyer?.phone ?? "Not recorded"}</dd></div>
              <div><dt className="font-bold text-slate-500">Email</dt><dd>{order.customer?.email ?? order.buyer?.email ?? "Not recorded"}</dd></div>
              <div><dt className="font-bold text-slate-500">Processed by</dt><dd>{order.processedBy?.name ?? "Online checkout"}</dd></div>
              <div><dt className="font-bold text-slate-500">Fulfilment</dt><dd>{titleCase(order.fulfillmentType)} · {titleCase(order.deliveryStatus)}</dd></div>
              {order.deliveryAddress ? <div><dt className="font-bold text-slate-500">Delivery address</dt><dd>{order.deliveryAddress}{order.deliveryArea ? `, ${order.deliveryArea}` : ""}{order.deliveryCity ? `, ${order.deliveryCity}` : ""}</dd></div> : null}
            </dl>
          </section>

          <section className="panel p-4 sm:p-5" aria-labelledby="workflow-timeline-heading">
            <div className="flex items-center gap-2"><History size={18} className="text-cyan-700" /><h2 id="workflow-timeline-heading" className="font-bold">Workflow timeline</h2></div>
            <ol className="mt-4 space-y-4">
              {events.map((event) => (
                <li key={event.id} className="relative border-l-2 border-slate-200 pl-4 before:absolute before:-left-[7px] before:top-1 before:h-3 before:w-3 before:rounded-full before:bg-cyan-600">
                  <p className="text-sm font-bold">{eventTitle(event.type)}</p>
                  <p className="mt-1 text-sm text-slate-700">{eventSummary(event)}</p>
                  <p className="mt-1 text-xs text-slate-500">{event.actorName ?? "System"} · {new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(event.createdAt)}</p>
                </li>
              ))}
              {!events.length ? <li className="text-sm text-slate-500">No workflow events have been recorded.</li> : null}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
