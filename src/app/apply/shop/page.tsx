import { BusinessApplicationType } from "@prisma/client";
import Link from "next/link";
import { BusinessApplicationForm } from "@/components/applications/business-application-form";
import { ApplicationShell } from "@/components/applications/application-shell";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ error?: string }> };

const errors: Record<string, string> = {
  invalid: "Review the required information and consent declaration before submitting.",
  rate: "Too many application attempts were received. Please wait before trying again.",
  duplicate: "An active application already exists for these contact or registration details. Use the status page instead.",
};

export default async function ShopApplicationPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  return (
    <ApplicationShell>
      <div className="mx-auto max-w-4xl"><Link href="/apply" className="text-sm font-semibold text-slate-500 hover:text-slate-950">Back to application choices</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Shop registration review</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Apply for a shop workspace</h1><p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">This form starts a private administrator review. It does not immediately publish your shop, activate payments or create a Login ID.</p>{params.error ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{errors[params.error] ?? errors.invalid}</div> : null}<div className="mt-7"><BusinessApplicationForm type={BusinessApplicationType.SHOP} /></div></div>
    </ApplicationShell>
  );
}
