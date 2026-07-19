import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";

const errorCopy: Record<string, string> = {
  invalid: "Use one of the demo emails with password Ghana123.",
  locked: "This account is unlocked now. Try password Ghana123.",
  "shop-not-found": "The shop connected to this account could not be found.",
  "missing-shop": "This staff account is missing shop access.",
};

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string }>;
};

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Ghana123";

const quickLogins = [
  { label: "Owner command", email: "owner@accra.test", next: "/dashboard" },
  { label: "Manager desk", email: "manager@accra.test", next: "/dashboard" },
  { label: "Cashier POS", email: "cashier@accra.test", next: "/dashboard/pos" },
  { label: "Supplier portal", email: "supplier@accra.test", next: "/supplier" },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = params.error ? errorCopy[params.error] : null;

  return (
    <main className="min-h-screen bg-[#10151f] text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-6 px-5 py-5 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="flex min-h-[520px] flex-col justify-between rounded-[8px] border border-white/10 bg-[#141b29] p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src="/brand/accra-pro.svg" alt="Sports Shop Platform" width={46} height={46} className="rounded-[8px]" />
              <div>
                <p className="text-sm text-white/55">Eugene Jersey Management</p>
                <h1 className="text-xl font-semibold">Operations gateway</h1>
              </div>
            </div>
            <div className="rounded-[8px] border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
              Secure tenant access
            </div>
          </div>

          <div className="py-10">
            <p className="mb-4 inline-flex items-center gap-2 rounded-[8px] bg-white/8 px-3 py-1 text-sm text-white/70">
              <Sparkles size={15} className="text-[#f97316]" /> Built for shops that sell fast
            </p>
            <h2 className="max-w-2xl text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Sign in and run POS, stock, debts, staff, designs, and customer orders.
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Stock intelligence", "Low-stock risk and product movement"],
                ["Debt control", "Installments, reminders, and balances"],
                ["Public orders", "Each shop gets its own customer link"],
              ].map(([title, body]) => (
                <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-4">
                  <ShieldCheck className="mb-3 text-[#f97316]" size={20} />
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-5 text-white/55">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-4 text-sm text-white/60 sm:grid-cols-3">
            <span>HTTP-only sessions</span>
            <span>Role-based access</span>
            <span>Full audit trail</span>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-[8px] bg-[#f6f4ef] p-5 text-slate-950">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-[8px] bg-[#111827] p-3 text-white">
                <ShoppingBag size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-[#0f766e]">Welcome back</p>
                <h2 className="text-3xl font-semibold">Enter workspace</h2>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form action="/api/auth/login" method="post" className="space-y-4">
              <input type="hidden" name="next" value={params.next ?? ""} />
              <label className="block">
                <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Mail size={16} /> Email
                </span>
                <input className="field" name="email" type="email" autoComplete="email" defaultValue="owner@accra.test" required />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <LockKeyhole size={16} /> Password
                </span>
                <input className="field" name="password" type="password" autoComplete="current-password" defaultValue={demoPassword} required />
              </label>
              <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Sign in <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-5 grid gap-2">
              {quickLogins.map((login) => (
                <form key={login.email} action="/api/auth/login" method="post">
                  <input type="hidden" name="email" value={login.email} />
                  <input type="hidden" name="password" value={demoPassword} />
                  <input type="hidden" name="next" value={login.next} />
                  <button className="flex min-h-11 w-full items-center justify-between rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0f766e] hover:text-[#0f766e]">
                    {login.label}
                    <ArrowRight size={15} />
                  </button>
                </form>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between text-sm">
              <Link href="/forgot-password" className="font-semibold text-[#0f766e] hover:underline">
                Forgot password
              </Link>
              <Link href="/" className="text-slate-500 hover:text-slate-800">
                Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
