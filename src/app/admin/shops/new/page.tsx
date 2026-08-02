import { BillingCycle } from "@prisma/client";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/brand";
import { createSecureShopAction } from "@/app/admin/create-shop-action";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/format";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { ensureSubscriptionPlans } from "@/lib/subscription-plans";

type Props = { searchParams?: Promise<{ error?: string }> };

const errorMessages: Record<string, string> = {
  invalid: `Check every required field. Passwords must be at least ${PASSWORD_MIN_LENGTH} characters and include a letter and number.`,
  "email-exists": "That owner email already belongs to an account. Existing users cannot be transferred between shops.",
  "slug-exists": "That shop web address is already in use.",
  "login-id-exists": "That staff login ID is already in use.",
  plan: "Choose a configured and active subscription plan.",
  "plan-price": "The chosen plan is missing a saved price for that billing cycle.",
};

export default async function NewShopPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("shops");
  const plans = (await ensureSubscriptionPlans()).filter((plan) => plan.isConfigured && plan.isActive);
  return (
    <div className="mx-auto max-w-4xl panel p-6">
      <p className="text-sm font-semibold uppercase text-slate-500">New tenant</p>
      <h1 className="mt-2 text-3xl font-semibold">Create shop, owner, and verification file</h1>
      <p className="mt-3 text-sm text-slate-600">
        The shop starts private and pending. Commercial terms come only from a saved plan version; prices cannot be typed directly into tenant creation.
      </p>
      {params.error ? <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessages[params.error] ?? errorMessages.invalid}</div> : null}
      {!plans.length ? <div className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">No configured active plan is available. Save and activate plan terms from Billing before creating a tenant.</div> : null}
      <form action={createSecureShopAction} className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <input className="field" name="name" placeholder="Business or shop name" required />
          <select className="field" name="businessType" required defaultValue=""><option value="" disabled>Business type</option>{BUSINESS_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <input className="field" name="slug" placeholder="shop-slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input className="field" name="ownerName" placeholder="Owner full name" required />
          <input className="field" name="ownerEmail" type="email" placeholder="owner@example.com" autoComplete="off" required />
          <input className="field" name="ownerPhone" placeholder="Owner phone" autoComplete="off" />
          <input className="field uppercase" name="staffLoginId" placeholder="Owner Login ID, e.g. APS-OWNER" />
        </div>
        <label className="block rounded-[8px] border border-[#ded8cd] bg-white p-4">
          <span className="font-semibold">Initial owner password</span>
          <span className="mt-1 block text-xs text-slate-500">At least {PASSWORD_MIN_LENGTH} characters with a letter and number. Send it privately and ask the owner to reset it after first sign-in.</span>
          <input className="field mt-3" name="ownerPassword" type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={100} autoComplete="new-password" required />
        </label>
        <div className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
          <h2 className="mb-3 font-semibold">Business credentials</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="field" name="legalBusinessName" placeholder="Legal business name" />
            <input className="field" name="businessRegistrationNumber" placeholder="Registration number" />
            <input className="field" name="taxIdentificationNumber" placeholder="Tax ID" />
            <input className="field" name="ownerGovernmentId" placeholder="Owner government ID reference" />
            <input className="field" name="credentialContactName" placeholder="Credential contact name" />
            <input className="field" name="credentialPhone" placeholder="Credential phone" />
            <input className="field" name="credentialEmail" type="email" placeholder="Credential email" />
            <input className="field" name="credentialDocumentUrl" type="url" placeholder="Document URL" />
          </div>
          <textarea className="field mt-4 min-h-20" name="credentialAddress" placeholder="Registered business address" />
        </div>
        <div className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
          <h2 className="font-semibold">Saved subscription terms</h2>
          <p className="mt-1 text-xs text-slate-500">The tenant begins on the selected plan&apos;s saved trial duration and price snapshot.</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <select className="field" name="planId" required defaultValue="">
              <option value="">Select saved plan</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · v{plan.version} · {currency(plan.monthlyPrice?.toString() ?? "0")}/month · {currency(plan.yearlyPrice?.toString() ?? "0")}/year</option>)}
            </select>
            <select className="field" name="billingCycle" defaultValue={BillingCycle.MONTHLY}>
              {Object.values(BillingCycle).map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
            </select>
          </div>
        </div>
        <Button variant="secondary" disabled={!plans.length}>Create tenant</Button>
      </form>
    </div>
  );
}
