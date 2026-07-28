import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Copy, KeyRound } from "lucide-react";
import { ApplicationShell } from "@/components/applications/application-shell";
import { findPublicApplicationByCredentials, readApplicationReceiptCookie } from "@/lib/business-applications";
import { shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ApplicationSubmittedPage() {
  const receipt = await readApplicationReceiptCookie();
  if (!receipt) redirect("/apply/status?error=expired");
  const application = await findPublicApplicationByCredentials(receipt.reference, receipt.token);
  if (!application) redirect("/apply/status?error=expired");

  return (
    <ApplicationShell>
      <section className="mx-auto max-w-3xl rounded-[28px] border border-emerald-200 bg-white p-6 shadow-xl shadow-slate-950/5 sm:p-9"><span className="inline-flex rounded-full bg-emerald-100 p-3 text-emerald-700"><CheckCircle2 size={28} /></span><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Application received</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">Save your private status details</h1><p className="mt-4 text-base leading-8 text-slate-600">Your {titleCase(application.type).toLowerCase()} application for <strong className="text-slate-900">{application.businessName}</strong> was submitted on {shortDate(application.submittedAt)}. The administrator will review it privately.</p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500"><Copy size={15} /> Application reference</div><code className="mt-3 block break-all text-base font-bold text-slate-950">{receipt.reference}</code></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700"><KeyRound size={15} /> Private status token</div><code className="mt-3 block break-all text-base font-bold text-slate-950">{receipt.token}</code></div></div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Record both values now.</strong> The token is not stored in readable form and cannot be recovered later. Never send it publicly.</div>
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/apply/status" className="inline-flex min-h-11 items-center rounded-xl bg-[#07111f] px-5 text-sm font-semibold text-white">Check application status</Link><Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold">Return home</Link></div>
      </section>
    </ApplicationShell>
  );
}
