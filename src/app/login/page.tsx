import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Boxes, CreditCard, Palette, ScanLine, ShoppingBag, Sparkles } from "lucide-react";
import { StaffLoginForm } from "@/components/auth/staff-login-form";

export const metadata: Metadata = { title: "Open your workspace" };

const errorCopy: Record<string, string> = {
  invalid: "The Login ID or password is not correct.",
  rate: "Too many sign-in attempts. Wait a few minutes before trying again.",
  "shop-not-found": "The shop connected to this account could not be found.",
  "shop-suspended": "This shop workspace is suspended. Contact the platform administrator.",
  "missing-shop": "This account is missing its shop assignment.",
  permission: "That account does not have access to the requested workspace.",
  "invalid-invite": "That staff invitation is invalid, expired, or already belongs to an account.",
};

type LoginPageProps = { searchParams?: Promise<{ error?: string; next?: string; loginId?: string; reset?: string }> };
const workflow = [
  { icon: ShoppingBag, label: "Sell", detail: "POS, receipts and verified tenders" },
  { icon: Palette, label: "Design", detail: "Artwork prepared on production material" },
  { icon: ScanLine, label: "Produce", detail: "Orders, cutters and print handoff" },
  { icon: Boxes, label: "Control", detail: "Stock, debts, closing and reports" },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = params.error ? errorCopy[params.error] ?? errorCopy.invalid : null;

  return (
    <main className="h-[100svh] overflow-hidden bg-[#081a31] text-white">
      <section className="mx-auto grid h-full max-w-[1500px] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden overflow-hidden border-r border-white/10 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_18%,rgba(227,27,35,0.22),transparent_31%),radial-gradient(circle_at_82%_72%,rgba(244,185,66,0.18),transparent_34%)]" />
          <div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-[#f4b942]/45 to-transparent" />
          <Link href="/" className="relative inline-flex items-center">
            <Image src="/brand/ejm-logo.svg" alt="Eugene Jersey Management" width={360} height={88} priority />
          </Link>

          <div className="relative max-w-3xl py-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f4b942]/25 bg-[#f4b942]/10 px-4 py-2 text-sm font-semibold text-[#ffe3a0]"><Sparkles size={16} /> Professional shop operations</div>
            <h1 className="text-5xl font-semibold leading-[0.98] xl:text-7xl">Open the shop.<br /><span className="text-[#f4b942]">Run the whole workflow.</span></h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 xl:text-lg">Sales, jersey design, production, stock, customer accounts and management controls in one secure workspace.</p>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {workflow.map(({ icon: Icon, label, detail }, index) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur">
                  <div className="flex items-start gap-4"><span className="rounded-xl bg-white/8 p-3 text-[#f4b942]"><Icon size={21} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">0{index + 1}</p><p className="mt-1 font-semibold">{label}</p><p className="mt-1 text-sm text-white/55">{detail}</p></div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-white/40"><span>Tenant isolated</span><span>Role controlled</span><span>Audit recorded</span><span>Production focused</span></div>
        </div>

        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden bg-[#f7f8fa] px-4 py-3 text-slate-950 sm:px-8 sm:py-5 lg:px-12 xl:px-20">
          <div className="w-full max-w-lg">
            <Link href="/" className="mb-3 flex justify-center lg:hidden">
              <Image src="/brand/ejm-logo.svg" alt="Eugene Jersey Management" width={265} height={65} priority />
            </Link>

            <div className="mb-3 text-center sm:mb-5 lg:text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e31b23] sm:text-xs">Secure workspace access</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-4xl">Welcome to your shift.</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600 sm:mt-2 sm:text-sm">Use your personal Login ID or work email.</p>
            </div>

            {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 sm:text-sm" role="alert">{error}</div> : null}
            {params.reset ? <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 sm:text-sm">Password updated. Sign in with the new password.</div> : null}

            <StaffLoginForm nextPath={params.next} defaultLoginId={params.loginId} />

            <div className="mt-3 flex items-center justify-center gap-5 text-xs font-semibold text-[#0b1f3a] sm:mt-4 sm:grid sm:grid-cols-2 sm:gap-3">
              <Link href="/buyer/login" className="inline-flex items-center gap-1.5 sm:min-h-11 sm:justify-between sm:rounded-xl sm:border sm:border-[#d9d3c8] sm:bg-white sm:px-4"><span className="flex items-center gap-2"><ShoppingBag size={15} /> Buyer sign in</span><ArrowRight className="hidden sm:block" size={15} /></Link>
              <Link href="/shops" className="inline-flex items-center gap-1.5 sm:min-h-11 sm:justify-between sm:rounded-xl sm:border sm:border-[#d9d3c8] sm:bg-white sm:px-4"><span className="flex items-center gap-2"><CreditCard size={15} /> Browse shops</span><ArrowRight className="hidden sm:block" size={15} /></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
