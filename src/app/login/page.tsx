import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, Search, ShieldCheck, ShoppingBag, Sparkles, Store } from "lucide-react";
import { ShopVerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const errorCopy: Record<string, string> = {
  invalid: "Use one of the demo emails with password Ghana123.",
  "shop-id": "Enter the correct Shop Staff ID for this staff account.",
  locked: "This account is unlocked now. Try password Ghana123.",
  "shop-not-found": "The shop connected to this account could not be found.",
  "missing-shop": "This staff account is missing shop access.",
};

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string }>;
};

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Ghana123";
const demoShopLoginId = "APS-STAFF";

const quickLogins = [
  { label: "Owner command", email: "owner@accra.test", next: "/dashboard", shopLoginId: demoShopLoginId },
  { label: "Manager desk", email: "manager@accra.test", next: "/dashboard", shopLoginId: demoShopLoginId },
  { label: "Cashier POS", email: "cashier@accra.test", next: "/dashboard/pos", shopLoginId: demoShopLoginId },
  { label: "Supplier portal", email: "supplier@accra.test", next: "/supplier", shopLoginId: "" },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = params.error ? errorCopy[params.error] : null;
  const shops = await prisma.shop.findMany({
    where: { isActive: true, storefrontEnabled: true, verificationStatus: ShopVerificationStatus.VERIFIED },
    select: { name: true, slug: true, city: true, country: true, verificationStatus: true },
    orderBy: { name: "asc" },
    take: 8,
  });

  return (
    <main className="min-h-screen bg-[#10151f] text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-4 px-3 py-3 sm:px-5 sm:py-5 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
        <div className="flex min-h-[520px] flex-col justify-between rounded-[8px] border border-white/10 bg-[#141b29] p-5 sm:p-6">
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
            <h2 className="max-w-2xl text-4xl font-semibold leading-[1.02] sm:text-6xl">
              Staff sign in with shop ID. Buyers choose a shop and order securely.
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Staff ID lock", "Each shop has a staff login ID"],
                ["Buyer marketplace", "Customers browse shops and catalogs"],
                ["Verified pickup", "Pickup and delivery use phone codes"],
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
            <span>Shop verification records</span>
          </div>
        </div>

        <div className="grid content-center gap-4 rounded-[8px] bg-[#f6f4ef] p-4 text-slate-950 sm:p-5">
          <div className="w-full">
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
                  <Store size={16} /> Shop Staff ID
                </span>
                <input className="field uppercase" name="shopLoginId" autoComplete="organization" defaultValue={demoShopLoginId} required />
              </label>
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
                  <input type="hidden" name="shopLoginId" value={login.shopLoginId} />
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
              <Link href="/buyer/login" className="font-semibold text-[#0f766e] hover:underline">
                Buyer login
              </Link>
            </div>
          </div>

          <section className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
            <div className="flex items-center gap-2">
              <Search size={17} className="text-[#0f766e]" />
              <h3 className="font-semibold">Buy from a shop</h3>
            </div>
            <form action="/shops" className="mt-3 flex gap-2">
              <input className="field" name="q" placeholder="Search shops or sports items" />
              <button className="rounded-[8px] bg-[#111827] px-3 text-sm font-semibold text-white">Search</button>
            </form>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {shops.map((shop) => (
                <Link key={shop.slug} href={`/shop/${shop.slug}`} className="rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-3 text-sm transition hover:border-[#0f766e]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{shop.name}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{shop.verificationStatus}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{shop.city ?? "Online"} {shop.country ? `- ${shop.country}` : ""}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
