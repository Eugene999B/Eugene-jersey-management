import {
  PlanTier,
  SubscriptionAccessExpiryAction,
  SubscriptionAccessType,
} from "@prisma/client";
import { CalendarClock, Gift, ShieldAlert, Sparkles } from "lucide-react";
import { grantShopAccessAction, revokeShopAccessAction } from "@/app/admin/access/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { StatCard } from "@/components/ui/stat-card";
import { prisma } from "@/lib/db";
import { currency, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { accessTypeLabel } from "@/lib/subscription-access";
import { ensureSubscriptionPlans, sortSubscriptionPlans, SUPPORTED_PLAN_FEATURES } from "@/lib/subscription-plans";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ error?: string; granted?: string; revoked?: string }>;
};

const errors: Record<string, string> = {
  values: "Check the business, access type, plan, dates, price, features and written reason.",
  "end-required": "This temporary access type requires an end date.",
  "future-start": "Access grants apply immediately; choose today or an earlier start date.",
  "date-order": "The end date must be later than the start date.",
  "free-forever-end": "Free-forever access must not have an end date.",
  extension: "Automatic extension requires an end date and an extension period.",
  "expiry-plan": "Moving to a paid plan after expiry requires a target paid plan.",
  missing: "The selected business or plan no longer exists.",
  plan: "Only configured and active plans can be granted.",
  "expiry-paid-plan": "Choose a configured, active paid plan for the expiry transition.",
  "expiry-free-plan": "Configure and activate the Free plan before using Return to Free.",
  revoke: "Enter a clear revocation reason.",
  "grant-missing": "That grant is no longer active.",
};

const sponsoredAccessTypes = new Set<SubscriptionAccessType>([
  SubscriptionAccessType.SPONSORED,
  SubscriptionAccessType.PROMOTIONAL,
  SubscriptionAccessType.FREE_FOREVER,
  SubscriptionAccessType.EMERGENCY,
]);

function isoDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function grantTone(type: SubscriptionAccessType, active: boolean) {
  if (!active) return "neutral" as const;
  if (type === SubscriptionAccessType.SUSPENDED) return "red" as const;
  if (type === SubscriptionAccessType.PAID) return "blue" as const;
  return "green" as const;
}

function expiryLabel(action: SubscriptionAccessExpiryAction) {
  const labels: Record<SubscriptionAccessExpiryAction, string> = {
    EXTEND_AUTOMATICALLY: "Extend automatically",
    RETURN_TO_FREE: "Return to Free plan",
    MOVE_TO_PAID: "Move to a paid plan",
    SUSPEND_ACTIONS: "Suspend commercial actions",
    ADMIN_REVIEW: "Wait for administrator review",
  };
  return labels[action];
}

