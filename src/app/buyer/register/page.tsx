import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ShieldCheck, ShoppingBag } from "lucide-react";
import { BuyerRegistrationForms } from "@/components/auth/buyer-registration-forms";
import { isSmsDeliveryConfigured } from "@/lib/messaging";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

type Props = {
  searchParams?: Promise<{ sent?: string; phone?: string; next?: string; error?: string }>;
};

const errors: Record<string, string> = {
  invalid: `Check the phone number and details. New passwords need ${PASSWORD_MIN_LENGTH}+ characters with a letter and number.`,
  code: "That code is not correct or has expired.",
  rate: "Too many attempts. Please wait a few minutes and try again.",
  email: "That email already belongs to another buyer account.",
  sms: "The phone verification message could not be sent. Check Arkesel integration health, sender approval and SMS balance, then try again.",
};

export const dynamic = "force-dynamic";

export default async function BuyerRegisterPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const next = params.next ?? "/shops";
  const smsReady = isSmsDeliveryConfigured();

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <header className="border-b border-white/10 bg-[#07111f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3"><Image src="/brand/esm-mark.svg" alt="Eugene Shop Management" width={42} height={42} priority /><div className="min-w-0"><p className="truncate text-sm font-bold">Eugene Shop Management</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Buyer registration</p></div></Link>
          <Link href={`/buyer/login?next=${encodeURIComponent(next)}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white"><ArrowLeft size={15} /> Buyer login</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200"><ShoppingBag size={14} /> Create buyer account</div><h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">Register before you checkout.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">Your phone number protects orders, pickup confirmation, delivery verification, shop messages and trusted reviews.</p></div>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm text-white/70 sm:grid-cols-2 lg:grid-cols-1"><p className="flex items-center gap-2"><ShieldCheck size={17} className="text-cyan-300" /> Six-digit phone verification</p><p className="flex items-center gap-2"><BadgeCheck size={17} className="text-cyan-300" /> Account created only after verification</p></div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[#f4f7fb] p-4 text-[#07111f] shadow-[0_35px_120px_rgba(0,0,0,0.28)] sm:p-6 lg:p-8">
          {params.error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{errors[params.error] ?? errors.invalid}</div> : null}
          {params.sent ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Code sent. Enter it in the highlighted verification panel.</div> : null}
          <BuyerRegistrationForms nextPath={next} smsReady={smsReady} phone={params.phone} sent={Boolean(params.sent)} />
          <p className="mt-5 text-center text-sm text-slate-600">Already registered? <Link className="font-semibold text-cyan-700 hover:underline" href={`/buyer/login?next=${encodeURIComponent(next)}`}>Sign in with phone and password</Link>.</p>
        </div>
      </section>
    </main>
  );
}
