import { OrderStatus, ReturnRequestStatus } from "@prisma/client";
import { AlertTriangle, MessagesSquare, PackageSearch, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { adminUpdateOrderStatusAction, closeCustomerThreadAction, updateReturnIssueAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { compactNumber, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type SupportPageProps = { searchParams?: Promise<{ error?: string }> };

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("support");
  const staleOrderDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [returnIssues, openThreads, stuckOrders, failedMessages] = await Promise.all([
    prisma.returnRequest.findMany({ where: { status: { in: [ReturnRequestStatus.REQUESTED, ReturnRequestStatus.APPROVED, ReturnRequestStatus.RECEIVED] } }, include: { shop: true, order: true, buyer: true }, orderBy: { requestedAt: "desc" }, take: 30 }),
    prisma.customerThread.findMany({ where: { status: { not: "RESOLVED" } }, include: { shop: true, customer: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.order.findMany({ where: { status: { in: [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION] }, createdAt: { lte: staleOrderDate } }, include: { shop: true, customer: true }, orderBy: { createdAt: "asc" }, take: 30 }),
    prisma.customerMessage.count({ where: { status: "FAILED" } }),
  ]);

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Customer operations</p><h1 className="mt-2 text-3xl font-semibold">Support desk</h1><p className="mt-2 text-sm text-slate-600">Resolve platform-level returns, conversations, delayed orders and message-delivery failures.</p></div>
      {params.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">The support update was not applied. The case may have changed, require a refund workflow, or contain invalid data.</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Active returns" value={compactNumber(returnIssues.length)} icon={<RotateCcw size={20} />} /><StatCard label="Open conversations" value={compactNumber(openThreads.length)} icon={<MessagesSquare size={20} />} /><StatCard label="Delayed orders" value={compactNumber(stuckOrders.length)} icon={<PackageSearch size={20} />} /><StatCard label="Failed messages" value={compactNumber(failedMessages)} icon={<AlertTriangle size={20} />} /></section>

      <section className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Return requests</h2><p className="mt-1 text-sm text-slate-500">Move non-financial return cases through approved operational states. Refunds and exchanges use their dedicated stock and payment workflows.</p></div><div className="divide-y divide-[#ded8cd] bg-white">{returnIssues.map((issue) => <article key={issue.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_340px]"><div><p className="font-semibold">{issue.reason}</p><p className="mt-1 text-slate-500">{issue.shop.name} · {issue.order.receiptNumber} · {issue.buyer?.name ?? "Buyer"}</p><p className="mt-1 text-xs text-slate-400">Requested {shortDate(issue.requestedAt)}</p></div><form action={updateReturnIssueAction} className="grid grid-cols-[1fr_auto] gap-2"><input type="hidden" name="returnRequestId" value={issue.id} /><select className="field min-h-9 py-1 text-xs" name="status" defaultValue={issue.status}>{Object.values(ReturnRequestStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select><Button className="min-h-9 px-3 py-1 text-xs">Update</Button><input className="field col-span-2 min-h-9 py-1 text-xs" name="resolution" placeholder="Resolution note" /></form></article>)}{!returnIssues.length ? <p className="p-5 text-sm text-slate-500">No active return requests.</p> : null}</div></section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Customer conversations</h2><p className="mt-1 text-sm text-slate-500">Unresolved communication threads requiring platform attention.</p></div><div className="divide-y divide-[#ded8cd] bg-white">{openThreads.map((thread) => <article key={thread.id} className="grid gap-3 p-4 text-sm sm:grid-cols-[1fr_auto]"><div><p className="font-semibold">{thread.subject}</p><p className="mt-1 text-slate-500">{thread.shop.name} · {thread.customer?.name ?? "Customer"}</p><p className="mt-2 line-clamp-2 text-xs text-slate-500">{thread.messages[0]?.body ?? "No message"}</p></div><form action={closeCustomerThreadAction}><input type="hidden" name="threadId" value={thread.id} /><Button variant="outline" className="min-h-9 px-3 py-1 text-xs">Resolve</Button></form></article>)}{!openThreads.length ? <p className="p-5 text-sm text-slate-500">No unresolved customer conversations.</p> : null}</div></div>
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Delayed orders</h2><p className="mt-1 text-sm text-slate-500">Pending or in-production orders older than 24 hours.</p></div><div className="divide-y divide-[#ded8cd] bg-white">{stuckOrders.map((order) => <article key={order.id} className="p-4 text-sm"><div><p className="font-semibold">{order.receiptNumber}</p><p className="mt-1 text-slate-500">{order.shop.name} · {order.customer?.name ?? "No customer"} · {shortDate(order.createdAt)}</p></div><form action={adminUpdateOrderStatusAction} className="mt-3 grid grid-cols-[1fr_auto] gap-2"><input type="hidden" name="orderId" value={order.id} /><select className="field min-h-9 py-1 text-xs" name="status" defaultValue={order.status}>{Object.values(OrderStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select><Button className="min-h-9 px-3 py-1 text-xs">Save</Button><input className="field col-span-2 min-h-9 py-1 text-xs" name="notes" placeholder="Admin note or cancellation reason" /></form></article>)}{!stuckOrders.length ? <p className="p-5 text-sm text-slate-500">No delayed orders currently require platform attention.</p> : null}</div></div>
      </section>
    </div>
  );
}
