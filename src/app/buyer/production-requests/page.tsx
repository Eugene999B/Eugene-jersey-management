import Link from "next/link";
import { ArrowLeft, PackageCheck, Shirt } from "lucide-react";
import { CustomerProductionRequestStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { getBuyerSession } from "@/lib/buyer-session";
import { customerProductionBalance, paidOrderAmount } from "@/lib/customer-production";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";

function tone(status: CustomerProductionRequestStatus): "green" | "red" | "orange" | "blue" | "slate" {
  if ([CustomerProductionRequestStatus.COMPLETED, CustomerProductionRequestStatus.READY].includes(status)) return "green";
  if (status === CustomerProductionRequestStatus.CANCELLED) return "red";
  if ([CustomerProductionRequestStatus.SUBMITTED, CustomerProductionRequestStatus.CHANGES_REQUESTED].includes(status)) return "orange";
  if ([CustomerProductionRequestStatus.APPROVED, CustomerProductionRequestStatus.DEPOSIT_PAID, CustomerProductionRequestStatus.IN_PRODUCTION].includes(status)) return "blue";
  return "slate";
}

export default async function BuyerProductionRequestsPage() {
  const buyer = await getBuyerSession();
  if (!buyer) return <main className="min-h-screen bg-[#f6f4ef] p-5"><div className="mx-auto max-w-3xl rounded-xl bg-white p-5"><h1 className="text-xl font-bold">Login required</h1><Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white" href="/buyer/login?next=/buyer/production-requests">Login to view custom requests</Link></div></main>;
  const requests = await prisma.customerProductionRequest.findMany({ where: { buyerId: buyer.id }, orderBy: { updatedAt: "desc" }, take: 100 });
  const shopIds = [...new Set(requests.map((request) => request.shopId))];
  const orderIds = [...new Set(requests.flatMap((request) => request.orderId ? [request.orderId] : []))];
  const [shops, orders] = await Promise.all([
    shopIds.length ? prisma.shop.findMany({ where: { id: { in: shopIds } }, select: { id: true, name: true, slug: true, currency: true } }) : [],
    orderIds.length ? prisma.order.findMany({ where: { id: { in: orderIds }, buyerId: buyer.id }, include: { payments: true } }) : [],
  ]);
  const shopMap = new Map(shops.map((shop) => [shop.id, shop]));
  const orderMap = new Map(orders.map((order) => [order.id, order]));

  return <main className="min-h-screen bg-[#f6f4ef]"><div className="mx-auto max-w-5xl px-3 py-5 sm:px-5 sm:py-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-cyan-700">Buyer account</p><h1 className="mt-1 text-3xl font-black">My custom production requests</h1><p className="mt-2 text-sm text-slate-600">Preview approvals, deposits, production progress, balances and completion in one place.</p></div><Link href="/shops" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#ded8cd] bg-white px-4 text-sm font-semibold"><ArrowLeft size={16} /> Marketplace</Link></div><div className="mt-5 space-y-3">{requests.map((request) => { const shop = shopMap.get(request.shopId); const order = request.orderId ? orderMap.get(request.orderId) : null; const paid = order ? paidOrderAmount(order.payments) : 0; const amounts = request.quotedTotal !== null && request.depositAmount !== null ? customerProductionBalance({ quotedTotal: Number(request.quotedTotal), depositAmount: Number(request.depositAmount), paidAmount: paid }) : null; return <Link key={request.id} href={`/buyer/production-requests/${request.id}`} className="panel grid gap-3 p-4 transition hover:border-slate-400 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Shirt size={17} className="text-cyan-700" /><h2 className="truncate font-bold">{request.title}</h2><Badge tone={tone(request.status)}>{titleCase(request.status)}</Badge></div><p className="mt-1 text-sm text-slate-500">{shop?.name ?? "Shop"} · updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(request.updatedAt)}</p></div><div className="text-sm sm:text-right">{amounts ? <><p className="font-black">{currency(amounts.balanceDue, shop?.currency ?? "GHS")} due</p><p className="text-xs text-slate-500">{currency(amounts.paidAmount, shop?.currency ?? "GHS")} paid of {currency(amounts.quotedTotal, shop?.currency ?? "GHS")}</p></> : <p className="flex items-center gap-1 font-semibold text-slate-600"><PackageCheck size={15} /> Waiting for quote</p>}</div></Link>; })}{!requests.length ? <div className="panel p-6 text-center"><Shirt className="mx-auto text-slate-400" size={28} /><h2 className="mt-3 font-bold">No custom requests yet</h2><p className="mt-1 text-sm text-slate-500">Open a verified shop with custom production and submit your design request.</p></div> : null}</div></div></main>;
}
