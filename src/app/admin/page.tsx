import Link from "next/link";
import { BillingCycle, OrderStatus, PlanTier, ReturnRequestStatus, Role, SubscriptionStatus } from "@prisma/client";
import { Activity, AlertTriangle, Banknote, CheckCircle2, KeyRound, LifeBuoy, Megaphone, Plus, Power, Settings, Shield, Store, TrendingUp, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { adminUpdateOrderStatusAction, closeCustomerThreadAction, createGlobalAnnouncementAction, createPlatformWorkerAction, togglePlatformWorkerAction, toggleShopAction, updateReturnIssueAction, updateShopSubscriptionAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { compactNumber, currency, shortDate } from "@/lib/format";

type AdminPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const adminPermissionOptions = [
  ["shops", "Shops"],
  ["billing", "Billing"],
  ["support", "Support"],
  ["workers", "Workers"],
  ["broadcast", "Broadcast"],
  ["activity", "Activity"],
  ["settings", "Settings"],
] as const;

function adminPermissions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((item) => adminPermissionOptions.some(([key]) => key === item));
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const staleOrderDate = new Date();
  staleOrderDate.setHours(staleOrderDate.getHours() - 24);
  const [shops, shopCount, userCount, orderAggregate, debtAggregate, recentLogs, platformWorkers, returnIssues, openThreads, stuckOrders, failedMessages] = await Promise.all([
    prisma.shop.findMany({
      include: {
        _count: { select: { users: true, products: true, orders: true, debts: true } },
        orders: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shop.count(),
    prisma.user.count(),
    prisma.order.aggregate({ _sum: { totalAmount: true }, _count: true }),
    prisma.debt.aggregate({ _sum: { principalAmount: true, paidAmount: true }, _count: true }),
    prisma.auditLog.findMany({ include: { user: true, shop: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.user.findMany({ where: { role: Role.SUPER_ADMIN, shopId: null }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.returnRequest.findMany({
      where: { status: { in: [ReturnRequestStatus.REQUESTED, ReturnRequestStatus.APPROVED, ReturnRequestStatus.RECEIVED] } },
      include: { shop: true, order: true, buyer: true },
      orderBy: { requestedAt: "desc" },
      take: 6,
    }),
    prisma.customerThread.findMany({
      where: { status: { not: "RESOLVED" } },
      include: { shop: true, customer: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.order.findMany({
      where: { status: { in: [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION] }, createdAt: { lte: staleOrderDate } },
      include: { shop: true, customer: true },
      orderBy: { createdAt: "asc" },
      take: 6,
    }),
    prisma.customerMessage.count({ where: { status: "FAILED" } }),
  ]);

  const openDebt = Number(debtAggregate._sum.principalAmount ?? 0) - Number(debtAggregate._sum.paidAmount ?? 0);
  const recurring = shops.reduce((sum, shop) => {
    if (shop.subscriptionStatus !== "ACTIVE" && shop.subscriptionStatus !== "TRIAL") return sum;
    return sum + Number(shop.billingCycle === "YEARLY" ? Number(shop.yearlyPrice ?? 0) / 12 : shop.monthlyPrice ?? 0);
  }, 0);
  const activeShops = shops.filter((shop) => shop.isActive).length;
  const pastDueShops = shops.filter((shop) => shop.subscriptionStatus === "PAST_DUE").length;
  const supportQueue = returnIssues.length + openThreads.length + stuckOrders.length + failedMessages;
  const platformCode = process.env.SUPER_ADMIN_ACCESS_CODE ? "Configured in Railway" : "YPMS-ADMIN";
  const atRiskShops = shops
    .filter((shop) => !shop.isActive || shop.subscriptionStatus === "PAST_DUE" || !shop.publicOrderingEnabled || !shop.orders.length)
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Platform control</h1>
          <p className="mt-2 text-sm text-slate-600">Manage tenants, activation status, plans, usage, and global messages.</p>
        </div>
        <Link href="/admin/shops/new" className="inline-flex items-center gap-2 rounded-[8px] bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          <Plus size={16} /> Create shop
        </Link>
      </div>

      {params.error ? (
        <div className="rounded-[8px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700">
          Admin action needs more access or has invalid data.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Shops" value={compactNumber(shopCount)} icon={<Store size={20} />} />
        <StatCard label="Active shops" value={compactNumber(activeShops)} icon={<CheckCircle2 size={20} />} />
        <StatCard label="Users" value={compactNumber(userCount)} />
        <StatCard label="Orders" value={compactNumber(orderAggregate._count)} />
        <StatCard label="Gross sales" value={currency(orderAggregate._sum.totalAmount?.toString() ?? "0")} icon={<TrendingUp size={20} />} />
        <StatCard label="Open debt" value={currency(openDebt)} icon={<Banknote size={20} />} />
        <StatCard label="Monthly recurring" value={currency(recurring)} helper="Estimated MRR from tenant pricing" />
        <StatCard label="Support queue" value={compactNumber(supportQueue)} icon={<LifeBuoy size={20} />} />
        <StatCard label="Past due shops" value={compactNumber(pastDueShops)} icon={<AlertTriangle size={20} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <div className="flex items-center gap-2">
              <LifeBuoy size={18} className="text-[var(--shop-primary)]" />
              <h2 className="text-xl font-semibold">Customer Issue Desk</h2>
            </div>
          </div>
          <div className="grid gap-0 divide-y divide-[#ded8cd] bg-white">
            {returnIssues.map((issue) => (
              <div key={issue.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_280px]">
                <div>
                  <p className="font-semibold">Return: {issue.reason}</p>
                  <p className="text-slate-500">{issue.shop.name} - {issue.order.receiptNumber} - {issue.buyer?.name ?? "Buyer"}</p>
                </div>
                <form action={updateReturnIssueAction} className="grid grid-cols-[1fr_auto] gap-2">
                  <input type="hidden" name="returnRequestId" value={issue.id} />
                  <select className="field min-h-9 py-1 text-xs" name="status" defaultValue={issue.status}>
                    {Object.values(ReturnRequestStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <Button className="min-h-9 px-2 py-1 text-xs">Update</Button>
                  <input className="field col-span-2 min-h-9 py-1 text-xs" name="resolution" placeholder="Resolution note" />
                </form>
              </div>
            ))}
            {openThreads.map((thread) => (
              <div key={thread.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-semibold">Chat: {thread.subject}</p>
                  <p className="text-slate-500">{thread.shop.name} - {thread.customer?.name ?? "Customer"} - {thread.messages[0]?.body ?? "No message"}</p>
                </div>
                <form action={closeCustomerThreadAction}>
                  <input type="hidden" name="threadId" value={thread.id} />
                  <Button variant="outline" className="min-h-9 px-2 py-1 text-xs">Resolve</Button>
                </form>
              </div>
            ))}
            {stuckOrders.map((order) => (
              <div key={order.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_300px]">
                <div>
                  <p className="font-semibold">Delayed order: {order.receiptNumber}</p>
                  <p className="text-slate-500">{order.shop.name} - {order.customer?.name ?? "No customer"} - {shortDate(order.createdAt)}</p>
                </div>
                <form action={adminUpdateOrderStatusAction} className="grid grid-cols-[1fr_auto] gap-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <select className="field min-h-9 py-1 text-xs" name="status" defaultValue={order.status}>
                    {Object.values(OrderStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <Button className="min-h-9 px-2 py-1 text-xs">Save</Button>
                  <input className="field col-span-2 min-h-9 py-1 text-xs" name="notes" placeholder="Admin note or cancellation reason" />
                </form>
              </div>
            ))}
            {!returnIssues.length && !openThreads.length && !stuckOrders.length ? <p className="p-5 text-sm text-slate-500">No active customer issues needing platform attention.</p> : null}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserCog size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-xl font-semibold">Platform Workers</h2>
          </div>
          <form action={createPlatformWorkerAction} className="grid gap-3">
            <input className="field" name="name" placeholder="Worker name" required />
            <input className="field" name="email" type="email" placeholder="worker@example.com" required />
            <input className="field" name="phone" placeholder="Phone optional" />
            <input className="field" name="password" type="text" placeholder="Temporary password" defaultValue="Ghana123" required />
            <div className="grid grid-cols-2 gap-2 rounded-[8px] bg-white p-3 text-sm">
              {adminPermissionOptions.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" name="adminPermissions" value={key} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <Button variant="secondary" className="w-full">Save worker profile</Button>
          </form>
          <div className="mt-5 divide-y divide-[#ded8cd] rounded-[8px] border border-[#ded8cd] bg-white">
            {platformWorkers.map((worker) => {
              const workerPermissions = adminPermissions(worker.adminPermissions);
              return (
                <div key={worker.id} className="p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{worker.name}</p>
                      <p className="text-slate-500">{worker.email}</p>
                    </div>
                    <form action={togglePlatformWorkerAction}>
                      <input type="hidden" name="userId" value={worker.id} />
                      <Button variant={worker.isActive ? "outline" : "primary"} className="min-h-8 px-2 py-1 text-xs">{worker.isActive ? "Suspend" : "Activate"}</Button>
                    </form>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(workerPermissions.length ? workerPermissions : ["full-access"]).map((permission) => (
                      <Badge key={permission} tone={permission === "full-access" ? "green" : "blue"}>{permission}</Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-xl font-semibold">Tenant shops</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
                <tr><th className="p-4">Shop</th><th className="p-4">Plan</th><th className="p-4">Billing</th><th className="p-4">Usage</th><th className="p-4">Storefront</th><th className="p-4">Created</th><th className="p-4">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-[#ded8cd] bg-white">
                {shops.map((shop) => (
                  <tr key={shop.id}>
                    <td className="p-4">
                      <Link className="font-semibold text-slate-950 hover:underline" href={`/admin/shops/${shop.id}`}>{shop.name}</Link>
                      <p className="text-slate-500">/{shop.slug}</p>
                    </td>
                    <td className="p-4">
                      <Badge tone={shop.subscriptionStatus === "ACTIVE" ? "green" : shop.subscriptionStatus === "PAST_DUE" ? "red" : "orange"}>{shop.planTier}</Badge>
                      <p className="mt-1 text-xs text-slate-500">{shop.subscriptionStatus}</p>
                    </td>
                    <td className="p-4">
                      <p>{shop.billingCycle}</p>
                      <p className="text-xs text-slate-500">
                        {shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}
                      </p>
                    </td>
                    <td className="p-4">
                      <p>{shop._count.users} users / {shop._count.products} products</p>
                      <p className="text-xs text-slate-500">{shop._count.orders} orders / {shop._count.debts} debts</p>
                    </td>
                    <td className="p-4">
                      <Link className="font-semibold text-[#0f766e] hover:underline" href={`/shop/${shop.slug}`}>Open link</Link>
                      <p className="text-xs text-slate-500">{shop.publicOrderingEnabled ? "Orders on" : "Orders off"}</p>
                    </td>
                    <td className="p-4 text-slate-500">{shortDate(shop.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <form action={toggleShopAction}>
                          <input type="hidden" name="shopId" value={shop.id} />
                          <Button variant={shop.isActive ? "outline" : "primary"} className="min-h-8 px-2 py-1 text-xs">
                            <Power size={14} />
                            {shop.isActive ? "Suspend" : "Reactivate"}
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Megaphone size={18} className="text-slate-700" />
              <h2 className="text-xl font-semibold">Broadcast</h2>
            </div>
            <form action={createGlobalAnnouncementAction} className="space-y-3">
              <input className="field" name="title" placeholder="Announcement title" required />
              <textarea className="field min-h-28" name="body" placeholder="Message to every shop dashboard" required />
              <Button variant="secondary" className="w-full">Send announcement</Button>
            </form>
          </div>

          <div className="panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Shield size={18} className="text-slate-700" />
              <h2 className="text-xl font-semibold">Store Risk Watch</h2>
            </div>
            <div className="grid gap-2">
              {atRiskShops.map((shop) => (
                <Link key={shop.id} href={`/admin/shops/${shop.id}`} className="rounded-[8px] border border-[#ded8cd] bg-white p-3 text-sm transition hover:border-[#0f766e]">
                  <p className="font-semibold">{shop.name}</p>
                  <p className="text-slate-500">
                    {!shop.isActive ? "Suspended" : shop.subscriptionStatus === "PAST_DUE" ? "Payment issue" : !shop.publicOrderingEnabled ? "Ordering off" : "No recent orders"}
                  </p>
                </Link>
              ))}
              {!atRiskShops.length ? <p className="text-sm text-slate-500">All shops look healthy.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="panel p-5">
          <h2 className="text-xl font-semibold">Subscription update</h2>
          <p className="mt-2 text-sm text-slate-500">Change plan, billing cycle, price, renewal date, or payment status.</p>
          <form action={updateShopSubscriptionAction} className="mt-5 space-y-3">
            <select className="field" name="shopId" required>
              <option value="">Select shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <select className="field" name="planTier" defaultValue={PlanTier.PRO}>
                {Object.values(PlanTier).map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </select>
              <select className="field" name="billingCycle" defaultValue={BillingCycle.MONTHLY}>
                {Object.values(BillingCycle).map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
              </select>
            </div>
            <select className="field" name="subscriptionStatus" defaultValue={SubscriptionStatus.ACTIVE}>
              {Object.values(SubscriptionStatus).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-3">
              <input className="field" name="monthlyPrice" type="number" min="0" step="0.01" placeholder="Monthly" />
              <input className="field" name="yearlyPrice" type="number" min="0" step="0.01" placeholder="Yearly" />
              <input className="field" name="subscriptionRenewalAt" type="date" />
            </div>
            <Button className="w-full">Save subscription</Button>
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-[var(--shop-primary)]" />
              <h2 className="text-xl font-semibold">Recent platform activity</h2>
            </div>
          </div>
          <div className="divide-y divide-[#ded8cd] bg-white">
            {recentLogs.map((log) => (
              <div key={log.id} className="p-4 text-sm">
                <p className="font-semibold">{log.action}</p>
                <p className="text-slate-500">{log.shop?.name ?? "Platform"} - {log.user?.email ?? "System"} - {shortDate(log.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-xl font-semibold">Admin Access Code</h2>
          </div>
          <p className="rounded-[8px] bg-white p-3 text-sm font-semibold">{platformCode}</p>
          <p className="mt-3 text-sm text-slate-500">Set SUPER_ADMIN_ACCESS_CODE in Railway to replace the default code.</p>
        </div>
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Settings size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-xl font-semibold">Platform Settings</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Failed messages: <span className="font-semibold text-slate-950">{failedMessages}</span></p>
            <p>Worker access: <span className="font-semibold text-slate-950">permission scoped</span></p>
            <p>Shop login: <span className="font-semibold text-slate-950">staff ID required</span></p>
            <p>Admin login: <span className="font-semibold text-slate-950">special code required</span></p>
          </div>
        </div>
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-[var(--shop-secondary)]" />
            <h2 className="text-xl font-semibold">Common Issue Playbook</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Payment failed: confirm provider reference, message customer, retry or mark failed.</p>
            <p>Pickup dispute: verify receipt number, phone code, and pickup timestamp.</p>
            <p>Delayed print: move order status, message shop, update customer note.</p>
            <p>Return complaint: approve, reject, exchange, or refund from the issue desk.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
