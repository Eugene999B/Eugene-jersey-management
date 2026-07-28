import { BusinessApplicationType, ShopVerificationStatus } from "@prisma/client";
import Link from "next/link";
import { BusinessApplicationForm } from "@/components/applications/business-application-form";
import { ApplicationShell } from "@/components/applications/application-shell";
import { platformDb } from "@/lib/platform-db";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ error?: string }> };

const errors: Record<string, string> = {
  invalid: "Review the required information, selected shop and consent declaration before submitting.",
  rate: "Too many application attempts were received. Please wait before trying again.",
  duplicate: "An active application already exists for these contact or registration details. Use the status page instead.",
  shop: "The selected shop is no longer available for supplier applications. Choose another verified shop.",
};

export default async function SupplierApplicationPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const shops = await platformDb.shop.findMany({
    where: { isActive: true, verificationStatus: ShopVerificationStatus.VERIFIED },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return (
    <ApplicationShell>
      <div className="mx-auto max-w-4xl"><Link href="/apply" className="text-sm font-semibold text-slate-500 hover:text-slate-950">Back to application choices</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Supplier relationship review</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Apply to supply a verified shop</h1><p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">Choose the exact shop you want to supply. Approval creates only that reviewed tenant relationship and never grants access to unrelated shops.</p>{params.error ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{errors[params.error] ?? errors.invalid}</div> : null}{!shops.length ? <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No verified shops are currently accepting supplier applications.</div> : <div className="mt-7"><BusinessApplicationForm type={BusinessApplicationType.SUPPLIER} shops={shops} /></div>}</div>
    </ApplicationShell>
  );
}
