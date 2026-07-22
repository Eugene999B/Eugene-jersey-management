import { BillingCycle, PlanTier } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { createShopAction } from "@/app/admin/actions";

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function NewShopPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  return (
    <div className="mx-auto max-w-4xl panel p-6">
      <p className="text-sm font-semibold uppercase text-slate-500">New tenant</p>
      <h1 className="mt-2 text-3xl font-semibold">Create shop, owner, and verification file</h1>
      <p className="mt-3 text-sm text-slate-600">
        The shop receives a staff login ID and starts pending until credentials are verified by super admin.
      </p>
      {params.error === "email-exists" ? <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">That owner email already belongs to an account. Existing users cannot be transferred between shops.</div> : null}
      <form action={createShopAction} className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <input className="field" name="name" placeholder="Shop name" required />
          <input className="field" name="slug" placeholder="shop-slug" required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input className="field" name="ownerName" placeholder="Owner full name" required />
          <input className="field" name="ownerEmail" type="email" placeholder="owner@example.com" required />
          <input className="field" name="ownerPhone" placeholder="Owner phone" />
          <input className="field uppercase" name="staffLoginId" placeholder="Staff login ID, e.g. APS-STAFF" />
        </div>
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
          {Object.values(PlanTier).map((plan) => (
            <option key={plan} value={plan}>{plan}</option>
          ))}
        </select>
        <div className="grid gap-4 md:grid-cols-3">
          <select className="field" name="billingCycle" defaultValue={BillingCycle.MONTHLY}>
            {Object.values(BillingCycle).map((cycle) => (
              <option key={cycle} value={cycle}>{cycle}</option>
            ))}
          </select>
          <input className="field" name="monthlyPrice" type="number" min="0" step="0.01" placeholder="Monthly price" />
          <input className="field" name="yearlyPrice" type="number" min="0" step="0.01" placeholder="Yearly price" />
        </div>
        <Button variant="secondary">Create tenant</Button>
      </form>
    </div>
  );
}
