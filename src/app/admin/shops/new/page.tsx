import { PlanTier } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { createShopAction } from "@/app/admin/actions";

export default function NewShopPage() {
  return (
    <div className="mx-auto max-w-2xl panel p-6">
      <p className="text-sm font-semibold uppercase text-slate-500">New tenant</p>
      <h1 className="mt-2 text-3xl font-semibold">Create shop and owner</h1>
      <p className="mt-3 text-sm text-slate-600">The owner receives a generated temporary password in the server console.</p>
      <form action={createShopAction} className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <input className="field" name="name" placeholder="Shop name" required />
          <input className="field" name="slug" placeholder="shop-slug" required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input className="field" name="ownerName" placeholder="Owner full name" required />
          <input className="field" name="ownerEmail" type="email" placeholder="owner@example.com" required />
        </div>
        <select className="field" name="planTier" defaultValue={PlanTier.BASIC}>
          {Object.values(PlanTier).map((plan) => (
            <option key={plan} value={plan}>{plan}</option>
          ))}
        </select>
        <Button variant="secondary">Create tenant</Button>
      </form>
    </div>
  );
}
