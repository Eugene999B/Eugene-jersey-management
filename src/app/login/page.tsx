import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CreditCard,
  LockKeyhole,
  Palette,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Open your workspace",
};

const errorCopy: Record<string, string> = {
  invalid: "The Login ID or password is not correct.",
  rate: "Too many sign-in attempts. Wait a few minutes before trying again.",
  "shop-not-found": "The shop connected to this account could not be found.",
  "missing-shop": "This account is missing its shop assignment.",
  permission: "That account does not have access to the requested workspace.",
  "invalid-invite": "That staff invitation is invalid, expired, or already belongs to an account.",
};

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string; loginId?: string; reset?: string }>;
};

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
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.12fr_0.88fr]">
        <div className="relative hidden overflow-hidden border-r border-white/10 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.24),transparent_30%),radial-gradient(circle_at_82%_72%,rgba(249,115,22,0.2),transparent_34%)]" />
          <div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="rounded-2xl border border-white/15 bg-white/10 p-3"><ShieldCheck size={25} /></span>
              <span>
                <span className="block text-sm text-white/55">Eugene Jersey Management</span>
                <span className="block text-lg font-semibold">Sports shop operating system</span>
              </span>
            </Link>
          </div>

          <div className="relative max-w-3xl py-14">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-200">
              <Sparkles size={16} /> Opening shift
            </div>
            <h1 className="text-5xl font-semibold leading-[0.98] xl:text-7xl">Open the shop.<br /><span className="text-emerald-300">Run the whole workflow.</span></h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 xl:text-lg">
              Start with today&apos;s priorities, move sales into production, prepare artwork on the material, reconcile every payment and close with numbers you can trust.
            </p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {workflow.map(({ icon: Icon, label, detail }, index) => (
                <div key={label} className="group rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur transition hover:border-emerald-300/30 hover:bg-white/[0.08]">
                  <div className="flex items-start gap-4">
                    <span className="rounded-xl bg-white/8 p-3 text-emerald-300"><Icon size={21} /></span>
                    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">0{index + 1}</p><p className="mt-1 font-semibold">{label}</p><p className="mt-1 text-sm text-white/55">{detail}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            <span>Tenant isolated</span><span>Role controlled</span><span>Audit recorded</span><span>Production focused</span>
          </div>
        </div>

        <div className="flex min-h-screen items-center bg-[#f4f2ec] px-4 py-8 text-slate-950 sm:px-8 lg:px-12 xl:px-20">
          <div className="mx-auto w-full max-w-xl">
            <Link href="/" className="mb-10 inline-flex items-center gap-3 lg:hidden">
              <span className="rounded-xl bg-slate-950 p-3 text-white"><ShieldCheck size={22} /></span>
              <span className="font-semibold">Eugene Jersey Management</span>
            </Link>

            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0f766e]">Secure workspace access</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Welcome to your shift.</h2>
              <p className="mt-4 max-w-lg leading-6 text-slate-600">Use your personal Login ID or work email. Account details are never exposed before authentication.</p>
            </div>

            {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800" role="alert">{error}</div> : null}
            {params.reset ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Password updated. Sign in with the new password.</div> : null}

            <form action="/api/auth/login" method="post" className="rounded-2xl border border-[#d9d3c8] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.09)] sm:p-7">
              <input type="hidden" name="next" value={params.next ?? ""} />
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Login ID or work email</span>
                <input className="field min-h-12" name="loginId" autoComplete="username" defaultValue={params.loginId ?? ""} placeholder="Your personal Login ID" required autoFocus />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold"><span>Password</span><Link href="/forgot-password" className="text-[#0f766e] hover:underline">Forgot password?</Link></span>
                <div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="field min-h-12 pl-10" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></div>
              </label>
              <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-sm font-semibold text-white transition hover:bg-[#0b5f59] focus:outline-none focus:ring-4 focus:ring-emerald-200">
                Open workspace <ArrowRight size={17} />
              </button>
              <p className="mt-4 text-center text-xs leading-5 text-slate-500">Protected by account and network rate limits. Repeated attempts are recorded without revealing whether an account exists.</p>
            </form>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link href="/buyer/login" className="flex min-h-14 items-center justify-between rounded-xl border border-[#d9d3c8] bg-white px-4 text-sm font-semibold transition hover:border-[#0f766e]"><span className="flex items-center gap-2"><ShoppingBag size={17} /> Buyer sign in</span><ArrowRight size={16} /></Link>
              <Link href="/shops" className="flex min-h-14 items-center justify-between rounded-xl border border-[#d9d3c8] bg-white px-4 text-sm font-semibold transition hover:border-[#0f766e]"><span className="flex items-center gap-2"><CreditCard size={17} /> Browse shops</span><ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
