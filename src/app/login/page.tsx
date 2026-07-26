import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Boxes, CreditCard, Palette, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { StaffLoginForm } from "@/components/auth/staff-login-form";

export const metadata: Metadata = { title: "Secure workspace access" };
export const dynamic = "force-dynamic";

const errorCopy: Record<string, string> = {
  invalid: "The Login ID or password is not correct.",
  rate: "Too many sign-in attempts. Wait a few minutes before trying again.",
  "shop-not-found": "The shop connected to this account could not be found.",
  "shop-suspended": "This shop workspace is suspended. Contact the platform administrator.",
  "missing-shop": "This account is missing its shop assignment.",
  permission: "That account does not have access to the requested workspace.",
  "invalid-invite": "That staff invitation is invalid, expired, or already belongs to an account.",
};

type LoginPageProps = { searchParams?: Promise<{ error?: string; next?: string; reset?: string; loggedOut?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = params.error ? errorCopy[params.error] ?? errorCopy.invalid : null;

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#07111f] text-white">
      <div className="grid h-full lg:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)]">
        <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-9 xl:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(0,212,255,0.2),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(139,92,246,0.22),transparent_35%),linear-gradient(145deg,#07111f_0%,#0b1930_55%,#07111f_100%)]" />
          <div className="absolute -right-28 top-20 h-72 w-72 rounded-full border border-cyan-300/15" /><div className="absolute -right-10 top-36 h-44 w-44 rounded-full border border-violet-300/15" />
          <Link href="/" className="relative inline-flex w-fit items-center"><Image src="/brand/ejm-logo.svg" alt="Eugene Jersey Management" width={340} height={82} priority /></Link>

          <div className="relative max-w-3xl py-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-200"><Sparkles size={14} /> Private operations access</div>
            <h1 className="mt-7 text-[clamp(3.6rem,6vw,6.4rem)] font-black leading-[0.89] tracking-[-0.065em]">Your business.<br /><span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">Fully in control.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/58 xl:text-lg">Enter the workspace for sales, customers, production, stock, finance and management—without changing tools or losing accountability.</p>
            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3">
              {[{ icon: CreditCard, title: "Commerce", text: "POS, online orders and payments" }, { icon: Palette, title: "Production", text: "Design and machine-ready handoff" }, { icon: Boxes, title: "Inventory", text: "Stock, purchasing and suppliers" }, { icon: ShieldCheck, title: "Control", text: "Roles, audit and tenant isolation" }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur"><Icon size={19} className="text-cyan-300" /><p className="mt-4 text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-white/45">{text}</p></div>)}
            </div>
          </div>

          <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-xs font-semibold text-white/38"><span>Secure sessions</span><span>Role-aware access</span><span>Audit recorded</span></div>
        </section>

        <section className="relative flex h-full min-h-0 items-center justify-center overflow-hidden bg-[#f4f7fb] px-4 py-3 text-[#07111f] sm:px-7 sm:py-5 lg:px-10 xl:px-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(0,212,255,0.11),transparent_28%),radial-gradient(circle_at_95%_90%,rgba(139,92,246,0.11),transparent_30%)]" />
          <div className="relative w-full max-w-[520px] [@media(max-height:650px)]:scale-[0.92]">
            <div className="mb-3 flex items-center justify-between lg:hidden">
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16} /> Home</Link>
              <Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={46} height={46} priority />
            </div>

            <div className="mb-4 sm:mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 sm:text-xs">Secure workspace</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">Sign in and continue.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 [@media(max-height:650px)]:hidden">Each team member uses a private access ID. Credentials are never displayed in the URL or retained by the application.</p>
            </div>

            {error ? <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">{error}</div> : null}
            {params.reset ? <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Password updated. Sign in with the new password.</div> : null}
            {params.loggedOut ? <div className="mb-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">You have signed out securely.</div> : null}

            <StaffLoginForm nextPath={params.next} />

            <div className="mt-3 grid grid-cols-2 gap-2 [@media(max-height:650px)]:hidden">
              <Link href="/buyer/login" className="inline-flex min-h-11 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm"><span className="flex items-center gap-2"><ShoppingBag size={15} /> Buyer access</span><ArrowRight size={15} /></Link>
              <Link href="/shops" className="inline-flex min-h-11 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm"><span className="flex items-center gap-2"><BadgeCheck size={15} /> Marketplace</span><ArrowRight size={15} /></Link>
            </div>
            <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 [@media(max-height:650px)]:hidden">EJM secure access gateway</p>
          </div>
        </section>
      </div>
    </main>
  );
}
