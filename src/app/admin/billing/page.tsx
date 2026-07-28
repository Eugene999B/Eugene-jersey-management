import { BillingCycle, SubscriptionPlanChangeStatus, SubscriptionStatus } from "@prisma/client";
import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, CreditCard, ShieldCheck, Users } from "lucide-react";
import {
  assignShopSubscriptionAction,
  decideSubscriptionPlanChangeAction,
  requestSubscriptionPlanChangeAction,
} from "@/app/admin/billing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { prisma } from "@/lib/db";
import { compactNumber, currency, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";
import {
  SUPPORTED_PLAN_FEATURES,
  ensureSubscriptionPlans,
  formatNullableLimit,
  sortSubscriptionPlans,
} from "@/lib/subscription-plans";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: Promise<{
    error?: string;
    requested?: string;
    approved?: string;
    rejected?: string;
    assigned?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "plan-values": "Check the plan prices, limits, features and written reason.",
  "plan-missing": "That plan no longer exists.",
  "public-plan-state": "A public plan must be configured and active.",
  "configured-plan-price": "Configured paid plans require both monthly and yearly prices.",
  "pending-plan-change": "That plan already has a pending proposal awaiting another administrator.",
  "decision-values": "Choose approve or reject and provide a decision note.",
  "request-state": "That proposal is no longer pending.",
  "self-approval": "The administrator who requested a commercial change cannot approve it.",
  "proposal-corrupt": "The stored proposal is invalid and was not applied.",
  "stale-plan": "The plan changed after this proposal was created. Reject it and submit a fresh proposal.",
  "assignment-values": "Check the tenant, plan, cycle, status, renewal date and reason.",
  "assignment-missing": "The selected tenant or plan no longer exists.",
  "plan-not-assignable": "Only configured and active plans can be assigned to a tenant.",
};

function planPrice(value: { toString(): string } | null) {
  return value === null ? "Not configured" : currency(value.toString());
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("billing");
  const plans = await ensureSubscriptionPlans();
  const [shops, contracts, pendingRequests] = await Promise.all([
    prisma.shop.findMany({ orderBy: [{ subscriptionStatus: "asc" }, { name: "asc" }] }),
    prisma.shopSubscriptionContract.findMany(),
    prisma.subscriptionPlanChangeRequest.findMany({
      where: { status: SubscriptionPlanChangeStatus.PENDING },
      include: { plan: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const requesterIds = [...new Set(pendingRequests.map((request) => request.requestedById))];
  const requesters = requesterIds.length
    ? await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true, email: true } })
    : [];
  const requesterMap = new Map(requesters.map((user) => [user.id, user]));
  const contractMap = new Map(contracts.map((contract) => [contract.shopId, contract]));
  const sortedPlans = sortSubscriptionPlans(plans);
  const assignablePlans = sortedPlans.filter((plan) => plan.isConfigured && plan.isActive);

  const recurring = shops.reduce((sum, shop) => {
    if (shop.subscriptionStatus !== "ACTIVE" && shop.subscriptionStatus !== "TRIAL") return sum;
    return sum + Number(shop.billingCycle === "YEARLY" ? Number(shop.yearlyPrice ?? 0) / 12 : shop.monthlyPrice ?? 0);
  }, 0);
  const pastDue = shops.filter((shop) => shop.subscriptionStatus === "PAST_DUE");
  const trials = shops.filter((shop) => shop.subscriptionStatus === "TRIAL");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">CEO commercial control</p>
        <h1 className="mt-2 text-3xl font-semibold">Subscription Plans &amp; Billing</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          Configure the four authoritative plan tiers, require another billing administrator to approve commercial changes, and assign versioned terms to shops without silently repricing existing tenants.
        </p>
      </div>

      {params.error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{errorMessages[params.error] ?? "The billing change was not applied."}</div> : null}
      {params.requested ? <div role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">Plan proposal recorded. A different billing administrator must approve it.</div> : null}
      {params.approved ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Plan proposal approved and stored as a new immutable version.</div> : null}
      {params.rejected ? <div role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Plan proposal rejected without changing the catalogue.</div> : null}
      {params.assigned ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Tenant subscription assigned from the approved plan version.</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Estimated MRR" value={currency(recurring)} icon={<Banknote size={20} />} />
        <StatCard label="Configured plans" value={`${plans.filter((plan) => plan.isConfigured).length}/4`} icon={<CheckCircle2 size={20} />} />
        <StatCard label="Pending approvals" value={compactNumber(pendingRequests.length)} icon={<ShieldCheck size={20} />} />
        <StatCard label="Past due" value={compactNumber(pastDue.length)} icon={<AlertTriangle size={20} />} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Authoritative plan catalogue</h2>
          <p className="mt-1 text-sm text-slate-600">All plan edits are proposals. Existing shop contracts keep their assigned price and limits until explicitly reassigned.</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {sortedPlans.map((plan) => (
            <article key={plan.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    <Badge tone={plan.isConfigured ? "green" : "orange"}>{plan.isConfigured ? "Configured" : "Needs approval"}</Badge>
                    <Badge tone={plan.isActive ? "green" : "red"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{plan.tier} · version {plan.version}</p>
                </div>
                <div className="text-right text-sm"><p className="font-semibold">{planPrice(plan.monthlyPrice)} / month</p><p className="text-slate-500">{planPrice(plan.yearlyPrice)} / year</p></div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description || "No description recorded."}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Trial / grace</dt><dd className="mt-1 font-semibold">{plan.trialDays} / {plan.gracePeriodDays} days</dd></div>
                <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Included staff</dt><dd className="mt-1 font-semibold">{formatNullableLimit(plan.includedStaffAccounts)}</dd></div>
                <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Products</dt><dd className="mt-1 font-semibold">{formatNullableLimit(plan.maxProducts)}</dd></div>
                <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Monthly orders</dt><dd className="mt-1 font-semibold">{formatNullableLimit(plan.maxOrdersPerMonth)}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">{plan.features.length ? plan.features.map((feature) => <Badge key={feature}>{feature.replaceAll("_", " ")}</Badge>) : <span className="text-sm text-slate-500">No feature entitlements configured.</span>}</div>

              <details className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold">Propose new terms</summary>
                <form action={requestSubscriptionPlanChangeAction} className="mt-4 space-y-4">
                  <input type="hidden" name="planId" value={plan.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold">Plan name<input className="field mt-1" name="name" defaultValue={plan.name} required /></label>
                    <label className="text-sm font-semibold">Currency<input className="field mt-1 uppercase" name="currency" defaultValue={plan.currency} maxLength={3} required /></label>
                    <label className="text-sm font-semibold">Monthly price<input className="field mt-1" name="monthlyPrice" type="number" min="0" step="0.01" defaultValue={plan.monthlyPrice?.toString() ?? ""} /></label>
                    <label className="text-sm font-semibold">Yearly price<input className="field mt-1" name="yearlyPrice" type="number" min="0" step="0.01" defaultValue={plan.yearlyPrice?.toString() ?? ""} /></label>
                    <label className="text-sm font-semibold">Trial days<input className="field mt-1" name="trialDays" type="number" min="0" max="365" defaultValue={plan.trialDays} required /></label>
                    <label className="text-sm font-semibold">Grace days<input className="field mt-1" name="gracePeriodDays" type="number" min="0" max="120" defaultValue={plan.gracePeriodDays} required /></label>
                    <label className="text-sm font-semibold">Included staff accounts<input className="field mt-1" name="includedStaffAccounts" type="number" min="1" defaultValue={plan.includedStaffAccounts ?? ""} placeholder="Blank means unlimited" /></label>
                    <label className="text-sm font-semibold">Maximum products<input className="field mt-1" name="maxProducts" type="number" min="1" defaultValue={plan.maxProducts ?? ""} placeholder="Blank means unlimited" /></label>
                    <label className="text-sm font-semibold">Monthly order limit<input className="field mt-1" name="maxOrdersPerMonth" type="number" min="1" defaultValue={plan.maxOrdersPerMonth ?? ""} placeholder="Blank means unlimited" /></label>
                  </div>
                  <label className="block text-sm font-semibold">Description<textarea className="field mt-1 min-h-20" name="description" defaultValue={plan.description ?? ""} /></label>
                  <fieldset><legend className="text-sm font-semibold">Feature entitlements</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{SUPPORTED_PLAN_FEATURES.map((feature) => <label key={feature} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" name="features" value={feature} defaultChecked={plan.features.includes(feature)} />{feature.replaceAll("_", " ")}</label>)}</div></fieldset>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isConfigured" defaultChecked={plan.isConfigured} />Configured</label>
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isPublic" defaultChecked={plan.isPublic} />Publicly offered</label>
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isActive" defaultChecked={plan.isActive} />Active</label>
                  </div>
                  <label className="block text-sm font-semibold">Commercial change reason<textarea className="field mt-1 min-h-20" name="reason" minLength={8} required placeholder="Explain the pricing, limit or feature decision." /></label>
                  <Button>Submit for second-admin approval</Button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex items-center gap-2"><ShieldCheck size={20} /><h2 className="text-xl font-semibold">Pending second-admin approvals</h2></div>
        <p className="mt-1 text-sm text-slate-600">The requester is never allowed to approve the same commercial proposal.</p>
        <div className="mt-4 space-y-4">
          {pendingRequests.map((request) => {
            const requester = requesterMap.get(request.requestedById);
            return (
              <div key={request.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-amber-950">{request.plan.name} · proposed version {request.basePlanVersion + 1}</p><p className="mt-1 text-sm text-amber-800">Requested by {requester?.name ?? requester?.email ?? request.requestedById} · {shortDate(request.createdAt)}</p></div><Badge tone="orange">PENDING</Badge></div>
                <p className="mt-3 text-sm leading-6 text-amber-900"><strong>Reason:</strong> {request.reason}</p>
                <form action={decideSubscriptionPlanChangeAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="requestId" value={request.id} />
                  <input className="field" name="decisionNote" minLength={5} required placeholder="Approval or rejection note" />
                  <button className="button-primary" name="decision" value="APPROVE">Approve</button>
                  <button className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700" name="decision" value="REJECT">Reject</button>
                </form>
              </div>
            );
          })}
          {!pendingRequests.length ? <p className="text-sm text-slate-500">No commercial changes are awaiting approval.</p> : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="panel p-5">
          <h2 className="text-xl font-semibold">Assign approved plan to tenant</h2>
          <p className="mt-2 text-sm text-slate-600">Assignment copies the approved plan version into the tenant contract. Later catalogue edits do not silently change this shop.</p>
          <form action={assignShopSubscriptionAction} className="mt-5 space-y-3">
            <select className="field" name="shopId" required><option value="">Select shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name} · {shop.subscriptionStatus}</option>)}</select>
            <select className="field" name="planId" required><option value="">Select configured plan</option>{assignablePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · v{plan.version}</option>)}</select>
            <div className="grid grid-cols-2 gap-3"><select className="field" name="billingCycle" defaultValue={BillingCycle.MONTHLY}>{Object.values(BillingCycle).map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}</select><select className="field" name="subscriptionStatus" defaultValue={SubscriptionStatus.ACTIVE}>{Object.values(SubscriptionStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
            <label className="block text-sm font-semibold">Renewal date<input className="field mt-1" name="renewalAt" type="date" /></label>
            <label className="block text-sm font-semibold">Assignment reason<textarea className="field mt-1 min-h-20" name="reason" minLength={8} required /></label>
            <Button className="w-full" disabled={!assignablePlans.length}>Assign approved terms</Button>
            {!assignablePlans.length ? <p className="text-sm font-semibold text-amber-700">Approve at least one configured active plan before assigning new terms.</p> : null}
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Tenant subscription register</h2><p className="mt-1 text-sm text-slate-500">Legacy shop fields remain synchronized for current application compatibility.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Shop</th><th className="p-4">Plan version</th><th className="p-4">Cycle</th><th className="p-4">Price</th><th className="p-4">Renewal</th><th className="p-4">Grace ends</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">{shops.map((shop) => { const contract = contractMap.get(shop.id); return <tr key={shop.id}><td className="p-4 font-semibold">{shop.name}</td><td className="p-4">{shop.planTier}{contract ? ` · v${contract.planVersion}` : " · legacy"}</td><td className="p-4">{shop.billingCycle}</td><td className="p-4">{shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}</td><td className="p-4 text-slate-500">{shop.subscriptionRenewalAt ? shortDate(shop.subscriptionRenewalAt) : "Not set"}</td><td className="p-4 text-slate-500">{contract?.graceEndsAt ? shortDate(contract.graceEndsAt) : "—"}</td><td className="p-4"><Badge tone={shop.subscriptionStatus === "ACTIVE" ? "green" : shop.subscriptionStatus === "PAST_DUE" ? "red" : "orange"}>{shop.subscriptionStatus}</Badge></td></tr>; })}</tbody></table></div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="panel p-5"><div className="flex items-center gap-2"><CreditCard size={19} /><h2 className="text-xl font-semibold">Active tenants</h2></div><p className="mt-4 text-3xl font-semibold">{compactNumber(shops.filter((shop) => shop.subscriptionStatus === "ACTIVE").length)}</p></div>
        <div className="panel p-5"><div className="flex items-center gap-2"><CalendarClock size={19} /><h2 className="text-xl font-semibold">Trials</h2></div><p className="mt-4 text-3xl font-semibold">{compactNumber(trials.length)}</p></div>
        <div className="panel p-5"><div className="flex items-center gap-2"><Users size={19} /><h2 className="text-xl font-semibold">Tenant shops</h2></div><p className="mt-4 text-3xl font-semibold">{compactNumber(shops.length)}</p></div>
      </section>
    </div>
  );
}
