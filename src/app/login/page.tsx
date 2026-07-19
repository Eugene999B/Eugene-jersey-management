import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";

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
  { label: "Owner dashboard", email: "owner@accra.test", next: "/dashboard" },
  { label: "Manager workspace", email: "manager@accra.test", next: "/dashboard" },
  { label: "Cashier POS", email: "cashier@accra.test", next: "/dashboard/pos" },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = params.error ? errorCopy[params.error] : null;

  return (
    <main className="grid min-h-screen bg-[#111827] lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden bg-[#0f766e] p-8 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/accra-pro.svg" alt="Sports Shop Platform" width={48} height={48} />
          <div>
            <p className="text-sm text-white/70">Sports Shop Platform</p>
            <h1 className="text-2xl font-semibold">Secure Operations Login</h1>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="mb-4 inline-flex rounded-[8px] bg-white/10 px-3 py-1 text-sm text-white/75">
            Tenant-aware access
          </p>
          <h2 className="text-5xl font-semibold leading-[1.04]">
            One login for staff, POS, orders, and platform control.
          </h2>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {["HTTP-only sessions", "RBAC routes", "Audit trail"].map((item) => (
              <div key={item} className="rounded-[8px] border border-white/15 bg-white/10 p-4">
                <ShieldCheck className="mb-4 text-[#f97316]" size={20} />
                <span className="text-white/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/60">
          Demo password after seeding: <span className="font-semibold text-white">{demoPassword}</span>
        </p>
      </section>

      <section className="flex items-center justify-center bg-[#f6f4ef] p-5">
        <div className="panel w-full max-w-md p-6">
          <div className="mb-7">
            <Image className="mb-5 lg:hidden" src="/brand/accra-pro.svg" alt="Sports Shop Platform" width={42} height={42} />
            <p className="text-sm font-semibold uppercase text-[#0f766e]">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Sign in to your workspace</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use a super admin account for `/admin`, or a shop staff account for `/dashboard`.
            </p>
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
            <button className="w-full rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Sign in
            </button>
          </form>

          <div className="mt-5 grid gap-2">
            {quickLogins.map((login) => (
              <form key={login.email} action="/api/auth/login" method="post">
                <input type="hidden" name="email" value={login.email} />
                <input type="hidden" name="password" value={demoPassword} />
                <input type="hidden" name="next" value={login.next} />
                <button className="w-full rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0f766e] hover:text-[#0f766e]">
                  {login.label}
                </button>
              </form>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="font-semibold text-[#0f766e] hover:underline">
              Forgot password
            </Link>
            <Link href="/" className="text-slate-500 hover:text-slate-800">
              Back home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
