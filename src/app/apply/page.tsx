import Link from "next/link";
import { ArrowRight, ClipboardCheck, Store, Truck } from "lucide-react";
import { ApplicationShell } from "@/components/applications/application-shell";

export default function ApplyPage() {
  return (
    <ApplicationShell>
      <section className="mx-auto max-w-4xl text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Join the platform</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">Apply as a shop or supplier</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">Submit your business details for administrator review. Approval is controlled and does not automatically create public access or payment routing.</p></section>
      <section className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        <Link href="/apply/shop" className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 transition hover:-translate-y-1 hover:border-cyan-300"><span className="inline-flex rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Store size={24} /></span><h2 className="mt-6 text-2xl font-bold">Shop application</h2><p className="mt-3 text-sm leading-7 text-slate-600">For retailers, wholesalers, service businesses, production shops, rental businesses and mixed operations that need their own secure workspace and marketplace profile.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-700">Start shop application <ArrowRight size={16} /></span></Link>
        <Link href="/apply/supplier" className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 transition hover:-translate-y-1 hover:border-violet-300"><span className="inline-flex rounded-2xl bg-violet-50 p-3 text-violet-700"><Truck size={24} /></span><h2 className="mt-6 text-2xl font-bold">Supplier application</h2><p className="mt-3 text-sm leading-7 text-slate-600">For suppliers and distributors seeking a specific approved relationship with an existing verified shop.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-700">Start supplier application <ArrowRight size={16} /></span></Link>
      </section>
      <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm"><span className="inline-flex items-center gap-2 font-semibold text-slate-700"><ClipboardCheck size={17} /> Already submitted an application?</span><Link href="/apply/status" className="font-bold text-[#0f766e] hover:underline">Check application status</Link></div>
    </ApplicationShell>
  );
}
