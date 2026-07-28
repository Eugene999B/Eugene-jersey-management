import { BusinessApplicationType } from "@prisma/client";
import { submitBusinessApplicationAction } from "@/app/apply/actions";

type ShopOption = { id: string; name: string; city: string | null };

type Props = {
  type: BusinessApplicationType;
  shops?: ShopOption[];
};

export function BusinessApplicationForm({ type, shops = [] }: Props) {
  const isSupplier = type === BusinessApplicationType.SUPPLIER;
  return (
    <form action={submitBusinessApplicationAction} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 sm:p-7">
      <input type="hidden" name="type" value={type} />
      <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"><span>Website</span><input name="website" tabIndex={-1} autoComplete="off" /></label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Business name</span><input className="field" name="businessName" required minLength={2} maxLength={160} placeholder={isSupplier ? "Supplier or distribution business" : "Public shop name"} /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Legal business name</span><input className="field" name="legalBusinessName" maxLength={180} placeholder="As shown on registration documents" /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Business registration number</span><input className="field" name="businessRegistrationNumber" maxLength={100} /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Tax identification number</span><input className="field" name="taxIdentificationNumber" maxLength={100} /></label>
        {isSupplier ? <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Shop you want to supply</span><select className="field" name="requestedShopId" required defaultValue=""><option value="" disabled>Select a verified shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}{shop.city ? ` · ${shop.city}` : ""}</option>)}</select></label> : null}

        <div className="md:col-span-2 mt-2 border-t border-slate-200 pt-5"><h2 className="text-xl font-bold">Primary contact</h2><p className="mt-1 text-sm text-slate-500">We use these details only to review and communicate about this application.</p></div>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Contact name</span><input className="field" name="contactName" required minLength={2} maxLength={140} /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Phone</span><input className="field" name="phone" required minLength={7} maxLength={40} inputMode="tel" /></label>
        <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Email</span><input className="field" name="email" required type="email" maxLength={180} /></label>

        <div className="md:col-span-2 mt-2 border-t border-slate-200 pt-5"><h2 className="text-xl font-bold">Location and services</h2></div>
        <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Business address</span><input className="field" name="address" maxLength={500} /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">City or town</span><input className="field" name="city" maxLength={100} /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Region</span><input className="field" name="region" maxLength={100} /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Country</span><input className="field" name="country" maxLength={100} defaultValue="Ghana" /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Categories</span><input className="field" name="categories" maxLength={700} placeholder={isSupplier ? "Jerseys, footwear, printing materials..." : "Football kits, printing, equipment..."} /></label>
        <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Requested services</span><textarea className="field min-h-28 resize-y" name="requestedServices" maxLength={1000} placeholder={isSupplier ? "What you want to supply and how you operate" : "POS, stock, Design Studio, online marketplace, messaging..."} /></label>
        <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Additional notes</span><textarea className="field min-h-28 resize-y" name="applicantNotes" maxLength={3000} placeholder="Anything the administrator should know during review" /></label>
      </div>

      <label className="mt-6 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><input className="mt-1 h-4 w-4" type="checkbox" name="consentGiven" value="true" required /><span>I confirm that the information is accurate and consent to Eugene Jersey Management storing it for application review, verification and onboarding communication.</span></label>
      <button type="submit" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#07111f] px-5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 sm:w-auto">Submit {isSupplier ? "supplier" : "shop"} application</button>
    </form>
  );
}
