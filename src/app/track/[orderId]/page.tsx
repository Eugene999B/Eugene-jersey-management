import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Bike, CheckCircle2, CreditCard, MapPin, PackageCheck, Phone, ShieldCheck, Store, Wallet } from "lucide-react";
import { FulfillmentType } from "@prisma/client";
import { verifyFulfillmentAction } from "@/app/track/[orderId]/actions";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, shortDate, titleCase } from "@/lib/format";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ verify?: string }>;
};

const steps = ["PENDING", "IN_PRODUCTION", "READY", "COMPLETED"] as const;

export default async function TrackOrderPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const verifyStatus = (await searchParams)?.verify;
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderId }, { receiptNumber: orderId }],
    },
    include: {
      shop: true,
      buyer: true,
      customer: true,
      payments: true,
      items: { include: { productVariant: { include: { product: true } } } },
    },
  });

  if (!order) notFound();

  const activeIndex = steps.indexOf(order.status as (typeof steps)[number]);
  const paid = order.payments.some((payment) => payment.status === "SUCCESS");
  const pendingPayment = order.payments.find((payment) => payment.status === "PENDING");
  const isDelivery = order.fulfillmentType === FulfillmentType.DELIVERY;
  const verified = Boolean(order.customerVerifiedAt);
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
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[8px] bg-[#f6f4ef] p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Customer</p>
              <p className="mt-1 font-semibold">{order.buyer?.name ?? order.customer?.name ?? "Customer"}</p>
            </div>
            <div className="rounded-[8px] bg-[#f6f4ef] p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
              <p className="mt-1 font-semibold">{currency(order.totalAmount.toString(), order.shop.currency)}</p>
            </div>
            <div className="rounded-[8px] bg-[#f6f4ef] p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Fulfillment</p>
              <p className="mt-1 flex items-center gap-2 font-semibold">
                {isDelivery ? <Bike size={16} /> : <Store size={16} />} {titleCase(order.fulfillmentType)}
              </p>
            </div>
            <div className="rounded-[8px] bg-[#f6f4ef] p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Payment</p>
              <p className="mt-1 flex items-center gap-2 font-semibold">
                {pendingPayment?.method === "CASH" ? <Wallet size={16} /> : <CreditCard size={16} />} {paid ? "Paid" : "Pending"}
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Badge tone={paid ? "green" : "orange"}>{paid ? "Paid" : "Payment pending"}</Badge>
            <Badge tone={order.status === "COMPLETED" ? "green" : order.rush ? "red" : "blue"}>{titleCase(order.status)}</Badge>
            <Badge tone={verified ? "green" : "orange"}>{verified ? "Customer verified" : "Awaiting verification"}</Badge>
          </div>

          {verifyStatus === "success" ? (
            <div className="mb-6 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Verification saved successfully.
            </div>
          ) : null}
          {verifyStatus === "failed" ? (
            <div className="mb-6 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              The phone number or code did not match this order.
            </div>
          ) : null}

          {order.cashHoldExpiresAt && !paid ? (
            <div className="mb-6 rounded-[8px] border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              Cash reservation expires on {shortDate(order.cashHoldExpiresAt)}. Credit is only approved in-shop through POS.
            </div>
          ) : null}

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
                <div>
                  <p className="font-semibold">{item.quantity}x {item.productVariant.product.name}</p>
                  <p className="text-sm text-slate-500">{item.productVariant.sku}</p>
                </div>
                <p className="font-semibold">{currency(Number(item.unitPrice) * item.quantity, order.shop.currency)}</p>
              </div>
            ))}
          </div>

          {!verified && order.pickupCodeHash ? (
            <form action={verifyFulfillmentAction} className="mt-6 rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center gap-2">
                {isDelivery ? <Bike size={18} className="text-[var(--shop-primary)]" /> : <PackageCheck size={18} className="text-[var(--shop-primary)]" />}
                <h2 className="font-semibold">{isDelivery ? "Verify delivery" : "Verify pickup"}</h2>
              </div>
              <p className="mb-3 text-sm text-slate-600">
                Code ending in {order.pickupCodeLast4 ?? "----"} was sent by SMS. Use the same phone number used for the order.
              </p>
              <input type="hidden" name="receiptNumber" value={order.receiptNumber} />
              <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                <label className="flex items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3">
                  <Phone size={16} className="text-slate-400" />
                  <input className="min-h-11 flex-1 bg-transparent text-sm outline-none" name="phone" placeholder="+233..." required />
                </label>
                <input className="field tracking-[0.18em]" name="code" inputMode="numeric" placeholder="Code" required />
                <Button><ShieldCheck size={16} /> Verify</Button>
              </div>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}
