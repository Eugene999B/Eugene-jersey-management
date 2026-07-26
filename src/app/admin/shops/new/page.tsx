import { BillingCycle, PlanTier } from "@prisma/client";
import { createSecureShopAction } from "@/app/admin/create-shop-action";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

type Props = { searchParams?: Promise<{ error?: string }> };

const errorMessages: Record<string, string> = {
  invalid: `Check every required field. Passwords must be at least ${PASSWORD_MIN_LENGTH} characters and include a letter and number.`,
  "email-exists": "That owner email already belongs to an account. Existing users cannot be transferred between shops.",
  "slug-exists": "That shop web address is already in use.",
  "login-id-exists": "That staff login ID is already in use.",
};

export default async function NewShopPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  return (
    <div className="mx-auto max-w-4xl panel p-6">
      <p className="text-sm font-semibold uppercase text-slate-500">New tenant</p>
      <h1 className="mt-2 text-3xl font-semibold">Create shop, owner, and verification file</h1>
      <p className="mt-3 text-sm text-slate-600">
        The shop starts private and pending. Create the owner with a strong password, then share it through a trusted channel. Passwords are never placed in URLs or logs.
      </p>
      {params.error ? <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessages[params.error] ?? errorMessages.invalid}</div> : null}
      <form action={createSecureShopAction} className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <input className="field" name="name" placeholder="Shop name" required />
          <input className="field" name="slug" placeholder="shop-slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input className="field" name="ownerName" placeholder="Owner full name" required />
          <input className="field" name="ownerEmail" type="email" placeholder="owner@example.com" autoComplete="off" required />
          <input className="field" name="ownerPhone" placeholder="Owner phone" autoComplete="off" />
          <input className="field uppercase" name="staffLoginId" placeholder="Staff login ID, e.g. APS-STAFF" />
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
        <select className="field" name="planTier" defaultValue={PlanTier.BASIC}>
          {Object.values(PlanTier).map((plan) => <option key={plan} value={plan}>{plan}</option>)}
        </select>
        <div className="grid gap-4 md:grid-cols-3">
          <select className="field" name="billingCycle" defaultValue={BillingCycle.MONTHLY}>
            {Object.values(BillingCycle).map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
          </select>
          <input className="field" name="monthlyPrice" type="number" min="0" step="0.01" placeholder="Monthly price" />
          <input className="field" name="yearlyPrice" type="number" min="0" step="0.01" placeholder="Yearly price" />
        </div>
        <Button variant="secondary">Create tenant</Button>
      </form>
    </div>
  );
}
