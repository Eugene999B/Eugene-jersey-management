import { CouponDiscountType, ReturnRequestStatus } from "@prisma/client";
import { Bike, PackageCheck, RotateCcw, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createCouponAction, createDeliveryZoneAction, updateReturnRequestAction } from "@/app/dashboard/commerce/actions";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { currency, shortDate, titleCase } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

const lockedReturnStatuses = new Set<ReturnRequestStatus>([
  ReturnRequestStatus.REFUNDED,
  ReturnRequestStatus.EXCHANGED,
]);

function returnStatusOptions(status: ReturnRequestStatus) {
  if (status === ReturnRequestStatus.REQUESTED) {
    return [ReturnRequestStatus.REQUESTED, ReturnRequestStatus.APPROVED, ReturnRequestStatus.REJECTED, ReturnRequestStatus.CANCELLED];
  }
  if (status === ReturnRequestStatus.APPROVED) {
    return [ReturnRequestStatus.APPROVED, ReturnRequestStatus.RECEIVED, ReturnRequestStatus.REJECTED, ReturnRequestStatus.CANCELLED];
  }
  return [status];
}

export default async function CommercePage() {
  await requireRole(permissions.commerce);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [zones, coupons, returns] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" } }),
    prisma.coupon.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" } }),
    prisma.returnRequest.findMany({
      where: { shopId: shop.id },
      include: { order: { include: { customer: true, buyer: true } } },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Commerce control centre</h1><p className="mt-2 text-sm text-slate-500">Delivery zones, coupon campaigns, return requests, and online operations.</p></div>
        <Badge tone="blue">Online-ready controls</Badge>
      </div>

      <section className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <div className="panel p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Bike size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Delivery zones</h2></div>
          <form action={createDeliveryZoneAction} className="grid gap-3 sm:grid-cols-2">
            <input className="field" name="name" maxLength={80} placeholder="Zone name" required />
            <input className="field" name="city" maxLength={100} placeholder="City" />
            <input className="field" name="area" maxLength={100} placeholder="Area" />
            <input className="field" name="fee" type="number" min="0" step="0.01" placeholder="Fee" />
            <input className="field" name="estimatedMins" type="number" min="1" max="10080" placeholder="Estimated minutes" />
            <Button className="w-full">Create zone</Button>
          </form>
          <div className="mt-4 grid gap-2">
            {zones.map((zone) => <div key={zone.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-3 text-sm"><span className="min-w-0 truncate font-semibold">{zone.name}</span><span className="shrink-0 text-right text-slate-600">{currency(zone.fee.toString(), shop.currency)}{zone.estimatedMins ? <span className="block text-xs text-slate-400">{zone.estimatedMins} mins</span> : null}</span></div>)}
            {!zones.length ? <p className="text-sm text-slate-500">No delivery zones yet.</p> : null}
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Tags size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Coupons</h2></div>
          <form action={createCouponAction} className="grid gap-3 sm:grid-cols-2">
            <input className="field uppercase" name="code" maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]*" placeholder="CODE" required />
            <select className="field" name="discountType" defaultValue={CouponDiscountType.PERCENT}>{Object.values(CouponDiscountType).map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select>
            <input className="field" name="value" type="number" min="0.01" step="0.01" placeholder="Value" required />
            <input className="field" name="minSubtotal" type="number" min="0" step="0.01" placeholder="Minimum subtotal" />
            <input className="field" name="usageLimit" type="number" min="1" max="1000000" placeholder="Usage limit" />
            <input className="field" name="endsAt" type="date" />
            <Button className="w-full sm:col-span-2">Create or update coupon</Button>
          </form>
          <div className="mt-4 grid gap-2">
            {coupons.map((coupon) => <div key={coupon.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-3 text-sm"><span className="font-semibold">{coupon.code}</span><span className="text-right text-slate-600">{coupon.discountType === "PERCENT" ? `${coupon.value}%` : currency(coupon.value.toString(), shop.currency)}<span className="block text-xs text-slate-400">Used {coupon.usedCount}{coupon.usageLimit ? ` of ${coupon.usageLimit}` : ""}</span></span></div>)}
            {!coupons.length ? <p className="text-sm text-slate-500">No coupons yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><div className="flex items-center gap-2"><RotateCcw size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Return workflow</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Approval and receipt can be recorded here. Refunds and exchanges require the dedicated payment and stock workflow.</p></div>
        <div className="divide-y divide-[#ded8cd] bg-white">
          {returns.map((request) => {
            const locked = lockedReturnStatuses.has(request.status);
            return (
              <form key={request.id} action={updateReturnRequestAction} className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_180px_1fr_auto] lg:items-end">
                <input type="hidden" name="requestId" value={request.id} />
                <div className="min-w-0"><p className="truncate font-semibold">{request.order.receiptNumber}</p><p className="text-sm text-slate-500">{request.order.buyer?.name ?? request.order.customer?.name ?? "Customer"} · {shortDate(request.requestedAt)}</p><p className="mt-1 break-words text-sm text-slate-600">{request.reason}</p></div>
                <label className="text-xs font-semibold text-slate-600">Status<select className="field mt-1" name="status" defaultValue={request.status} disabled={locked}>{returnStatusOptions(request.status).map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-600">Resolution<input className="field mt-1" name="resolution" maxLength={1000} placeholder="Resolution note" defaultValue={request.resolution ?? ""} /></label>
                <Button variant="outline" className="w-full lg:w-auto" disabled={locked}><PackageCheck size={16} /> Update</Button>
              </form>
            );
          })}
          {!returns.length ? <p className="p-5 text-sm text-slate-500">No return requests yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
