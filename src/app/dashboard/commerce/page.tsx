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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Commerce control center</h1>
          <p className="mt-2 text-sm text-slate-500">Delivery zones, coupon campaigns, return requests, and online operations.</p>
        </div>
        <Badge tone="blue">Online-ready controls</Badge>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bike size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-lg font-semibold">Delivery zones</h2>
          </div>
          <form action={createDeliveryZoneAction} className="grid gap-3 md:grid-cols-2">
            <input className="field" name="name" placeholder="Zone name" required />
            <input className="field" name="city" placeholder="City" />
            <input className="field" name="area" placeholder="Area" />
            <input className="field" name="fee" type="number" min="0" step="0.01" placeholder="Fee" />
            <input className="field" name="estimatedMins" type="number" min="1" placeholder="Estimated minutes" />
            <Button>Create zone</Button>
          </form>
          <div className="mt-4 grid gap-2">
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center justify-between rounded-[8px] bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{zone.name}</span>
                <span className="text-slate-600">{currency(zone.fee.toString(), shop.currency)} {zone.estimatedMins ? `| ${zone.estimatedMins} mins` : ""}</span>
              </div>
            ))}
            {!zones.length ? <p className="text-sm text-slate-500">No delivery zones yet.</p> : null}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Tags size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-lg font-semibold">Coupons</h2>
          </div>
          <form action={createCouponAction} className="grid gap-3 md:grid-cols-2">
            <input className="field uppercase" name="code" placeholder="CODE" required />
            <select className="field" name="discountType" defaultValue={CouponDiscountType.PERCENT}>
              {Object.values(CouponDiscountType).map((type) => (
                <option key={type} value={type}>{titleCase(type)}</option>
              ))}
            </select>
            <input className="field" name="value" type="number" min="0" step="0.01" placeholder="Value" required />
            <input className="field" name="minSubtotal" type="number" min="0" step="0.01" placeholder="Minimum subtotal" />
            <input className="field" name="usageLimit" type="number" min="1" placeholder="Usage limit" />
            <input className="field" name="endsAt" type="date" />
            <Button>Create coupon</Button>
          </form>
          <div className="mt-4 grid gap-2">
            {coupons.map((coupon) => (
              <div key={coupon.id} className="flex items-center justify-between rounded-[8px] bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{coupon.code}</span>
                <span className="text-slate-600">
                  {coupon.discountType === "PERCENT" ? `${coupon.value}%` : currency(coupon.value.toString(), shop.currency)} | used {coupon.usedCount}
                </span>
              </div>
            ))}
            {!coupons.length ? <p className="text-sm text-slate-500">No coupons yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#ded8cd] p-5">
          <RotateCcw size={18} className="text-[var(--shop-primary)]" />
          <h2 className="text-lg font-semibold">Returns and refunds</h2>
        </div>
        <div className="divide-y divide-[#ded8cd] bg-white">
          {returns.map((request) => (
            <form key={request.id} action={updateReturnRequestAction} className="grid gap-3 p-4 lg:grid-cols-[1fr_180px_1fr_auto]">
              <input type="hidden" name="requestId" value={request.id} />
              <div>
                <p className="font-semibold">{request.order.receiptNumber}</p>
                <p className="text-sm text-slate-500">{request.order.buyer?.name ?? request.order.customer?.name ?? "Customer"} | {shortDate(request.requestedAt)}</p>
                <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
              </div>
              <select className="field" name="status" defaultValue={request.status}>
                {Object.values(ReturnRequestStatus).map((status) => (
                  <option key={status} value={status}>{titleCase(status)}</option>
                ))}
              </select>
              <input className="field" name="resolution" placeholder="Resolution note" defaultValue={request.resolution ?? ""} />
              <Button variant="outline"><PackageCheck size={16} /> Update</Button>
            </form>
          ))}
          {!returns.length ? <p className="p-5 text-sm text-slate-500">No return requests yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
