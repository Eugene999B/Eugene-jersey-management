import { notFound } from "next/navigation";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { currency, titleCase } from "@/lib/format";

type Props = {
  params: Promise<{ orderId: string }>;
};

const steps = ["PENDING", "IN_PRODUCTION", "READY", "COMPLETED"] as const;

export default async function TrackOrderPage({ params }: Props) {
  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderId }, { receiptNumber: orderId }],
    },
    include: {
      shop: true,
      customer: true,
      items: { include: { productVariant: { include: { product: true } } } },
    },
  });

  if (!order) notFound();

  const activeIndex = steps.indexOf(order.status as (typeof steps)[number]);
  const style = {
    "--shop-primary": order.shop.primaryColor,
    "--shop-secondary": order.shop.secondaryColor,
  } as React.CSSProperties;

  return (
    <main style={style} className="min-h-screen bg-[#f6f4ef] p-5">
      <section className="mx-auto max-w-3xl panel overflow-hidden">
        <div className="bg-[var(--shop-primary)] p-6 text-white">
          <Image src={order.shop.logoUrl || "/brand/accra-pro.svg"} alt={order.shop.name} width={52} height={52} className="rounded-[8px]" />
          <h1 className="mt-5 text-3xl font-semibold">Order {order.receiptNumber}</h1>
          <p className="mt-2 text-white/75">{order.shop.name} production tracking</p>
        </div>
        <div className="p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Customer</p>
              <p className="font-semibold">{order.customer?.name ?? "Walk-in customer"}</p>
            </div>
            <Badge tone={order.status === "COMPLETED" ? "green" : order.rush ? "red" : "blue"}>{titleCase(order.status)}</Badge>
          </div>

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

          <div className="mt-6 rounded-[8px] border border-[#ded8cd] bg-white">
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
        </div>
      </section>
    </main>
  );
}