export default async function AdminAccessPage({ searchParams }: Props) {
  await requirePlatformPermission("billing");
  const params = (await searchParams) ?? {};
  await ensureSubscriptionPlans();
  const [shops, plans, grants] = await Promise.all([
    prisma.shop.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, planTier: true, subscriptionStatus: true } }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true, isConfigured: true } }),
    prisma.shopAccessGrant.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const sortedPlans = sortSubscriptionPlans(plans);
  const paidPlans = sortedPlans.filter((plan) => plan.tier !== PlanTier.FREE);
  const active = grants.filter((grant) => grant.isActive);
  const sponsored = active.filter((grant) => sponsoredAccessTypes.has(grant.accessType));
  const expiringSoon = active.filter((grant) => grant.endsAt && grant.endsAt.getTime() <= Date.now() + 30 * 86_400_000);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Administrator-controlled access</p>
        <h1 className="mt-2 text-3xl font-semibold">Free, sponsored and emergency access</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          Grant a saved plan without confusing normal billing. Every grant records the approving administrator, dates, price override, invoice rule, feature overrides, reason and exact expiry outcome.
        </p>
      </div>

      {params.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{errors[params.error] ?? "The access change was not applied."}</div> : null}
      {params.granted ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Access grant saved. The contract, invoices and business access now follow the recorded terms.</div> : null}
      {params.revoked ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Access grant revoked. Commercial actions are suspended until a new grant or paid contract is assigned.</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active grants" value={String(active.length)} icon={<Gift size={20} />} />
        <StatCard label="Sponsored / free" value={String(sponsored.length)} icon={<Sparkles size={20} />} />
        <StatCard label="Expiring in 30 days" value={String(expiringSoon.length)} icon={<CalendarClock size={20} />} />
        <StatCard label="Suspended grants" value={String(active.filter((grant) => grant.accessType === SubscriptionAccessType.SUSPENDED).length)} icon={<ShieldAlert size={20} />} />
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-semibold">Create or replace a business access grant</h2>
        <p className="mt-2 text-sm text-slate-600">A new grant safely revokes the previous active grant for that business. Free-like access automatically disables invoices, while promotional and paid grants may use a price override.</p>
        <form action={grantShopAccessAction} className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-semibold">Business<select className="field mt-1" name="shopId" required><option value="">Select business</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name} · {shop.planTier} · {shop.subscriptionStatus}</option>)}</select></label>
            <label className="text-sm font-semibold">Access type<select className="field mt-1" name="accessType" defaultValue={SubscriptionAccessType.SPONSORED}>{Object.values(SubscriptionAccessType).map((type) => <option key={type} value={type}>{accessTypeLabel(type)}</option>)}</select></label>
            <label className="text-sm font-semibold">Plan and limits<select className="field mt-1" name="planId" required><option value="">Select configured plan</option>{sortedPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · v{plan.version}</option>)}</select></label>
            <label className="text-sm font-semibold">Price override<input className="field mt-1" name="priceOverride" type="number" min="0" step="0.01" placeholder="Blank keeps plan price" /></label>
            <label className="text-sm font-semibold">Start date<input className="field mt-1" name="startsAt" type="date" defaultValue={isoDate()} required /></label>
            <label className="text-sm font-semibold">End date<input className="field mt-1" name="endsAt" type="date" /><span className="mt-1 block text-xs font-normal text-slate-500">Required for temporary grants; blank for Free forever.</span></label>
            <label className="text-sm font-semibold">After expiry<select className="field mt-1" name="expiryAction" defaultValue={SubscriptionAccessExpiryAction.RETURN_TO_FREE}>{Object.values(SubscriptionAccessExpiryAction).map((action) => <option key={action} value={action}>{expiryLabel(action)}</option>)}</select></label>
            <label className="text-sm font-semibold">Expiry target plan<select className="field mt-1" name="expiryPlanId"><option value="">Automatic Free plan / not required</option>{sortedPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.tier}</option>)}</select></label>
            <label className="text-sm font-semibold">Automatic extension days<input className="field mt-1" name="automaticExtensionDays" type="number" min="1" max="3650" placeholder="Required only for automatic extension" /></label>
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold md:col-span-2"><input name="invoicesDisabled" type="checkbox" defaultChecked />Disable invoices and payment prompts during this grant</label>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Feature overrides</legend>
            <p className="mt-1 text-xs text-slate-500">Leave all unchecked to use every feature in the saved plan. Select features only when this grant should be narrower.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{SUPPORTED_PLAN_FEATURES.map((feature) => <label key={feature} className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm"><input name="featureOverrides" type="checkbox" value={feature} />{feature.replaceAll("_", " ")}</label>)}</div>
          </fieldset>

          <label className="block text-sm font-semibold">Approval reason<textarea className="field mt-1 min-h-24" name="reason" minLength={8} maxLength={1000} required placeholder="Example: Professional plan sponsored by the platform administrator from 2 August 2026 to 31 December 2026; no invoice; return to Free after expiry." /></label>
          <Button>Approve and apply access</Button>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 p-5"><h2 className="text-xl font-semibold">Access grant ledger</h2><p className="mt-1 text-sm text-slate-600">The latest 100 grants are retained for audit, including superseded, expired and revoked records.</p></div>
        <div className="divide-y divide-slate-200 bg-white">
          {grants.map((grant) => {
            const shop = shops.find((item) => item.id === grant.shopId);
            const plan = plans.find((item) => item.id === grant.planId);
            return <article key={grant.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{shop?.name ?? grant.shopId}</h3><Badge tone={grantTone(grant.accessType, grant.isActive)}>{grant.isActive ? accessTypeLabel(grant.accessType) : "Inactive"}</Badge>{grant.invoicesDisabled ? <Badge tone="green">No invoices</Badge> : null}</div>
                  <p className="mt-2 text-sm text-slate-600">{plan?.name ?? "Saved plan"} v{grant.planVersion} · {shortDate(grant.startsAt)} to {grant.endsAt ? shortDate(grant.endsAt) : "No expiry"} · {expiryLabel(grant.expiryAction)}</p>
                  <p className="mt-1 text-sm text-slate-600">Price override: {grant.priceOverride === null ? "Plan price" : currency(grant.priceOverride.toString())} · Features: {grant.featureOverrides.length ? grant.featureOverrides.join(", ").replaceAll("_", " ") : "Full plan snapshot"}</p>
                  <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">{grant.reason}</p>
                  {grant.expiryOutcome ? <p className="mt-2 text-xs font-semibold text-amber-800">Expiry outcome: {grant.expiryOutcome.replaceAll("_", " ")}</p> : null}
                  {grant.revocationReason ? <p className="mt-2 text-xs font-semibold text-red-700">Revoked: {grant.revocationReason}</p> : null}
                </div>
                {grant.isActive ? <form action={revokeShopAccessAction} className="w-full max-w-sm space-y-2 rounded-xl border border-red-100 bg-red-50 p-3 sm:w-auto"><input type="hidden" name="grantId" value={grant.id} /><input className="field" name="reason" minLength={8} required placeholder="Reason for revocation" /><ConfirmActionButton variant="danger" confirmation={`Revoke ${accessTypeLabel(grant.accessType)} for ${shop?.name ?? "this business"}? Commercial access will be suspended until a new grant or paid contract is assigned.`}>Revoke grant</ConfirmActionButton></form> : null}
              </div>
            </article>;
          })}
          {!grants.length ? <p className="p-5 text-sm text-slate-500">No administrator access grants have been recorded yet.</p> : null}
        </div>
      </section>

      <p className="text-xs text-slate-500">Paid expiry targets available: {paidPlans.map((plan) => plan.name).join(", ") || "Configure at least one paid plan first."}</p>
    </div>
  );
}
