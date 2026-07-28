import { NotificationStatus, PaymentStatus, SupportCaseStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CreditCard, FileClock, KeyRound, MessageSquareWarning, PackageSearch, Store, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { currency, shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopId: string }> };

export default async function ShopInvestigationProfile({ params }: Props) {
  const { shopId } = await params;
  await requirePlatformPermission("support");
  const shop = await platformDb.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      slug: true,
      legalBusinessName: true,
      businessRegistrationNumber: true,
      credentialContactName: true,
      credentialEmail: true,
      credentialPhone: true,
      city: true,
      country: true,
      isActive: true,
      verificationStatus: true,
      subscriptionStatus: true,
      subscriptionRenewalAt: true,
      planTier: true,
      billingCycle: true,
      monthlyPrice: true,
      yearlyPrice: true,
      storefrontEnabled: true,
      publicOrderingEnabled: true,
      staffLoginId: true,
      createdAt: true,
      users: { select: { id: true, name: true, email: true, adminLoginId: true, role: true, isActive: true, lastLoginAt: true, failedLoginCount: true, lockUntil: true }, orderBy: { createdAt: "asc" } },
      suppliers: { select: { id: true, name: true, contactName: true, email: true, phone: true, isActive: true }, orderBy: { updatedAt: "desc" }, take: 12 },
      paymentConfig: { select: { paystackSubaccountCode: true, paystackTransactionCharge: true, paystackChargeBearer: true, allowCash: true, allowCard: true, allowMomo: true, shopMomoNetwork: true } },
      _count: { select: { products: true, customers: true, orders: true, debts: true, suppliers: true, dailyClosings: true } },
    },
  });
  if (!shop) notFound();

  const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [openCases, recentOrders, delayedOrders, failedMessages, failedPayments, recentAudit, sales, wallets] = await Promise.all([
    platformDb.supportCase.findMany({ where: { shopId, status: { notIn: [SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED] } }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 12 }),
    platformDb.order.findMany({ where: { shopId }, select: { id: true, receiptNumber: true, status: true, channel: true, totalAmount: true, createdAt: true, paystackReference: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    platformDb.order.count({ where: { shopId, status: { in: ["PENDING", "IN_PRODUCTION"] }, createdAt: { lte: staleDate } } }),
    platformDb.customerMessage.findMany({ where: { shopId, status: NotificationStatus.FAILED }, select: { id: true, channel: true, recipientName: true, subject: true, providerReference: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    platformDb.payment.findMany({ where: { status: PaymentStatus.FAILED, order: { shopId } }, select: { id: true, providerReference: true, method: true, amount: true, gatewayResponse: true, createdAt: true, order: { select: { receiptNumber: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    platformDb.auditLog.findMany({ where: { shopId }, select: { id: true, action: true, entityType: true, entityId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 15 }),
    platformDb.order.aggregate({ where: { shopId, createdAt: { gte: thirtyDaysAgo }, status: { not: "CANCELLED" } }, _sum: { totalAmount: true }, _count: true }),
    platformDb.shopCommunicationWallet.findMany({ where: { shopId }, select: { channel: true, balance: true, lifetimePurchased: true, lifetimeUsed: true, lifetimeRefunded: true } }),
  ]);
  const price = shop.billingCycle === "YEARLY" ? shop.yearlyPrice : shop.monthlyPrice;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><Link className="text-sm font-semibold text-slate-500 hover:text-slate-950" href="/admin/investigate">Back to investigation search</Link><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Exact-shop support profile</p><h1 className="mt-2 text-3xl font-semibold">{shop.name}</h1><p className="mt-2 text-sm text-slate-600">/{shop.slug} · created {shortDate(shop.createdAt)} · {shop.city ?? "City not set"}, {shop.country ?? "Ghana"}</p></div><div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold" href={`/admin/shops/${shop.id}`}>Open audited shop controls</Link><Link className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" href={`/admin/support/cases/new?shopId=${shop.id}`}>Open support case</Link></div></div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Workspace" value={shop.isActive ? "Active" : "Suspended"} icon={<Store size={20} />} />
        <StatCard label="Verification" value={titleCase(shop.verificationStatus)} />
        <StatCard label="Open cases" value={String(openCases.length)} icon={<AlertTriangle size={20} />} />
        <StatCard label="Delayed orders" value={String(delayedOrders)} icon={<PackageSearch size={20} />} />
        <StatCard label="30-day sales" value={currency(sales._sum.totalAmount?.toString() ?? "0")} />
        <StatCard label="30-day orders" value={String(sales._count)} />
        <StatCard label="Failed messages" value={String(failedMessages.length)} icon={<MessageSquareWarning size={20} />} />
        <StatCard label="Failed payments" value={String(failedPayments.length)} icon={<CreditCard size={20} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <article className="panel p-5"><div className="flex items-center gap-2"><Store size={18} /><h2 className="text-xl font-semibold">Business and commercial status</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{[
          ["Legal name", shop.legalBusinessName ?? "Not supplied"], ["Registration", shop.businessRegistrationNumber ?? "Not supplied"], ["Contact", shop.credentialContactName ?? "Not supplied"], ["Contact channel", shop.credentialEmail ?? shop.credentialPhone ?? "Not supplied"], ["Plan", `${shop.planTier} · ${titleCase(shop.subscriptionStatus)}`], ["Price", `${currency(price?.toString() ?? "0")} ${shop.billingCycle.toLowerCase()}`], ["Renewal", shop.subscriptionRenewalAt ? shortDate(shop.subscriptionRenewalAt) : "Not set"], ["Public shop", shop.storefrontEnabled ? (shop.publicOrderingEnabled ? "Online + ordering" : "Browse-only") : "Offline"],
        ].map(([label, value]) => <div key={label} className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div></article>

        <article className="panel p-5"><div className="flex items-center gap-2"><CreditCard size={18} /><h2 className="text-xl font-semibold">Payment and communication readiness</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">Paystack subaccount</p><p className="mt-1 font-semibold break-all">{shop.paymentConfig?.paystackSubaccountCode ?? "Not configured"}</p></div><div className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">Accepted payments</p><p className="mt-1 font-semibold">{[shop.paymentConfig?.allowCash && "Cash", shop.paymentConfig?.allowCard && "Card", shop.paymentConfig?.allowMomo && "MoMo"].filter(Boolean).join(", ") || "None"}</p></div><div className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">EJM flat charge</p><p className="mt-1 font-semibold">{shop.paymentConfig?.paystackTransactionCharge ? currency(shop.paymentConfig.paystackTransactionCharge / 100) : "No flat charge"}</p></div><div className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">Fee bearer</p><p className="mt-1 font-semibold">{shop.paymentConfig?.paystackChargeBearer === "account" ? "EJM account" : "Shop subaccount"}</p></div>{wallets.map((wallet) => <div key={wallet.channel} className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">{wallet.channel} wallet</p><p className="mt-1 text-xl font-semibold">{wallet.balance}</p><p className="mt-1 text-xs text-slate-500">Purchased {wallet.lifetimePurchased} · Used {wallet.lifetimeUsed} · Refunded {wallet.lifetimeRefunded}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">This profile intentionally excludes secret keys, full settlement account numbers, passwords, session tokens and two-factor secrets.</p></article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <article className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><div className="flex items-center gap-2"><Users size={18} /><h2 className="text-xl font-semibold">Users and access evidence</h2></div><p className="mt-1 text-sm text-slate-500">Login status only. Passwords, sessions and two-factor secrets are never displayed.</p></div><div className="divide-y divide-[#ded8cd] bg-white">{shop.users.map((user) => <div key={user.id} className="p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{user.name}</p><p className="mt-1 text-slate-500">{user.adminLoginId ?? "No Login ID"} · {user.email} · {titleCase(user.role)}</p><p className="mt-1 text-xs text-slate-400">Last login {user.lastLoginAt ? shortDate(user.lastLoginAt) : "never"} · failed attempts {user.failedLoginCount}{user.lockUntil && user.lockUntil > new Date() ? ` · locked until ${shortDate(user.lockUntil)}` : ""}</p></div><div className="flex flex-wrap gap-2"><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Suspended"}</Badge><Link className="text-xs font-semibold text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${shop.id}&subjectUserId=${user.id}&linkedEntityType=User&linkedEntityId=${user.id}`}>Open access case</Link></div></div></div>)}</div></article>

          <article className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><div className="flex items-center gap-2"><PackageSearch size={18} /><h2 className="text-xl font-semibold">Recent orders</h2></div></div><div className="divide-y divide-[#ded8cd] bg-white">{recentOrders.map((order) => <div key={order.id} className="p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{order.receiptNumber}</p><p className="mt-1 text-slate-500">{titleCase(order.channel)} · {currency(order.totalAmount.toString())} · {shortDate(order.createdAt)}</p><p className="mt-1 break-all text-xs text-slate-400">{order.paystackReference ?? "No Paystack reference"}</p></div><div className="flex items-center gap-2"><Badge tone={order.status === "COMPLETED" ? "green" : order.status === "CANCELLED" ? "red" : "orange"}>{titleCase(order.status)}</Badge><Link className="text-xs font-semibold text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${shop.id}&linkedEntityType=Order&linkedEntityId=${order.id}`}>Open case</Link></div></div></div>)}</div></article>
        </div>

        <div className="space-y-5">
          <article className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Open support cases</h2></div><div className="divide-y divide-[#ded8cd] bg-white">{openCases.map((item) => <Link key={item.id} href={`/admin/support/cases/${item.id}`} className="block p-4 text-sm transition hover:bg-slate-50"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{item.reference}</p><p className="mt-1 text-slate-500">{item.title}</p></div><div className="flex gap-2"><Badge tone={item.priority === "URGENT" ? "red" : item.priority === "HIGH" ? "orange" : "blue"}>{titleCase(item.priority)}</Badge><Badge>{titleCase(item.status)}</Badge></div></div></Link>)}{!openCases.length ? <p className="p-4 text-sm text-slate-500">No open cases for this shop.</p> : null}</div></article>

          <article className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><div className="flex items-center gap-2"><MessageSquareWarning size={18} /><h2 className="text-xl font-semibold">Failed communications</h2></div></div><div className="divide-y divide-[#ded8cd] bg-white">{failedMessages.map((message) => <div key={message.id} className="p-4 text-sm"><p className="font-semibold">{message.subject ?? message.recipientName ?? titleCase(message.channel)}</p><p className="mt-1 text-slate-500">{titleCase(message.channel)} · {shortDate(message.createdAt)}</p><p className="mt-1 break-all text-xs text-slate-400">{message.providerReference ?? "No provider reference"}</p><Link className="mt-2 inline-flex text-xs font-semibold text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${shop.id}&linkedEntityType=CustomerMessage&linkedEntityId=${message.id}`}>Open messaging case</Link></div>)}{!failedMessages.length ? <p className="p-4 text-sm text-slate-500">No failed customer messages.</p> : null}</div></article>

          <article className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><div className="flex items-center gap-2"><CreditCard size={18} /><h2 className="text-xl font-semibold">Failed payment records</h2></div></div><div className="divide-y divide-[#ded8cd] bg-white">{failedPayments.map((payment) => <div key={payment.id} className="p-4 text-sm"><p className="font-semibold break-all">{payment.providerReference ?? payment.order.receiptNumber}</p><p className="mt-1 text-slate-500">{payment.order.receiptNumber} · {titleCase(payment.method)} · {currency(payment.amount.toString())}</p><p className="mt-1 line-clamp-2 text-xs text-slate-400">{payment.gatewayResponse ?? "No gateway response stored"}</p><Link className="mt-2 inline-flex text-xs font-semibold text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${shop.id}&linkedEntityType=Payment&linkedEntityId=${payment.id}`}>Open payment case</Link></div>)}{!failedPayments.length ? <p className="p-4 text-sm text-slate-500">No failed payment records.</p> : null}</div></article>

          <article className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><div className="flex items-center gap-2"><FileClock size={18} /><h2 className="text-xl font-semibold">Recent audit trail</h2></div></div><div className="divide-y divide-[#ded8cd] bg-white">{recentAudit.map((entry) => <div key={entry.id} className="p-4 text-sm"><p className="font-semibold">{entry.action}</p><p className="mt-1 text-xs text-slate-500">{entry.entityType} · {entry.entityId ?? "No entity ID"} · {shortDate(entry.createdAt)}</p></div>)}</div></article>
        </div>
      </section>

      <section className="panel p-5"><div className="flex items-center gap-2"><KeyRound size={18} /><h2 className="text-xl font-semibold">Identity and supplier summary</h2></div><div className="mt-4 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]"><div className="rounded-xl bg-white p-4 text-sm"><p className="text-xs font-bold uppercase text-slate-500">Owner Login ID</p><p className="mt-2 text-lg font-semibold">{shop.staffLoginId ?? "Not assigned"}</p><p className="mt-2 text-slate-500">Use the audited shop controls page for verification, suspension or payment-routing changes.</p></div><div className="grid gap-3 sm:grid-cols-2">{shop.suppliers.map((supplier) => <div key={supplier.id} className="rounded-xl bg-white p-4 text-sm"><div className="flex justify-between gap-2"><p className="font-semibold">{supplier.name}</p><Badge tone={supplier.isActive ? "green" : "red"}>{supplier.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-slate-500">{supplier.contactName ?? "No contact"} · {supplier.email ?? supplier.phone ?? "No channel"}</p><Link className="mt-3 inline-flex text-xs font-semibold text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${shop.id}&supplierId=${supplier.id}&linkedEntityType=Supplier&linkedEntityId=${supplier.id}`}>Open supplier case</Link></div>)}{!shop.suppliers.length ? <p className="text-sm text-slate-500">No suppliers are attached to this shop.</p> : null}</div></div></section>
    </div>
  );
}
