import Link from "next/link";
import { KeyRound, Search } from "lucide-react";
import { lookupBusinessApplicationStatusAction } from "@/app/apply/actions";
import { ApplicationShell } from "@/components/applications/application-shell";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ error?: string }> };

const errors: Record<string, string> = {
  invalid: "The application reference or private status token was not recognised.",
  rate: "Too many status attempts were made. Please wait before trying again.",
  expired: "Your temporary application access expired. Enter the reference and status token again.",
};

export default async function ApplicationStatusPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  return (
    <ApplicationShell>
      <section className="mx-auto max-w-2xl"><Link href="/apply" className="text-sm font-semibold text-slate-500 hover:text-slate-950">Back to applications</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Private application access</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Check your status</h1><p className="mt-4 text-base leading-8 text-slate-600">Enter the reference and private token shown after submission. The token is sent through this protected form and is not placed in the page URL.</p>
        {params.error ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{errors[params.error] ?? errors.invalid}</div> : null}
        <form action={lookupBusinessApplicationStatusAction} className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 sm:p-7"><label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500"><Search size={15} /> Application reference</span><input className="field uppercase" name="reference" required minLength={10} maxLength={100} placeholder="APP-SHP-... or APP-SUPL-..." /></label><label className="mt-5 block"><span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500"><KeyRound size={15} /> Private status token</span><input className="field" name="token" required minLength={20} maxLength={200} autoComplete="off" /></label><button type="submit" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#07111f] px-5 text-sm font-semibold text-white sm:w-auto">Open application status</button></form>
      </section>
    </ApplicationShell>
  );
}
